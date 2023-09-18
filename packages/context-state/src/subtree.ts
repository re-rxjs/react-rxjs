import { Observable } from "rxjs"
import {
  NestedMap,
  createStateNode,
  getInternals,
  trackParentChanges,
} from "./internal"
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

  const teardowns = new NestedMap<K[keyof K], () => void>()
  const nestedMapKey = (key: K) => internalParent.keysOrder.map((k) => key[k])
  const teardown = (key: K) => teardowns.get(nestedMapKey(key))?.()
  const restart = (key: K) => {
    teardown(key)
    teardowns.set(
      nestedMapKey(key),
      createInstance(
        (node) => internalParent.getContext(getInternals(node), key),
        (other, keys?) => {
          const mergedKey = {
            ...key,
            ...(keys ?? {}),
          } as any
          return isSignal(other)
            ? other.getSignal$(mergedKey)
            : other.getState$(mergedKey)
        },
        key,
      ),
    )
  }

  trackParentChanges(parent, {
    onAdded: () => {},
    onActive: () => {},
    // It starts when it has a value
    // TODO Maybe there should be a way of "activating" roots without actually running!
    // will have to review the API then
    onAfterChange: restart,
    onReset: restart,
    onRemoved: teardown,
  })
}
