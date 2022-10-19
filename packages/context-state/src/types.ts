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
  getSignal$: {} extends K ? () => Observable<T> : (key: K) => Observable<T>
}

export type CtxFn<T, K extends StringRecord<any>> = (
  ctxValue: <CT>(node: StateNode<CT, any>) => CT,
  ctxObservable: <CT, CK extends StringRecord<any>>(
    node: StateNode<CT, CK> | Signal<CT, CK>,
    key: Omit<CK, keyof K>,
  ) => Observable<CT>,
  key: K,
) => Observable<T>
