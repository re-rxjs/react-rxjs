import { Observable, filter, scan, startWith } from "rxjs"
import {
  Wildcard,
  createStateNode,
  getInternals,
  trackParentChanges,
} from "./internal"
import { substate } from "./substate"
import {
  CtxFn,
  GetObservableFn,
  GetValueFn,
  KeysBaseType,
  StateNode,
  isSignal,
} from "./types"

export interface InstanceUpdate<K> {
  add?: readonly K[]
  remove?: readonly K[]
}

export type MergeKey<K extends KeysBaseType, KN extends string, KV> = {
  [key in keyof K | KN]: (K & Record<KN, KV>)[key]
}

export type InstanceCtxFn<T, K extends KeysBaseType, Id> = (
  id: Id,
  ctxValue: GetValueFn,
  ctxObservable: GetObservableFn<K>,
  key: K,
) => Observable<T>

export function subinstance<K extends KeysBaseType, KN extends string, KV, R>(
  parent: StateNode<unknown, K>,
  keyName: KN,
  keySelector: CtxFn<InstanceUpdate<KV>, K>,
  instanceObs: InstanceCtxFn<R, MergeKey<K, KN, KV>, KV>,
): [StateNode<R, MergeKey<K, KN, KV>>, StateNode<Set<KV>, K>] {
  const parentInternals = getInternals(parent)
  if (parentInternals.keysOrder.includes(keyName)) {
    throw new Error(`Key "${keyName}" is already being used by a parent node`)
  }
  const instanceKeys = substate(parent, (ctx, getObs, key) => {
    const keys = Object.assign(new Set<KV>(), {
      lastUpdate: {} as InstanceUpdate<KV>,
    })
    return keySelector(ctx, getObs, key).pipe(
      scan((acc, change) => {
        const cleanUpdate: InstanceUpdate<KV> = {
          add: change.add?.filter((key) => !acc.has(key)),
          remove: change.remove?.filter((key) => acc.has(key)),
        }

        acc.lastUpdate = cleanUpdate
        cleanUpdate.add?.forEach((key) => {
          acc.add(key)
        })
        cleanUpdate.remove?.forEach((key) => {
          acc.delete(key)
        })

        return acc
      }, keys),
      filter((v) =>
        Boolean(v.lastUpdate.add?.length || v.lastUpdate.remove?.length),
      ),
      startWith(keys),
    )
  })

  const result = createStateNode<MergeKey<K, KN, KV>, R>(
    [...parentInternals.keysOrder, keyName],
    [parentInternals],
    (ctx, obs, key) =>
      // TODO common pattern, mapping the CtxFn from internal to external
      instanceObs(
        key[keyName],
        (node) => ctx(getInternals(node)),
        ((node, keys) =>
          obs(
            isSignal(node) ? node : getInternals(node),
            keys,
          )) as GetObservableFn<MergeKey<K, KN, KV>>,
        key,
      ),
  )

  function watchParentInstance(key: K) {
    return instanceKeys.getState$(key).subscribe((v) => {
      v.lastUpdate.remove?.forEach((keyValue) => {
        result.removeInstance({
          ...key,
          [keyName]: keyValue,
        })
      })
      v.lastUpdate.add?.forEach((keyValue) => {
        result.addInstance({
          ...key,
          [keyName]: keyValue,
        })
        result.activateInstance({
          ...key,
          [keyName]: keyValue,
        })
      })
    })
  }

  trackParentChanges(parent, {
    onAdded(key) {
      return watchParentInstance(key)
    },
    onActive() {},
    onReset() {},
    onAfterChange(key, storage) {
      storage.value.unsubscribe()
      storage.setValue(watchParentInstance(key))
    },
    onRemoved(key, storage) {
      storage.value.unsubscribe()
      const orderedKey = parentInternals.keysOrder.map((k) => key[k])
      const instancesToRemove = [
        ...result.getInstances([...orderedKey, Wildcard] as any),
      ]
      instancesToRemove.forEach((instance) =>
        result.removeInstance(instance.key),
      )
    },
  })

  return [result.public, instanceKeys]
}
