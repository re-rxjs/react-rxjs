import { NestedMap } from "./internal/nested-map"
import { of } from "rxjs"
import {
  mapRecord,
  detachedNode,
  recordEntries,
  getInternals,
  InternalStateNode,
} from "./internal"
import { StateNode, StringRecord } from "./types"

type StringRecordNodeToNodeStringRecord<
  States extends StringRecord<StateNode<any, any>>,
> = StateNode<
  {
    [K in keyof States]: States[K] extends StateNode<infer V, any> ? V : never
  },
  any
>

interface CombinedStateInstance {
  inactiveStates: number
  emptyStates: number
  activeStates: Record<string, boolean>
  loadedStates: Record<string, boolean>
  latestIsActive: boolean | null
  latestIsLoaded: boolean | null
}

export const combineStates = <States extends StringRecord<StateNode<any, any>>>(
  states: KeysAreCompatible<MapKeys<States>> extends true ? States : never,
): StringRecordNodeToNodeStringRecord<States> => {
  const instances = new NestedMap<any[], CombinedStateInstance>()
  const nKeys = Object.keys(states).length
  const _allFalse = mapRecord(states, () => false)

  const internalStates = mapRecord(states, getInternals)
  const keysOrder = Object.values(internalStates).reduce((a, b) =>
    b.keysOrder.length > a.keysOrder.length ? b : a,
  ).keysOrder

  const result = detachedNode<any, any>(keysOrder, (ctx) =>
    of(mapRecord(states, (node) => ctx(node))),
  )

  const parents: Array<InternalStateNode<any, any>> = []
  recordEntries(internalStates).forEach(([key, node]) => {
    parents.push(node)
    node.childRunners.push((ctxKey, isActive, isParentLoaded) => {
      let instance = instances.get(ctxKey)
      if (!instance) {
        instance = {
          inactiveStates: nKeys,
          emptyStates: nKeys,
          activeStates: { ..._allFalse },
          loadedStates: { ..._allFalse },
          latestIsActive: null,
          latestIsLoaded: null,
        }
        instances.set(ctxKey, instance)
      }

      if (isActive !== instance.activeStates[key]) {
        instance.inactiveStates += isActive ? -1 : 1
        instance.activeStates[key] = isActive
      }

      if (isParentLoaded !== instance.loadedStates[key]) {
        instance.emptyStates += isParentLoaded ? -1 : 1
        instance.loadedStates[key] = !!isParentLoaded
      }

      const isCurrentlyActive = instance.inactiveStates === 0
      const isLoaded = instance.emptyStates === 0
      if (
        isCurrentlyActive !== instance.latestIsActive ||
        isLoaded ||
        isLoaded !== instance.latestIsLoaded
      ) {
        instance.latestIsActive = isCurrentlyActive
        instance.latestIsLoaded = isLoaded
        result.run(ctxKey, isCurrentlyActive, isLoaded)
      }
    })
  })

  return result.public as StringRecordNodeToNodeStringRecord<States>
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

/**
 * Converts Record<string, State<any, K>> to Record<string, K>
 */
type MapKeys<States> = {
  [K in keyof States]: States[K] extends StateNode<any, infer K> ? K : never
}

/**
 * For each of the keys, check if they are compatible with the intersection
 */
type IndividualIsCompatible<KeysRecord, KeysIntersection> = {
  [K in keyof KeysRecord]: KeysRecord[K] extends KeysIntersection ? true : false
}

/**
 * It will be compatible if one of the individual ones returns true.
 * If all of them are false, true extends false => false
 * if one of them is true, true extends boolean => true
 */
type IsCompatible<KeysRecord, KeysIntersection> =
  true extends IndividualIsCompatible<
    KeysRecord,
    KeysIntersection
  >[keyof KeysRecord]
    ? true
    : false

type KeysAreCompatible<KeysRecord> = IsCompatible<
  KeysRecord,
  UnionToIntersection<KeysRecord[keyof KeysRecord]>
>
