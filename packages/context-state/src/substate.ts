import { Observable } from "rxjs"
import type { StateNode } from "./types"
import {
  invalidContext,
  StatePromise,
  children,
  detachedNode,
} from "./internal"

export const ctx = <V>(node: StateNode<V>): V => {
  const value = node.getValue()
  if (value instanceof StatePromise) throw invalidContext()
  return value
}
export type Ctx = typeof ctx

export const substate = <T, P>(
  parent: StateNode<P>,
  getState$: (ctx: Ctx) => Observable<T>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T> => {
  const [result, run] = detachedNode<T, P>(getState$, equalityFn)
  children.get(parent)!.add(run)
  return result
}
