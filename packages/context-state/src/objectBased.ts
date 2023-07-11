import {
  KeysAreCompatible,
  MapKeys,
  StringRecordNodeToStringRecord,
  combineStates,
  CombineStateKeys,
} from "./combineStates"
import { RootNodeKey, createRoot, RootNode as rootNode } from "./create-root"
import { createSignal } from "./create-signal"
import { getInternals, mapRecord, setInternals } from "./internal"
import { routeState } from "./route-state"
import {
  InstanceCtxFn,
  InstanceUpdate,
  MergeKey,
  subinstance,
} from "./subinstance"
import { substate } from "./substate"
import type * as types from "./types"

class StateNode<T, K extends types.KeysBaseType>
  implements types.StateNode<T, K>
{
  constructor(protected node: types.StateNode<T, K>) {
    setInternals(this, getInternals(node))
  }

  getValue: types.StateNode<T, K>["getValue"] = (key: any) =>
    this.node.getValue(key)
  getState$: types.StateNode<T, K>["getState$"] = (key: any) =>
    this.node.getState$(key)

  substate<T>(
    getState$: types.CtxFn<T, K>,
    equalityFn: (a: T, b: T) => boolean = Object.is,
  ): StateNode<T, K> {
    return new StateNode(substate(this.node, getState$, equalityFn))
  }

  subinstance<KN extends string, KV, R>(
    keyName: KN,
    keySelector: types.CtxFn<InstanceUpdate<KV>, K>,
    instanceObs: InstanceCtxFn<R, MergeKey<K, KN, KV>, KV>,
  ) {
    return new SubinstanceNode(this.node, keyName, keySelector, instanceObs)
  }

  routeState<O extends Record<string, ((value: T) => any) | null>>(
    routes: O,
    selector: (value: T, ctx: types.GetValueFn) => string & keyof O,
  ) {
    return new RouteNode(this.node, routes, selector)
  }

  createSignal<R>() {
    return createSignal<R, K>(this.node)
  }
}

export class RootNode<K extends string, V> extends StateNode<
  never,
  RootNodeKey<K, V>
> {
  constructor(keyName?: K) {
    super(keyName ? createRoot(keyName) : createRoot())
  }

  run(key?: V) {
    ;(this.node as rootNode<V, K>).run(key!)
  }
}

type ResultingRoutes<O, T, K extends types.KeysBaseType> = {
  [KOT in keyof O]: null extends O[KOT]
    ? StateNode<T, K>
    : O[KOT] extends (value: T) => infer V
    ? StateNode<V, K>
    : unknown
}

class RouteNode<
  T,
  K extends Record<string, any>,
  O extends Record<string, ((value: T) => any) | null>,
> extends StateNode<keyof O, K> {
  private routeNodes: ResultingRoutes<O, T, K>

  constructor(
    parent: types.StateNode<T, K>,
    routes: O,
    selector: (value: T, ctx: types.GetValueFn) => string & keyof O,
  ) {
    const [resultNode, routeNodes] = routeState(parent, routes, selector)
    super(resultNode)

    this.routeNodes = mapRecord(
      routeNodes,
      (node) => new StateNode(node as types.StateNode<any, any>),
    ) as any
  }

  get route() {
    return this.routeNodes
  }
}

class SubinstanceNode<
  K extends types.KeysBaseType,
  KN extends string,
  KV,
  R,
> extends StateNode<R, MergeKey<K, KN, KV>> {
  private _keys: types.StateNode<Set<KV>, K>

  constructor(
    parent: types.StateNode<unknown, K>,
    keyName: KN,
    keySelector: types.CtxFn<InstanceUpdate<KV>, K>,
    instanceObs: InstanceCtxFn<R, MergeKey<K, KN, KV>, KV>,
  ) {
    const [resultNode, keys] = subinstance(
      parent,
      keyName,
      keySelector,
      instanceObs,
    )
    super(resultNode)

    this._keys = keys
  }

  get keys() {
    return this._keys
  }
}

export { type RouteNode, type StateNode, type SubinstanceNode }

export function combineStateNodes<
  States extends Record<string, types.StateNode<any, any>>,
>(
  states: KeysAreCompatible<MapKeys<States>> extends true ? States : never,
): StateNode<
  StringRecordNodeToStringRecord<States>,
  CombineStateKeys<MapKeys<States>> & types.KeysBaseType
> {
  return new StateNode(combineStates(states))
}
