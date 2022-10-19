import {
  mapRecord,
  detachedNode,
  recordEntries,
  getInternals,
} from "./internal"
import { of } from "rxjs"
import { substate } from "./substate"
import { StateNode, CtxFn, StringRecord } from "./types"

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
  K extends StringRecord<any>,
  O extends StringRecord<((value: T) => any) | null>,
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
  selector: (value: T, ctx: CtxFn<T, K>) => keyof O,
): [StateNode<keyof O, K>, OT] => {
  const internalParent = getInternals(parent)
  const keys = new Set(Object.keys(routes))
  const keyState = substate(parent, (ctx) => {
    const key = selector(ctx(parent), ctx as any) as string
    if (!keys.has(key)) throw new InvalidRouteError(key, [...keys])
    return of(key)
  })

  const routedState = mapRecord(routes, (mapper) => {
    const result = detachedNode<any, any>(internalParent.keysOrder, (ctx) => {
      const parentValue = ctx(parent)
      return of(mapper ? mapper(parentValue) : parentValue)
    })
    result.parents = internalParent
    return result
  })

  const runners = new Map(
    recordEntries(routedState).map(([key, value]) => [key, value.run]),
  )

  const run = (ctxKey: any[], isActive: boolean, isParentLoaded?: boolean) => {
    const objKey = {} as any
    internalParent.keysOrder.forEach((keyName, idx) => {
      objKey[keyName] = ctxKey[idx]
    })

    const activeKey =
      isActive && isParentLoaded ? keyState.getValue(objKey) : null
    runners.forEach((runner, key) => {
      if (key === activeKey) runner(ctxKey, true, true)
      else runner(ctxKey, false)
    })
  }

  getInternals(keyState).childRunners.push(run)

  return [keyState, mapRecord(routedState, (x) => x.public) as OT]
}
