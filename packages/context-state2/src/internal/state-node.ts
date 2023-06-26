import {
  Observable,
  Subject,
  defer,
  of,
  switchMap,
  take,
  throwError,
} from "rxjs"
import { KeysBaseType, Signal, StateNode } from "../types"
import { inactiveContext, invalidContext } from "./errors"
import { linkPublicInterface } from "./internals"
import { NestedMap } from "./nested-map"
import { StatePromise } from "./promises"
import { Instance, createInstance } from "./state-instance"

export interface InternalStateNode<T, K extends KeysBaseType> {
  keysOrder: Array<keyof K>
  getInstances: () => Iterable<Instance<T, K>>
  getInstance: (key: K) => Instance<T, K>
  addInstance: (key: K) => void
  activateInstance: (key: K) => void
  removeInstance: (key: K) => void
  resetInstance: (key: K) => void
  instanceChange$: Observable<{
    type: "added" | "ready" | "removed"
    key: K
  }>
  getContext: <TC>(node: InternalStateNode<TC, K>, key: K) => TC
  public: StateNode<T, K>
}

interface GetObservableFn<K> {
  <T, CK extends KeysBaseType>(
    other: K extends CK ? InternalStateNode<T, CK> | Signal<T, CK> : never,
  ): Observable<T>
  <T, CK extends KeysBaseType>(
    other: InternalStateNode<T, CK> | Signal<T, CK>,
    keys: Omit<CK, keyof K>,
  ): Observable<T>
}

export function createStateNode<T, K extends KeysBaseType, R>(
  keysOrder: Array<keyof K>,
  parent: InternalStateNode<T, K> | null,
  instanceCreator: (
    getContext: <R>(node: InternalStateNode<R, K>) => R,
    getObservable: GetObservableFn<K>,
    key: K,
  ) => Observable<R>,
): InternalStateNode<R, K> {
  const instances = new NestedMap<K[keyof K], Instance<R, K>>()
  const nestedMapKey = (key: K) => keysOrder.map((k) => key[k])
  const getInstance = (key: K) => {
    const result = instances.get(nestedMapKey(key))
    if (!result) {
      throw inactiveContext()
    }
    return result
  }

  const getContext = <TC>(otherNode: InternalStateNode<TC, K>, key: K) => {
    if ((otherNode as any) === node) {
      const value = node.public.getValue(key)
      if (value instanceof StatePromise) {
        throw invalidContext()
      }
      return value as unknown as TC
    }
    if (!parent) {
      // TODO shouldn't it be something like "node not a parent" or "invalidContext"?
      throw inactiveContext()
    }
    return parent.getContext(otherNode, key)
  }
  const instanceChange$ = new Subject<{
    type: "added" | "ready" | "removed"
    key: K
  }>()
  const addInstance = (key: K) => {
    // Wait until parent has emitted a value
    const parent$ = defer(() => {
      if (!parent) return of(null)
      const instance = parent.getInstance(key)
      try {
        if (instance.getValue() instanceof StatePromise) {
          return instance.getState$().pipe(take(1))
        }
      } catch (error) {
        return throwError(() => error)
      }
      return of(null)
    })

    // TODO case key already has instance?
    instances.set(
      nestedMapKey(key),
      createInstance(
        key,
        parent$.pipe(
          switchMap(() => {
            try {
              return instanceCreator(
                (otherNode) => getContext(otherNode, key),
                (other, keys?) => {
                  const mergedKey = {
                    ...key,
                    ...(keys ?? {}),
                  }
                  return "public" in other
                    ? other.public.getState$(mergedKey as any)
                    : other.getSignal$(mergedKey as any)
                },
                key,
              )
            } catch (ex) {
              return throwError(() => ex)
            }
          }),
        ),
      ),
    )

    // We need two phases to let instances wire up before getting activated
    instanceChange$.next({
      type: "added",
      key,
    })
    instanceChange$.next({
      type: "ready",
      key,
    })
  }
  const activateInstance = (key: K) => {
    getInstance(key).activate()
  }
  const removeInstance = (key: K) => {
    // TODO already deleted
    const instance = instances.get(nestedMapKey(key))!
    instance.kill()
    instances.delete(nestedMapKey(key))
    instanceChange$.next({
      type: "removed",
      key,
    })
  }
  const resetInstance = (key: K) => {
    const instance = instances.get(nestedMapKey(key))
    if (!instance) {
      // TODO is this a valid path? Maybe throw error instead!
      addInstance(key)
      activateInstance(key)
      return
    }
    // Only kill + readd if it was already active.
    // If it was waiting to become activated, everything that dangles from it will
    // also be waiting, and any promise/Observable returned by it is still pending
    // which is something we want to keep.
    instance.reset()
    // if (instance.isActive) {
    //   removeInstance(key)
    //   addInstance(key)
    //   activateInstance(key)
    // }
  }

  const node: InternalStateNode<R, K> = {
    keysOrder,
    getInstances: () => instances.values(),
    getInstance,
    addInstance,
    activateInstance,
    removeInstance,
    resetInstance,
    instanceChange$,
    getContext,
    public: null as any,
  }
  linkPublicInterface(node)
  return node
}
