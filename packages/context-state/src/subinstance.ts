import type { CtxFn, Signal, StateNode, StringRecord } from "./types"
import {
  detachedNode,
  getInternals,
  InternalStateNode,
  NestedMap,
  RunFn,
} from "./internal"
import { Observable, of } from "rxjs"

export type InstanceCtxFn<KT, T, K extends StringRecord<any>> = (
  instanceKey: KT,
  ctxValue: <CT>(node: StateNode<CT, any>) => CT,
  ctxObservable: <CT, CK extends StringRecord<any>>(
    node: StateNode<CT, CK> | Signal<CT, CK>,
    key: Omit<CK, keyof K>,
  ) => Observable<CT>,
  key: K,
) => Observable<T>

export type GetValueFn = <CT>(node: StateNode<CT, any>) => CT

interface GetObservableFn<K> {
  <T, CK extends StringRecord<any>>(
    other: K extends CK ? StateNode<T, CK> | Signal<T, CK> : never,
  ): Observable<T>
  <T, CK extends StringRecord<any>>(
    other: StateNode<T, CK> | Signal<T, CK>,
    keys: Omit<CK, keyof K>,
  ): Observable<T>
}
export type InstanceKeysCtxFn<T, K extends StringRecord<any>> = (
  ctxValue: GetValueFn,
  ctxObservable: GetObservableFn<K>,
  key: K,
) => Observable<Iterable<T>>

type InternalInstance<KT> = {
  isActive: boolean
  isLoaded?: boolean
  references: {
    byInstance: Map<InternalStateNode<any, any>, Set<KT>>
    byKey: Map<KT, [number, any[]]>
  }
}

export const subinstance = <
  T,
  KT,
  KN extends string,
  P extends StringRecord<any>,
>(
  parent: StateNode<any, P>,
  keyName: KN,
  getState$: InstanceCtxFn<KT, T, P>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<
  T,
  { [K in keyof (P & Record<KN, KT>)]: (P & Record<KN, KT>)[K] }
> => {
  const instances = new NestedMap<any, InternalInstance<KT>>()

  const internalParent = getInternals(parent)

  const innerGetState$: CtxFn<T, P> = (ctxValue, ctxObservable, key) =>
    getState$(key[keyName], ctxValue, ctxObservable, key)

  const result = detachedNode<T, P>(
    internalParent.keysOrder.concat(keyName),
    innerGetState$,
    equalityFn,
  )

  const parentRun = (key: any[], isActive: boolean, isLoaded?: boolean) => {
    let instance: InternalInstance<KT> = instances.get(key)!
    if (!instance) {
      instance = {
        isActive,
        isLoaded,
        references: {
          byInstance: new Map(),
          byKey: new Map(),
        },
      }
      instances.set(key, instance)
    } else {
      instance.isActive = isActive
      instance.isLoaded = isLoaded
    }

    instance.references.byKey.forEach(([, k]) => {
      result.run(k, isActive, isLoaded)
    })
  }

  const idsRun = (from: InternalStateNode<any, any>, key: any[], ids: KT[]) => {
    let instance: InternalInstance<KT> = instances.get(key)!
    if (!instance) {
      instance = {
        isActive: false,
        isLoaded: false,
        references: {
          byInstance: new Map([[from, new Set(ids)]]),
          byKey: new Map(),
        },
      }

      ids.forEach((id) => {
        instance.references.byKey.set(id, [1, key.concat(id)])
      })
      instances.set(key, instance)
      return
    }

    const newSetIds = new Set(ids)
    if (!instance.references.byInstance.has(from)) {
      instance.references.byInstance.set(from, newSetIds)
      ids.forEach((id) => {
        if (instance.references.byKey.has(id)) {
          instance.references.byKey.get(id)![0]++
        } else {
          const completeKey = key.concat(id)
          instance.references.byKey.set(id, [1, completeKey])
          if (instance.isActive)
            result.run(completeKey, instance.isActive, instance.isLoaded)
        }
      })
      return
    }

    const oldSet = instance.references.byInstance.get(from)!
    instance.references.byInstance.set(from, newSetIds)

    oldSet.forEach((oldId) => {
      if (newSetIds.has(oldId)) return
      const oldByKey = instance.references.byKey.get(oldId)!
      if (--oldByKey[0] === 0) {
        instance.references.byKey.delete(oldId)
        result.run(oldByKey[1], false, false)
      }
    })

    newSetIds.forEach((newId) => {
      if (oldSet.has(newId)) return
      if (!instance.references.byKey.has(newId)) {
        const completeKey = key.concat(newId)
        instance.references.byKey.set(newId, [1, completeKey])
        if (instance.isActive)
          result.run(completeKey, instance.isActive, instance.isLoaded)
      } else {
        instance.references.byKey.get(newId)![0]++
      }
    })
  }

  const activeInstances = <PI extends StringRecord<any>>(
    parent: StateNode<any, PI>,
    ctxFn: InstanceKeysCtxFn<KT, PI>,
  ) => {
    const internalInnerParent = getInternals(parent)

    const idsGenerator = detachedNode(
      internalInnerParent.keysOrder,
      ctxFn,
      () => false,
    )

    idsGenerator.childRunners.push((key, isActive, isParentLoaded, ids) => {
      idsRun(internalInnerParent, key, isActive && isParentLoaded ? ids : [])
    })
  }

  internalParent.childRunners.push(result.run)
  result.parents = internalParent
  return result.public
}

const positionNode = subinstance(
  {} as StateNode<any, {}>,
  "positionId",
  (positionId: bigint) => of({ id: positionId }),
)
