import type { CtxFn, StateNode, StringRecord } from "./types"
import { detachedNode, getInternals } from "./internal"

export const substate = <T, P extends StringRecord<any>>(
  parent: StateNode<any, P>,
  getState$: CtxFn<T, P>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T, P> => {
  const internalParent = getInternals(parent)
  const result = detachedNode<T, P>(
    internalParent.keysOrder,
    getState$,
    equalityFn,
  )
  internalParent.childRunners.push(result.run)
  result.parents = internalParent
  return result.public
}
