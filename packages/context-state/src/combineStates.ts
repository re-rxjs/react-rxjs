import { NestedMap } from "./internal/nested-map"
import { of } from "rxjs"
import { mapRecord, detachedNode, recordEntries, children } from "./internal"
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
  const _allFalse = mapRecord(states, () => false)

  const [result, run] = detachedNode((ctx) =>
    of(mapRecord(states, (node) => ctx(node))),
  )

  recordEntries(states).forEach(([key, node]) => {
    children.get(node)!.add((ctxKey, isActive, isParentLoaded) => {
      let instance: any = instances.get(ctxKey)
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
        instance.loadedStates[key] = isParentLoaded
      }

      const isCurrentlyActive = instance.inactiveStates === 0
      const isLoaded = instance.activeStates === nKeys
      if (
        isCurrentlyActive !== instance.latestIsActive ||
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
