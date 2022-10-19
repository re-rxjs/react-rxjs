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
  const childRunners = new Array<RunFn>()

  const runChildren: RunFn = (key, isActive) => {
    childRunners.forEach((cb) => {
      cb(key, isActive, true)
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
    isActive: () => true,
    keysOrder: keyName ? [keyName] : [],
    public: result as any,
  }

  addInternals(result, internalNode as any)

  return result
}
