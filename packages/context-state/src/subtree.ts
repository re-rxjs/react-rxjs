import { Observable, defer, filter, switchMap, take } from "rxjs"
import { NestedMap, getInternals, trackParentChanges } from "./internal"
import {
  GetObservableFn,
  GetValueFn,
  KeysBaseType,
  StateNode,
  isSignal,
} from "./types"
import { RootNode } from "./create-root"

export function subtree<K extends KeysBaseType, CtxValue, KeyValue>(
  parent: StateNode<unknown, K>,
  node: RootNode<CtxValue, string, KeyValue>,
  instanceSelector: (
    ctxValue: GetValueFn,
    ctxObservable: GetObservableFn<K>,
    key: K,
  ) => [KeyValue] | [KeyValue, CtxValue],
): void {
  const internalParent = getInternals(parent)

  const createInstance = (
    ctxValue: GetValueFn,
    ctxObservable: GetObservableFn<K>,
    key: K,
  ) => {
    const [keyValue, context] = instanceSelector(ctxValue, ctxObservable, key)

    return node.run(keyValue, context!)
  }

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

export function activeObs$<T>(node: StateNode<T, {}>): Observable<T>
export function activeObs$<T, K extends KeysBaseType>(
  node: StateNode<T, K>,
  key: K,
): Observable<T>
export function activeObs$<T, K extends KeysBaseType>(
  node: StateNode<T, K>,
  key: K = {} as any,
): Observable<T> {
  const internalNode = getInternals(node)

  return defer(() => {
    try {
      return internalNode.getInstance(key).getState$()
    } catch (ex) {
      return internalNode.instanceChange$.pipe(
        filter(
          (change) =>
            change.type === "ready" &&
            internalNode.keysOrder.every((k) => change.key[k] === key[k]),
        ),
        take(1),
        switchMap(() => node.getState$(key)),
      )
    }
  })
}
