import { children } from "./internal"
import { StateNode } from "./types"

export interface RootNode extends StateNode<never> {
  run(): () => void
}

export function createRoot(): RootNode {
  const childRunners = new Set<(isActive: boolean, value: null) => void>()
  const runChildren = (isActive: boolean) => {
    childRunners.forEach((cb) => {
      cb(isActive, null)
    })
  }

  const result: RootNode = {
    getValue: () => {
      throw new Error("RootNode doesn't have value")
    },
    state$: () => {
      throw new Error("RootNode doesn't have value")
    },
    run: () => {
      // Maybe more fancy with refcount, etc?
      runChildren(true)
      return () => {
        runChildren(false)
      }
    },
  }

  children.set(result, childRunners)

  return result
}
