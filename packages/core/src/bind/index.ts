import { Observable } from "rxjs"
import connectFactoryObservable from "./connectFactoryObservable"
import connectObservable from "./connectObservable"
import { EMPTY_VALUE } from "../internal/empty-value"
import {
  StateObservable,
  DefaultedStateObservable,
  SUSPENSE,
} from "@rx-state/core"

// Adds an additional "stop" argument to prevent using factory functions
// inside high-order-functions directly (e.g. switchMap(factory$))
type AddStopArg<A extends Array<any>> = number extends A["length"]
  ? A
  : [...args: A, _stop?: undefined]

/**
 * Binds an observable to React
 *
 * @param {Observable<T>} observable - Source observable to be used by the hook.
 * @returns [1, 2]
 * 1. A React Hook that yields the latest emitted value of the observable
 * 2. A `sharedLatest` version of the observable. It can be used for composing
 * other streams that depend on it. The shared subscription is closed as soon as
 * there are no subscribers to that observable.
 *
 * @remarks If the Observable doesn't synchronously emit a value upon the first
 * subscription, then the hook will leverage React Suspense while it's waiting
 * for the first value.
 */
export function bind<T>(
  observable: Observable<T>,
): [() => Exclude<T, typeof SUSPENSE>, StateObservable<T, never>]

/**
 * Binds an observable to React
 *
 * @param {Observable<T>} observable - Source observable to be used by the hook.
 * @param {T} defaultValue - Default value that will be used if the observable
 * has not emitted any values.
 * @returns [1, 2]
 * 1. A React Hook that yields the latest emitted value of the observable
 * 2. A `sharedLatest` version of the observable. It can be used for composing
 * other streams that depend on it. The shared subscription is closed as soon as
 * there are no subscribers to that observable.
 */
export function bind<T>(
  observable: Observable<T>,
  defaultValue: T,
): [() => Exclude<T, typeof SUSPENSE>, DefaultedStateObservable<T, never>]

/**
 * Binds a factory observable to React
 *
 * @param {(...args: any) => Observable<T>} getObservable - Factory of observables. The arguments of this function
 *  will be the ones used in the hook.
 * @returns [1, 2]
 * 1. A React Hook function with the same parameters as the factory function.
 *  This hook will yield the latest update from the observable returned from
 *  the factory function.
 * 2. A `sharedLatest` version of the observable generated by the factory
 *  function that can be used for composing other streams that depend on it.
 *  The shared subscription is closed as soon as there are no subscribers to
 *  that observable.
 *
 * @remarks If the Observable doesn't synchronously emit a value upon the first
 * subscription, then the hook will leverage React Suspense while it's waiting
 * for the first value.
 */
export function bind<A extends unknown[], O>(
  getObservable: (...args: A) => Observable<O>,
): [
  (...args: AddStopArg<A>) => Exclude<O, typeof SUSPENSE>,
  (...args: AddStopArg<A>) => StateObservable<O, never>,
]

/**
 * Binds a factory observable to React
 *
 * @param {(...args: any) => Observable<T>} getObservable - Factory of observables. The arguments of this function
 *  will be the ones used in the hook.
 * @param {T} defaultValue - Function or value that will be used of the observable
 * has not emitted.
 * @returns [1, 2]
 * 1. A React Hook function with the same parameters as the factory function.
 *  This hook will yield the latest update from the observable returned from
 *  the factory function.
 * 2. A `sharedLatest` version of the observable generated by the factory
 *  function that can be used for composing other streams that depend on it.
 *  The shared subscription is closed as soon as there are no subscribers to
 *  that observable.
 */
export function bind<A extends unknown[], O>(
  getObservable: (...args: A) => Observable<O>,
  defaultValue: O | ((...args: A) => O),
): [
  (...args: AddStopArg<A>) => Exclude<O, typeof SUSPENSE>,
  (...args: AddStopArg<A>) => DefaultedStateObservable<O, never>,
]

export function bind(observable: any, defaultValue?: any) {
  return (
    typeof observable === "function"
      ? (connectFactoryObservable as any)
      : connectObservable
  )(observable, arguments.length > 1 ? defaultValue : EMPTY_VALUE)
}
