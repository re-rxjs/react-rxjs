import { StatePromise } from "./internal"
import type { Observable } from "rxjs"

export declare type StringRecord<T> = Record<string, T>

export interface StateNode<T, K extends StringRecord<any>> {
  getValue: {} extends K
    ? (key?: K) => T | StatePromise<T>
    : (key: K) => T | StatePromise<T>
  getState$: {} extends K
    ? (key?: K) => Observable<T>
    : (key: K) => Observable<T>
}

export interface Signal<T, K extends StringRecord<any>> {
  push: {} extends K ? (value: T) => void : (key: K, value: T) => void
  parent: StateNode<any, K>
  getSignal$: {} extends K ? () => Observable<T> : (key: K) => Observable<T>
}

interface GetObservableFn<K> {
  <T, CK extends StringRecord<any>>(
    other: K extends CK ? StateNode<T, CK> | Signal<T, CK> : never,
  ): Observable<T>
  <T, CK extends StringRecord<any>>(
    other: StateNode<T, CK> | Signal<T, CK>,
    keys: Omit<CK, keyof K>,
  ): Observable<T>
}

export type CtxFn<T, K extends StringRecord<any>> = (
  ctxValue: <CT>(node: StateNode<CT, any>) => CT,
  ctxObservable: GetObservableFn<K>,
  key: K,
) => Observable<T>
