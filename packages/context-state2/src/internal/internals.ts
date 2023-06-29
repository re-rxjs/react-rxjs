import { defer } from "rxjs"
import type { KeysBaseType, StateNode } from "../types"
import { InternalStateNode } from "./state-node"

const internals = new WeakMap<
  StateNode<any, any>,
  InternalStateNode<any, any>
>()

export const getInternals = <T, K extends KeysBaseType>(
  node: StateNode<T, K>,
): InternalStateNode<T, K> => internals.get(node)!

export const setInternals = <T, K extends KeysBaseType>(
  node: StateNode<T, K>,
  internal: InternalStateNode<T, K>,
) => {
  internals.set(node, internal)
}

export function linkPublicInterface<T, K extends KeysBaseType>(
  internal: InternalStateNode<T, K>,
): StateNode<T, K> {
  if (internal.public) {
    return internal.public
  }
  const node: StateNode<T, K> = {
    getState$: (key?: K) =>
      defer(() => internal.getInstance(key ?? ({} as K)).getState$()),
    getValue: (key?: K) => internal.getInstance(key ?? ({} as K)).getValue(),
  }
  internals.set(node, internal)
  internal.public = node
  return node
}
