import { Subject } from "rxjs"
import {
  getInternals,
  inactiveContext,
  NestedMap,
  recursiveError,
} from "./internal"
import type { Signal, StateNode, StringRecord } from "./types"

export const createSignal = <T, K extends StringRecord<any>>(
  parent: StateNode<any, K>,
): Signal<T, K> => {
  const instances = new NestedMap<any[], Subject<T>>()
  const parentInternals = getInternals(parent)

  parentInternals.childRunners.push((key, isActive) => {
    const current = instances.get(key)
    if (isActive && !current) {
      instances.set(key, new Subject())
    }
    if (!isActive && current) {
      instances.delete(key)
      current.complete()
    }
  })

  return {
    getSignal$(keyObj: K = {} as K) {
      const sortedKey = parentInternals.keysOrder.map((key) => keyObj[key])
      const instance = instances.get(sortedKey)
      if (!instance)
        throw (
          recursiveError(sortedKey, parentInternals, new Set()) ||
          inactiveContext()
        )
      return instance
    },
    push(keyOrValue: T | K, value?: T) {
      const keyObj = (arguments.length > 1 ? keyOrValue : {}) as K
      const safeValue = arguments.length > 1 ? value! : (keyOrValue as T)

      const sortedKey = parentInternals.keysOrder.map((key) => keyObj[key])
      const instance = instances.get(sortedKey)
      if (!instance)
        throw (
          recursiveError(sortedKey, parentInternals, new Set()) ||
          inactiveContext()
        )
      instance.next(safeValue)
    },
  }
}
