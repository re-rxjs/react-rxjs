import { EMPTY, defer, distinctUntilChanged, skip } from "rxjs"
import { createStateNode, getInternals, trackParentChanges } from "./internal"
import {
  isSignal,
  type CtxFn,
  type KeysBaseType,
  type StateNode,
} from "./types"

/**
 *
 * @param parent
 * @param getState$
 * @param equalityFn TODO <- this equality function actually refers to the parent?!
 * @returns
 */
export const substate = <T, K extends KeysBaseType>(
  parent: StateNode<any, K>,
  getState$: CtxFn<T, K>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T, K> => {
  const internalParent = getInternals(parent)
  const stateNode = createStateNode(
    internalParent.keysOrder,
    [internalParent],
    (getContext, getObservable, key) =>
      getState$(
        (node) => getContext(getInternals(node)),
        (other, keys?: any) =>
          getObservable(isSignal(other) ? other : getInternals(other), keys),
        key,
      ),
  )

  const addInstance = (instanceKey: K) => {
    // TODO duplicate ?
    stateNode.addInstance(instanceKey)
    return defer(() => {
      try {
        return parent.getState$(instanceKey)
      } catch (ex) {
        // root nodes don't have values, so they throw an error when trying to get the observable
        return EMPTY
      }
    })
      .pipe(distinctUntilChanged(equalityFn), skip(1))
      .subscribe({
        next: () => {
          stateNode.resetInstance(instanceKey)
        },
        error: () => {
          // TODO
        },
        complete: () => {
          // ?
        },
      })
  }

  trackParentChanges(parent, {
    onAdded(key) {
      return addInstance(key)
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
    onRemoved(key, storage) {
      stateNode.removeInstance(key)
      storage.value.unsubscribe()
    },
  })

  return stateNode.public
}
