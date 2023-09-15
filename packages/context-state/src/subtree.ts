import { Observable } from "rxjs"
import { createStateNode, getInternals, trackParentChanges } from "./internal"
import {
  GetObservableFn,
  GetValueFn,
  KeysBaseType,
  StateNode,
  isSignal,
} from "./types"

export function subtree<K extends KeysBaseType>(
  parent: StateNode<unknown, K>,
  createInstance: (
    ctxValue: GetValueFn,
    ctxObservable: GetObservableFn<K>,
    key: K,
  ) => () => void,
): void {
  const internalParent = getInternals(parent)
  const stateNode = createStateNode(
    internalParent.keysOrder,
    [internalParent],
    (getContext, getObservable, key) =>
      new Observable(() =>
        createInstance(
          (node) => getContext(getInternals(node)),
          (other, keys?: any) =>
            getObservable(isSignal(other) ? other : getInternals(other), keys),
          key,
        ),
      ),
  )

  trackParentChanges(parent, {
    onAdded(key) {
      stateNode.addInstance(key)
    },
    onActive(key) {
      stateNode.activateInstance(key)
    },
    onReset(key) {
      stateNode.resetInstance(key)
      stateNode.activateInstance(key)
    },
    onAfterChange(key) {
      stateNode.activateInstance(key)
    },
    onRemoved(key) {
      stateNode.removeInstance(key)
    },
  })
}
