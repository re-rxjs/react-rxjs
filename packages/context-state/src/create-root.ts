import { addInternals, InternalStateNode, RunFn } from "./internal"
import { StateNode } from "./types"

export interface RootNode<V, K extends string>
  extends StateNode<never, K extends "" ? {} : Record<K, V>> {
  run: K extends "" ? () => () => void : (key: V) => () => void
}

export function createRoot(): RootNode<never, "">
export function createRoot<KeyValue, KeyName extends string>(
  keyName: KeyName,
): RootNode<KeyValue, KeyName>
export function createRoot<KeyValue = never, KeyName extends string = "">(
  keyName?: KeyName,
): RootNode<KeyValue, KeyName> {
  const flushQueue = new Map<any, Array<() => void>>()
  const childRunners = new Array<RunFn>()

  const runChildren: RunFn = (key, isActive) => {
    const [rootKey] = key
    const waiters: Array<() => void> = []
    flushQueue.set(rootKey, waiters)
    childRunners.forEach((cb) => {
      cb(key, isActive, true)
    })
    flushQueue.delete(rootKey)
    waiters.forEach((cb) => {
      cb()
    })
  }

  const result: RootNode<KeyValue, KeyName> = {
    getValue: () => {
      throw new Error("RootNode doesn't have value")
    },
    getState$: () => {
      throw new Error("RootNode doesn't have value")
    },
    run: (root?: KeyValue) => {
      runChildren(keyName ? [root] : [], true)
      return () => {
        runChildren(keyName ? [root] : [], false)
      }
    },
  }

  const internalNode: InternalStateNode<never, Record<KeyName, KeyValue>> = {
    run: runChildren,
    parents: [],
    childRunners,
    isRunning: ([key]) => flushQueue.get(key) ?? false,
    isActive: () => true,
    keysOrder: keyName ? [keyName] : [],
    public: result as any,
  }

  addInternals(result, internalNode as any)

  return result
}
