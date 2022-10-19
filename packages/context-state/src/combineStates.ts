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
  states: States,
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
