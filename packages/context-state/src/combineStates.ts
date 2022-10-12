import { NestedMap } from "./internal/nested-map"
import { of } from "rxjs"
import {
  mapRecord,
  detachedNode,
  recordEntries,
  globalChildRunners,
  globalParents,
  globalRunners,
} from "./internal"
import { StateNode, StringRecord } from "./types"

type StringRecordNodeToNodeStringRecord<
  States extends StringRecord<StateNode<any>>,
> = StateNode<{
  [K in keyof States]: States[K] extends StateNode<infer V> ? V : never
}>

interface CombinedStateInstance {
  inactiveStates: number
  emptyStates: number
  activeStates: Record<string, boolean>
  loadedStates: Record<string, boolean>
  latestIsActive: boolean | null
  latestIsLoaded: boolean | null
}

export const combineStates = <States extends StringRecord<StateNode<any>>>(
  states: States,
): StringRecordNodeToNodeStringRecord<States> => {
  const instances = new NestedMap<any[], CombinedStateInstance>()
  const nKeys = Object.keys(states).length
  const _allFalse = mapRecord(states, () => false)

  const result = detachedNode((ctx) =>
    of(mapRecord(states, (node) => ctx(node))),
  )
  const run = globalRunners.get(result)!
  const parents: Array<StateNode<any>> = []
  globalParents.set(result, parents)

  recordEntries(states).forEach(([key, node]) => {
    parents.push(node)
    globalChildRunners.get(node)!.push((ctxKey, isActive, isParentLoaded) => {
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
        run(ctxKey, isCurrentlyActive, isLoaded)
      }
    })
  })

  return result as StringRecordNodeToNodeStringRecord<States>
}
