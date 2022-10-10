import { Observable } from "rxjs"
import type { Ctx, StateNode } from "./types"
import {
  detachedNode,
  globalChildRunners,
  globalParents,
  globalRunners,
} from "./internal"

export const substate = <T, P>(
  parent: StateNode<P>,
  getState$: (ctx: Ctx) => Observable<T>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T> => {
  const result = detachedNode<T>(getState$, equalityFn)
  globalChildRunners.get(parent)!.push(globalRunners.get(result)!)
  globalParents.set(result, parent)
  return result
}
