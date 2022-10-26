import { StateNode, StringRecord } from "../types"

export interface RunFn {
  (key: any[], isActive: boolean, isParentLoaded?: boolean): void
}

export interface InternalStateNode<T, K extends StringRecord<any>> {
  run: RunFn
  parents: InternalStateNode<any, any> | Array<InternalStateNode<any, any>>
  isRunning: (key: any[]) => false | Array<() => void>
  childRunners: Array<RunFn>
  isActive: (key: any[]) => boolean | Error
  keysOrder: Array<string>
  public: StateNode<T, K>
}

const internals = new WeakMap<
  StateNode<any, any>,
  InternalStateNode<any, any>
>()

export const addInternals = <T, K extends StringRecord<any>>(
  node: StateNode<T, K>,
  internal: InternalStateNode<T, K>,
): void => {
  internals.set(node, internal)
}

export const getInternals = <T, K extends StringRecord<any>>(
  node: StateNode<T, K>,
): InternalStateNode<T, K> => internals.get(node)!
