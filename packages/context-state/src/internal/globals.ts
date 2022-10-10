import { StateNode } from "../types"

export interface RunFn {
  (key: any[], isActive: boolean, isParentLoaded?: boolean): void
}

export const globalParents = new WeakMap<
  StateNode<any>,
  StateNode<any> | Array<StateNode<any>>
>()

export const globalChildRunners = new WeakMap<StateNode<any>, Array<RunFn>>()

export const globalRunners = new WeakMap<StateNode<any>, RunFn>()

export const globalIsActive = new WeakMap<
  StateNode<any>,
  (key: any[]) => boolean | Error
>()
