import { children } from "./internal"
import { StateNode } from "./types"

export interface RootNode extends StateNode<never> {
  run(rootKey?: any): () => void
}

export function createRoot(): RootNode {
  const childRunners = new Set<
    (key: any, isActive: boolean, value: null) => void
  >()
  const runChildren = (key: any, isActive: boolean) => {
    childRunners.forEach((cb) => {
      cb(key, isActive, null)
    })
  }

  const result: RootNode = {
    getValue: () => {
      throw new Error("RootNode doesn't have value")
    },
    state$: () => {
      throw new Error("RootNode doesn't have value")
    },
    run: (...rootKey) => {
      // Maybe more fancy with refcount, etc?
      runChildren(rootKey, true)
      return () => {
        runChildren(rootKey, false)
      }
    },
  }

  children.set(result, childRunners)

  return result
}
