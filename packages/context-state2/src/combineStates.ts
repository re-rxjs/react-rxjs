import { combineLatest } from "rxjs"
import {
  createStateNode,
  getInternals,
  mapRecord,
  recordEntries,
} from "./internal"
import { NestedMap, Wildcard } from "./internal/nested-map"
import { StateNode } from "./types"

export type StringRecordNodeToStringRecord<
  States extends Record<string, StateNode<any, any>>,
> = {
  [K in keyof States]: States[K] extends StateNode<infer V, any> ? V : never
}

type StringRecordNodeToNodeStringRecord<
  States extends Record<string, StateNode<any, any>>,
> = StateNode<StringRecordNodeToStringRecord<States>, any>

export const combineStates = <
  States extends Record<string, StateNode<any, any>>,
>(
  states: KeysAreCompatible<MapKeys<States>> extends true ? States : never,
): StringRecordNodeToNodeStringRecord<States> => {
  const internalStates = mapRecord(states, getInternals)
  const leadState = Object.values(internalStates).reduce((a, b) =>
    b.keysOrder.length > a.keysOrder.length ? b : a,
  )
  const keysOrder = leadState.keysOrder as string[]

  const result = createStateNode(
    keysOrder,
    Object.values(internalStates),
    (_, obs) =>
      combineLatest(mapRecord(states, (node) => obs(getInternals(node)))),
  )

  const activeInstances = mapRecord(states, () => new NestedMap<any, true>())

  // Accepts Wildcards
  function addInstances(keys?: Array<any>) {
    const toActivate: Array<any> = []
    for (let instance of leadState.getInstances(keys)) {
      if (
        Object.entries(internalStates).every(
          ([key, node]) =>
            node === leadState ||
            activeInstances[key].get(
              node.keysOrder.map((k) => instance.key[k]),
            ),
        )
      ) {
        result.addInstance(instance.key)
        toActivate.push(instance.key)
      }
    }
    for (let key of toActivate) {
      result.activateInstance(key)
    }
  }
  function removeInstances(keys: Array<any>) {
    const keysToRemove = []
    for (let instance of result.getInstances(keys)) {
      keysToRemove.push(instance.key)
    }
    for (let key of keysToRemove) {
      result.removeInstance(key)
    }
  }

  recordEntries(internalStates).forEach(([key, node]) => {
    for (let instance of node.getInstances()) {
      activeInstances[key].set(
        node.keysOrder.map((k) => instance.key[k]),
        true,
      )
    }

    node.instanceChange$.subscribe((change) => {
      if (change.type === "added") {
        activeInstances[key].set(
          node.keysOrder.map((k) => change.key[k]),
          true,
        )
        addInstances(
          keysOrder.map((k) =>
            node.keysOrder.includes(k) ? change.key[k] : Wildcard,
          ),
        )
      } else if (change.type === "removed") {
        activeInstances[key].set(
          node.keysOrder.map((k) => change.key[k]),
          true,
        )
        removeInstances(
          keysOrder.map((k) =>
            node.keysOrder.includes(k) ? change.key[k] : Wildcard,
          ),
        )
      }
    })
  })
  addInstances()

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
export type MapKeys<States> = {
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

export type KeysAreCompatible<KeysRecord> = IsCompatible<
  KeysRecord,
  UnionToIntersection<KeysRecord[keyof KeysRecord]>
>
