import { globalChildRunners, globalIsActive, globalRunners } from "./internal"
import { StateNode } from "./types"

export interface RootNode extends StateNode<never> {
  run(rootKey?: any): () => void
}

export function createRoot(): RootNode {
  const childRunners = new Array<
    (key: any, isActive: boolean, value?: boolean) => void
  >()
  const runChildren = (key: any, isActive: boolean) => {
    childRunners.forEach((cb) => {
      cb(key, isActive, true)
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

  globalIsActive.set(result, () => true)
  globalChildRunners.set(result, childRunners)
  globalRunners.set(result, runChildren)

  return result
}
