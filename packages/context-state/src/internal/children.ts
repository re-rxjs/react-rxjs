import { StateNode } from "../types"

export interface RunFn {
  (key: any[], isActive: boolean, isParentLoaded?: boolean): void
}

export const children = new WeakMap<StateNode<any>, Set<RunFn>>()
