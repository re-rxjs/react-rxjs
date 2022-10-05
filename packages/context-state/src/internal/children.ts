import { StateNode } from "../types"

export const children = new WeakMap<
  StateNode<any>,
  Set<(isActive: boolean, value: any) => void>
>()
