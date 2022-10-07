import { NestedMap } from "./internal/nested-map"
import { of } from "rxjs"
import {
  mapRecord,
  detachedNode,
  EMPTY_VALUE,
  recordEntries,
  children,
} from "./internal"
import { StateNode, StringRecord } from "./types"

type StringRecordNodeToNodeStringRecord<
  States extends StringRecord<StateNode<any>>,
> = StateNode<{
  [K in keyof States]: States[K] extends StateNode<infer V> ? V : never
}>

export const combineStates = <States extends StringRecord<StateNode<any>>>(
  states: States,
): StringRecordNodeToNodeStringRecord<States> => {
  const instances = new NestedMap()
  const nKeys = Object.keys(states).length
  const _activeStates = mapRecord(states, () => false)
  const _latestStates = mapRecord(states, () => null)

  const [result, run] = detachedNode((ctx) =>
    of(mapRecord(states, (node) => ctx(node))),
  )

  let latestValue: boolean | EMPTY_VALUE = false
  recordEntries(states).forEach(([key, node]) => {
    children.get(node)!.add((ctxKey, isActive, value) => {
      let instance: any = instances.get(ctxKey)
      if (!instance) {
        instance = {
          inactiveStates: nKeys,
          activeStates: { ..._activeStates },
          latestStates: { ..._latestStates },
        }
        instances.set(ctxKey, instance)
      }

      if (isActive !== instance.activeStates[key]) {
        instance.inactiveStates += isActive ? -1 : +1
        instance.activeStates[key] = isActive
      }

      if (value !== instance.latestStates[key]) {
        instance.emptyStates +=
          instance.latestStates[key] === EMPTY_VALUE
            ? -1
            : value === EMPTY_VALUE
            ? 1
            : 0
        instance.latestStates[key] = value
      }

      latestValue = instance.emptyStates === 0 ? !latestValue : EMPTY_VALUE
      run(ctxKey, instance.inactiveStates === 0, instance.latestValue)
    })
  })

  return result as StringRecordNodeToNodeStringRecord<States>
}
