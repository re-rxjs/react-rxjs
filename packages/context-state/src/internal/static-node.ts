export {}
/*
import { BehaviorSubject, Observable, ReplaySubject } from "rxjs"
import { StringRecord } from "../types"

export interface StateNode<
  ID extends string,
  T,
  CTX extends StringRecord<() => any>,
> {
  id: ID
  getValue: () => T | Promise<T>
  state$: () => Observable<T>
  ctx: CTX
}

const parentsFromChild = new Map<
  StateNode<any, any, any>,
  Array<StateNode<any, any, any>>
>()

const childrenFromParent = new Map<
  StateNode<any, any, any>,
  Array<StateNode<any, any, any>>
>()

export const createStaticNode = <T>(
  parents: StateNode<any, any, any>[],
  isActiveSelector: () => boolean,
  getState$: () => Observable<T>,
) => {
  let currentSubject$: ReplaySubject<T> | null = null

  const run = () => {
    if (currentSubject$) {
      currentSubject$.error(null)
      currentSubject$ = null
    }

    if (parents.every((parent) => parent.isActive())) {
      currentSubject$ = new ReplaySubject<T>(1)
    }
  }
}
*/
