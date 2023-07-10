import { StatePromise } from "./internal"
import type { Observable } from "rxjs"

export type KeysBaseType = Record<string, unknown>

export interface StateNode<T, K extends KeysBaseType> {
  getValue: {} extends K
    ? (key?: K) => T | StatePromise<T>
    : (key: K) => T | StatePromise<T>
  getState$: {} extends K
    ? (key?: K) => Observable<T>
    : (key: K) => Observable<T>
}

export interface Signal<T, K extends KeysBaseType> {
  push: {} extends K ? (value: T) => void : (key: K, value: T) => void
  getSignal$: {} extends K ? () => Observable<T> : (key: K) => Observable<T>
}
export function isSignal<T, CK extends KeysBaseType>(
  value: StateNode<T, CK> | Signal<T, CK>,
): value is Signal<T, CK> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "push" in value &&
      "getSignal$" in value,
  )
}

export interface GetObservableFn<K> {
  <T, CK extends KeysBaseType>(
    other: K extends CK ? StateNode<T, CK> | Signal<T, CK> : never,
  ): Observable<T>
  <T, CK extends KeysBaseType>(
    other: StateNode<T, CK> | Signal<T, CK>,
    keys: Omit<CK, keyof K>,
  ): Observable<T>
}

export type GetValueFn = <CT>(node: StateNode<CT, any>) => CT

export type CtxFn<T, K extends KeysBaseType> = (
  ctxValue: GetValueFn,
  ctxObservable: GetObservableFn<K>,
  key: K,
) => Observable<T>
