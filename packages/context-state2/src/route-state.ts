import { Subscription, distinctUntilChanged, map, of } from "rxjs"
import { NestedMap, createStateNode, getInternals, mapRecord } from "./internal"
import { GetValueFn, StateNode } from "./types"

export class InvalidRouteError extends Error {
  constructor(key: string, keys: string[]) {
    super(
      `Invalid Route. Received "${key}" while valid keys are: "${keys.join(
        ", ",
      )}"`,
    )
    this.name = "InvalidRouteError"
  }
}

export const routeState = <
  T,
  K extends Record<string, any>,
  O extends Record<string, ((value: T) => any) | null>,
  OT extends {
    [KOT in keyof O]: null extends O[KOT]
      ? StateNode<T, K>
      : O[KOT] extends (value: T) => infer V
      ? StateNode<V, K>
      : unknown
  },
>(
  parent: StateNode<T, K>,
  routes: O,
  selector: (value: T, ctx: GetValueFn) => string & keyof O,
): [StateNode<keyof O, K>, OT] => {
  const internalParent = getInternals(parent)
  const keys = new Set(Object.keys(routes))
  const keyState = createKeyState(parent, keys, selector)

  const routedState = mapRecord(routes, (mapper) => {
    return createStateNode(
      internalParent.keysOrder,
      [internalParent],
      (ctx) => {
        const parentValue = ctx(internalParent)
        return of(mapper ? mapper(parentValue) : parentValue)
      },
    )
  })

  const subscriptions = new NestedMap<keyof K, Subscription>()

  const watchInstanceRoutes = (instanceKey: K) => {
    let previousNode: any = null
    const sub = keyState
      .getInstance(instanceKey)
      .getState$()
      .subscribe({
        next: (activeKey) => {
          if (previousNode) {
            previousNode.removeInstance(instanceKey)
          }
          const node = routedState[activeKey]
          node.addInstance(instanceKey)
          node.activateInstance(instanceKey)
          previousNode = node
        },
      })
    const key = internalParent.keysOrder.map((k) => instanceKey[k])
    subscriptions.set(key, sub)
  }
  const removeInstanceRoutes = (instanceKey: K) => {
    const key = internalParent.keysOrder.map((k) => instanceKey[k])
    const sub = subscriptions.get(key)
    subscriptions.delete(key)
    Object.values(routedState).forEach((node) => {
      node.removeInstance(instanceKey)
    })
    sub?.unsubscribe()
  }

  for (let instance of internalParent.getInstances()) {
    watchInstanceRoutes(instance.key)
  }

  internalParent.instanceChange$.subscribe((change) => {
    if (change.type === "added") {
      watchInstanceRoutes(change.key)
    } else if (change.type === "removed") {
      removeInstanceRoutes(change.key)
    }
  })

  return [keyState.public, mapRecord(routedState, (v) => v.public) as OT]
}

const createKeyState = <T, K extends Record<string, any>>(
  parent: StateNode<T, K>,
  keys: Set<string>,
  selector: (value: T, ctx: GetValueFn) => string,
) => {
  const internalParent = getInternals(parent)
  const keyNode = createStateNode(
    internalParent.keysOrder,
    [internalParent],
    (ctx, _, key) =>
      parent.getState$(key).pipe(
        map((value) => selector(value, (node) => ctx(getInternals(node)))),
        map((key) => {
          if (!keys.has(key)) throw new InvalidRouteError(key, [...keys])
          return key
        }),
        distinctUntilChanged(),
      ),
  )

  const addInstance = (instanceKey: K) => {
    // TODO duplicate ?
    keyNode.addInstance(instanceKey)
  }
  const removeInstance = (instanceKey: K) => {
    keyNode.removeInstance(instanceKey)
  }

  for (let instance of internalParent.getInstances()) {
    addInstance(instance.key)
  }
  for (let instance of internalParent.getInstances()) {
    keyNode.activateInstance(instance.key)
  }

  internalParent.instanceChange$.subscribe((change) => {
    if (change.type === "added") {
      addInstance(change.key)
    } else if (change.type === "ready") {
      keyNode.activateInstance(change.key)
    } else if (change.type === "removed") {
      removeInstance(change.key)
    }
  })

  return keyNode
}
