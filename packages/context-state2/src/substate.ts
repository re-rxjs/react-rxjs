import { EMPTY, Subscription, defer, distinctUntilChanged, skip } from "rxjs"
import { NestedMap, createStateNode, getInternals } from "./internal"
import {
  isSignal,
  type CtxFn,
  type KeysBaseType,
  type StateNode,
} from "./types"

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

  const subscriptions = new NestedMap<K[keyof K], Subscription>()

  const addInstance = (instanceKey: K) => {
    // TODO duplicate ?
    stateNode.addInstance(instanceKey)
    const sub = defer(() => {
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
          // TODO shouldn't re-activation of instances happen after all subscribers have restarted? how to do it?
        },
        error: () => {
          // TODO
        },
        complete: () => {
          // ?
        },
      })
    subscriptions.set(
      internalParent.keysOrder.map((k) => instanceKey[k]),
      sub,
    )
  }
  const removeInstance = (instanceKey: K) => {
    const key = internalParent.keysOrder.map((k) => instanceKey[k])
    const sub = subscriptions.get(key)
    subscriptions.delete(key)
    sub?.unsubscribe()
    stateNode.removeInstance(instanceKey)
  }

  for (let instance of internalParent.getInstances()) {
    addInstance(instance.key)
  }
  for (let instance of internalParent.getInstances()) {
    stateNode.activateInstance(instance.key)
  }

  internalParent.instanceChange$.subscribe((change) => {
    if (change.type === "added") {
      addInstance(change.key)
    } else if (change.type === "ready") {
      stateNode.activateInstance(change.key)
    } else if (change.type === "removed") {
      removeInstance(change.key)
    }
  })

  return stateNode.public
}
