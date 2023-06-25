import { EMPTY, Subscription, defer, distinctUntilChanged, skip } from "rxjs"
import { NestedMap, createStateNode, getInternals } from "./internal"
import type { CtxFn, StateNode, StringRecord } from "./types"

export const substate = <T, P extends StringRecord<any>>(
  parent: StateNode<any, P>,
  getState$: CtxFn<T, P>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T, P> => {
  const internalParent = getInternals(parent)
  const stateNode = createStateNode(
    internalParent.keysOrder,
    internalParent,
    (getContext, getObservable, key) =>
      getState$(
        (node) => getContext(getInternals(node)),
        (other, keys?: any) => getObservable(getInternals(other), keys),
        key,
      ),
  )

  const subscriptions = new NestedMap<keyof P, Subscription>()

  const addInstance = (instanceKey: P) => {
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
  const removeInstance = (instanceKey: P) => {
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
