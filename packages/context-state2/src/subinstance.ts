import { Observable, filter, map, scan, startWith } from "rxjs"
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
  type: "add" | "remove"
  key: K
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
      lastUpdate: null,
    } as {
      lastUpdate: InstanceUpdate<KV> | null
    })
    return keySelector(ctx, getObs, key).pipe(
      scan((acc, change) => {
        acc.lastUpdate = change
        if (change.type === "add") {
          if (acc.has(change.key)) {
            acc.lastUpdate = null
          } else {
            acc.add(change.key)
          }
        } else {
          if (acc.has(change.key)) {
            acc.delete(change.key)
          } else {
            acc.lastUpdate = null
          }
        }
        return acc
      }, keys),
      filter((v) => v.lastUpdate !== null),
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
    return instanceKeys
      .getState$(key)
      .pipe(map((v, i) => [v, i] as const))
      .subscribe(([v, i]) => {
        if (i === 0) {
          // TODO ackchyually, this can't happen because `instanceKeys` has startWith(new Set())
          // Something I don't like from this is that this also means that there's currently no way of doing one single update with all the changes
          // Maybe change API to { type: 'add', keys: key[] }? And also change startWith for defaultStart
          for (let instanceKey of v) {
            result.addInstance({
              ...key,
              [keyName]: instanceKey,
            })
          }
          for (let instanceKey of v) {
            result.activateInstance({
              ...key,
              [keyName]: instanceKey,
            })
          }
        } else {
          if (v.lastUpdate?.type === "add") {
            result.addInstance({
              ...key,
              [keyName]: v.lastUpdate.key,
            })
            result.activateInstance({
              ...key,
              [keyName]: v.lastUpdate.key,
            })
          } else if (v.lastUpdate?.type === "remove") {
            result.removeInstance({
              ...key,
              [keyName]: v.lastUpdate.key,
            })
          }
        }
      })
  }

  trackParentChanges(parent, {
    onAdded(key) {
      return watchParentInstance(key)
    },
    onActive() {},
    onReset() {},
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
