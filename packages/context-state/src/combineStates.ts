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
  let inactiveStates = Object.keys(states).length
  let emptyStates = 0
  const activeStates = mapRecord(states, () => false)
  const latestStates = mapRecord(states, () => null)

  const [result, run] = detachedNode(() => of({ ...latestStates }))

  let latestValue: boolean | EMPTY_VALUE = false
  recordEntries(states).forEach(([key, node]) => {
    children.get(node)!.add((isActive, value) => {
      if (isActive !== activeStates[key]) {
        inactiveStates += isActive ? -1 : +1
        activeStates[key] = isActive
      }

      if (value !== latestStates[key]) {
        emptyStates +=
          latestStates[key] === EMPTY_VALUE ? -1 : value === EMPTY_VALUE ? 1 : 0
        latestStates[key] = value
      }

      latestValue = emptyStates === 0 ? !latestValue : EMPTY_VALUE
      run(inactiveStates === 0, latestValue)
    })
  })

  return result as StringRecordNodeToNodeStringRecord<States>
}
