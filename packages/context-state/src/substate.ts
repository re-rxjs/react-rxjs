import { Observable } from "rxjs"
import type { Ctx, StateNode } from "./types"
import { children, detachedNode } from "./internal"

export const substate = <T, P>(
  parent: StateNode<P>,
  getState$: (ctx: Ctx) => Observable<T>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T> => {
  const [result, run] = detachedNode<T>(getState$, equalityFn)
  children.get(parent)!.add(run)
  return result
}
