import {
  globalRunners,
  globalParents,
  mapRecord,
  detachedNode,
  recordEntries,
  globalChildRunners,
} from "./internal"
import { of } from "rxjs"
import { substate } from "./substate"
import { StateNode, Ctx } from "./types"

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
  O extends { [P in keyof any]: ((value: T) => any) | null },
  OT extends {
    [K in keyof O]: null extends O[K]
      ? StateNode<T>
      : O[K] extends (value: T) => infer V
      ? StateNode<V>
      : unknown
  },
>(
  parent: StateNode<T>,
  routes: O,
  selector: (value: T, ctx: Ctx) => keyof O,
): [StateNode<keyof O>, OT] => {
  const keys = new Set(Object.keys(routes))
  const keyState = substate(parent, (ctx) => {
    const key = selector(ctx(parent), ctx) as string
    if (!keys.has(key)) throw new InvalidRouteError(key, [...keys])
    return of(key)
  })

  const routedState = mapRecord(routes, (mapper) => {
    const result = detachedNode<any>((ctx) => {
      const parentValue = ctx(parent)
      return of(mapper ? mapper(parentValue) : parentValue)
    })
    globalParents.set(result, keyState)
    return result
  })

  const runners = new Map(
    recordEntries(routedState).map(([key, value]) => [
      key,
      globalRunners.get(value)!,
    ]),
  )

  const run = (ctxKey: any[], isActive: boolean, isParentLoaded?: boolean) => {
    const activeKey =
      isActive && isParentLoaded ? keyState.getValue(...ctxKey) : null
    runners.forEach((runner, key) => {
      if (key === activeKey) runner(ctxKey, true, true)
      else runner(ctxKey, false)
    })
  }

  globalChildRunners.get(keyState)!.push(run)

  return [keyState, routedState as OT]
}
