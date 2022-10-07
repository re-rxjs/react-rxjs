import { StateNode } from "../types"
import { EMPTY_VALUE } from "./empty-value"

export interface RunFn<P> {
  (key: any, isActive: boolean, parentValue?: P | EMPTY_VALUE): void
}

export const children = new WeakMap<StateNode<any>, Set<RunFn<any>>>()
