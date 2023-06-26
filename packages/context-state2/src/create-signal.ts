import { Subject } from "rxjs"
import { getInternals, inactiveContext, NestedMap } from "./internal"
import type { KeysBaseType, Signal, StateNode } from "./types"

export const createSignal = <T, K extends KeysBaseType>(
  parent: StateNode<unknown, K>,
): Signal<T, K> => {
  const instances = new NestedMap<K[keyof K], Subject<T>>()
  const internalParent = getInternals(parent)

  for (let instance of internalParent.getInstances()) {
    const key = internalParent.keysOrder.map((k) => instance.key[k])
    instances.set(key, new Subject())
  }

  internalParent.instanceChange$.subscribe((change) => {
    const key = internalParent.keysOrder.map((k) => change.key[k])
    if (change.type === "added") {
      instances.set(key, new Subject())
    } else if (change.type === "removed") {
      const current = instances.get(key)
      if (current) {
        instances.delete(key)
        current.complete()
      }
      // TODO else throw?
    }
  })

  return {
    getSignal$(keyObj: K = {} as K) {
      const sortedKey = internalParent.keysOrder.map((key) => keyObj[key])
      const instance = instances.get(sortedKey)
      if (!instance) throw inactiveContext()
      return instance
    },
    push(keyOrValue: T | K, value?: T) {
      const keyObj = (arguments.length > 1 ? keyOrValue : {}) as K
      const safeValue = arguments.length > 1 ? value! : (keyOrValue as T)

      const sortedKey = internalParent.keysOrder.map((key) => keyObj[key])
      const instance = instances.get(sortedKey)
      if (!instance) throw inactiveContext()
      instance.next(safeValue)
    },
  }
}
