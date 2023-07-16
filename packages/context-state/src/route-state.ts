import { distinctUntilChanged, map, of } from "rxjs"
import {
  createStateNode,
  getInternals,
  mapRecord,
  trackParentChanges,
} from "./internal"
import { GetValueFn, KeysBaseType, StateNode } from "./types"

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

export type ResultingRoutes<O, T, K extends KeysBaseType> = {
  [KOT in keyof O]: null extends O[KOT]
    ? StateNode<T, K>
    : O[KOT] extends (value: T) => infer V
    ? StateNode<V, K>
    : unknown
}
export const routeState = <
  T,
  K extends Record<string, any>,
  O extends Record<string, ((value: T) => any) | null>,
  OT extends ResultingRoutes<O, T, K>,
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

  const watchInstanceRoutes = (instanceKey: K) => {
    let previousNode: any = null
    return keyState
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
        error: () => {
          // TODO any implication here? How will we recover?
        },
      })
  }
  const removeInstanceRoutes = (instanceKey: K) => {
    Object.values(routedState).forEach((node) => {
      node.removeInstance(instanceKey)
    })
  }

  trackParentChanges(parent, {
    onAdded(key) {
      return watchInstanceRoutes(key)
    },
    onActive() {},
    onReset() {},
    onRemoved(key, storage) {
      removeInstanceRoutes(key)
      storage.value.unsubscribe()
    },
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

  trackParentChanges(parent, {
    onAdded(key) {
      keyNode.addInstance(key)
    },
    onActive(key) {
      keyNode.activateInstance(key)
    },
    onReset(key) {
      keyNode.resetInstance(key)
    },
    onRemoved(key) {
      keyNode.removeInstance(key)
    },
  })

  return keyNode
}
