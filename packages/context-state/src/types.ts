import { StatePromise } from "./internal"
import type { Observable } from "rxjs"

export declare type StringRecord<T> = {
  [Sym: symbol]: never
  [Num: number]: never
  [Str: string]: T
}

export interface StateNode<T> {
  getValue: (...other: any[]) => T | StatePromise<T>
  state$: (...other: any[]) => Observable<T>
}

export type Ctx = <V>(node: StateNode<V>) => V

/*
export type StateNodeFn<
  Key,
  ReturnType,
  OtherArgs extends Array<any> = [],
> = void extends Key
  ? (...other: OtherArgs) => ReturnType
  : (key: Key, ...other: OtherArgs) => ReturnType

export interface StateNode<
  ID extends string,
  T,
  CTX extends StringRecord<() => any>,
  K extends string | number | bigint | Symbol | void,
> {
  id: ID
  getValue: StateNodeFn<K, T | Promise<T>>
  state$: StateNodeFn<K, Observable<T>>
  ctx: CTX
}
*/
