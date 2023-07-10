import { Subscription } from "rxjs"
import { StateNode } from "../types"
import { getInternals } from "./internals"
import { NestedMap } from "./nested-map"

type Storage<T> = {
  readonly value: T
  setValue: (value: T) => void
  remove: () => T
}
export function trackParentChanges<T, K extends Record<string, any>, R>(
  parent: StateNode<T, K>,
  tracker: {
    onAdded: (key: K, isInitial: boolean) => R
    onActive: (key: K, storage: Storage<R>) => void
    onReset: (key: K, storage: Storage<R>) => void
    onAfterChange?: (key: K, storage: Storage<R>) => void
    onRemoved: (key: K, storage: Storage<R>) => void
  },
): Subscription {
  const internalParent = getInternals(parent)

  const storage = new NestedMap<K[keyof K], R>()
  const getStorage = (key: K): Storage<R> => {
    const orderedKey = internalParent.keysOrder.map((k) => key[k])
    const value = storage.get(orderedKey)!
    return {
      value,
      setValue: (value) => storage.set(orderedKey, value),
      remove: () => {
        storage.delete(orderedKey)
        return value
      },
    }
  }

  for (let instance of internalParent.getInstances()) {
    getStorage(instance.key).setValue(tracker.onAdded(instance.key, true))
  }
  for (let instance of internalParent.getInstances()) {
    tracker.onActive(instance.key, getStorage(instance.key))
  }

  return internalParent.instanceChange$.subscribe((change) => {
    if (change.type === "added") {
      getStorage(change.key).setValue(tracker.onAdded(change.key, false))
    } else if (change.type === "ready") {
      tracker.onActive(change.key, getStorage(change.key))
    } else if (change.type === "reset") {
      tracker.onReset(change.key, getStorage(change.key))
    } else if (change.type === "postchange") {
      tracker.onAfterChange?.(change.key, getStorage(change.key))
    } else if (change.type === "removed") {
      const storage = getStorage(change.key)
      tracker.onRemoved(change.key, storage)
      storage.remove()
    }
  })
}
