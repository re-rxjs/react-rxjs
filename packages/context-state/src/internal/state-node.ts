import {
  Observable,
  Subject,
  combineLatest,
  defer,
  of,
  switchMap,
  take,
  throwError,
} from "rxjs"
import { KeysBaseType, Signal, StateNode } from "../types"
import { InactiveContextError, inactiveContext, invalidContext } from "./errors"
import { linkPublicInterface } from "./internals"
import { NestedMap, Wildcard } from "./nested-map"
import { StatePromise } from "./promises"
import { Instance, createInstance } from "./state-instance"

export type InstanceEvent =
  | "added"
  | "ready"
  | "removed"
  | "reset"
  | "postchange"
export interface InternalStateNode<T, K extends KeysBaseType> {
  keysOrder: Array<keyof K>
  getInstances: (
    keys?: Array<Wildcard | K[keyof K]>,
  ) => Iterable<Instance<T, K>>
  getInstance: (key: K) => Instance<T, K>
  addInstance: (key: K) => void
  activateInstance: (key: K) => void
  removeInstance: (key: K) => void
  resetInstance: (key: K) => void
  instanceChange$: Observable<{
    type: InstanceEvent
    key: K
  }>
  getContext: <TC>(
    node: InternalStateNode<TC, K>,
    key: K,
    visited?: Set<InternalStateNode<any, any>>,
  ) => TC
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

export function createStateNode<K extends KeysBaseType, R>(
  keysOrder: Array<keyof K>,
  parents: Array<InternalStateNode<unknown, any>>,
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

  const getContext = <TC>(
    otherNode: InternalStateNode<TC, any>,
    key: K,
    visited = new Set<InternalStateNode<any, any>>(),
  ) => {
    if ((otherNode as any) === node) {
      const value = node.public.getValue(key)
      if (value instanceof StatePromise) {
        throw invalidContext()
      }
      return value as unknown as TC
    }
    for (let parent of parents) {
      if (visited.has(parent)) {
        continue
      }
      visited.add(parent)

      try {
        return parent.getContext(otherNode, key, visited)
      } catch (ex) {
        // Don't throw inactiveContext, because it could be on another branch
        if (!(ex instanceof InactiveContextError)) {
          throw ex
        }
      }
    }

    // TODO shouldn't it be something like "node not a parent" or "invalidContext"?
    throw inactiveContext()
  }
  const instanceChange$ = new Subject<{
    type: InstanceEvent
    key: K
  }>()
  const addInstance = (key: K) => {
    const orderedKey = nestedMapKey(key)
    if (instances.get(orderedKey)) {
      return
    }

    // Wait until parents have emitted a value
    const parent$ = defer(() => {
      const instances = parents.map((parent) => parent.getInstance(key))
      try {
        if (
          instances.some(
            (instance) => instance.getValue() instanceof StatePromise,
          )
        ) {
          return combineLatest(
            instances.map((instance) => instance.getState$()),
          ).pipe(take(1))
        }
      } catch (error) {
        return throwError(() => error)
      }
      return of(null)
    })

    instances.set(
      orderedKey,
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
        () =>
          instanceChange$.next({
            type: "postchange",
            key,
          }),
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
    const instance = instances.get(nestedMapKey(key))
    if (!instance) return
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
      return
    }
    // Only kill + readd if it was already active.
    // If it was waiting to become activated, everything that dangles from it will
    // also be waiting, and any promise/Observable returned by it is still pending
    // which is something we want to keep.
    instance.reset()
    instanceChange$.next({
      type: "reset",
      key,
    })
  }

  const node: InternalStateNode<R, K> = {
    keysOrder,
    getInstances: (keys) => instances.values(keys),
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
