import {
  DefaultedStateObservable,
  state as coreState,
  StateObservable,
} from "@rx-state/core"
import React from "react"
import { ReactElement } from "react"
import { Observable } from "rxjs"
import { useStateObservable } from "./useStateObservable"

export type JSXStateObservable<T> = StateObservable<T> & ReactElement
export type JSXDefaultedStateObservable<T> = DefaultedStateObservable<T> &
  ReactElement

/// Copy-pasted types from rx-state/core that use the new JSX
/// TODO Maybe it can be done without re-exporting it? like just enhancing the original interface
/**
 * Creates a StateObservable
 *
 * @param {Observable<T>} observable - Source observable
 * @param {T} [defaultValue] - Default value that will be used if the source
 * has not emitted.
 * @returns A StateObservable, which can be used for composing other streams that
 * depend on it. The shared subscription is closed as soon as there are no
 * subscribers, also the state is cleared.
 *
 * @remarks If the source Observable doesn't synchronously emit a value upon
 * subscription, then the state Observable will synchronously emit the
 * defaultValue if present.
 */
export function state<T>(
  observable: Observable<T>,
  defaultValue: T,
): JSXDefaultedStateObservable<T>
export function state<T>(observable: Observable<T>): JSXStateObservable<T>
/**
 * Creates a factory of StateObservables
 *
 * @param getObservable - Factory of Observables.
 * @param [defaultValue] - Function or value that will be used if the source
 * has not emitted.
 * @returns A function with the same parameters as the factory function, which
 * returns the StateObservable for those arguements, which can be used for
 * composing other streams that depend on it. The shared subscription is closed
 * as soon as there are no subscribers, also the state and all in memory
 * references to the returned Observable are cleared.
 *
 * @remarks If the Observable doesn't synchronously emit a value upon the first
 * subscription, then the state Observable will synchronously emit the
 * defaultValue if present.
 */
export function state<A extends unknown[], O>(
  getObservable: (...args: A) => Observable<O>,
  defaultValue: O | ((...args: A) => O),
): (...args: AddStopArg<A>) => JSXDefaultedStateObservable<O>
export function state<A extends unknown[], O>(
  getObservable: (...args: A) => Observable<O>,
): (...args: AddStopArg<A>) => JSXStateObservable<O>

export function state(...args: any[]): any {
  const result = (coreState as any)(...args)

  if (typeof result === "function") {
    return (...args: any[]) => enhanceState(result(...args))
  }
  return enhanceState(result)
}

// Adds an additional "stop" argument to prevent using factory functions
// inside high-order-functions directly (e.g. switchMap(factory$))
type AddStopArg<A extends Array<any>> = number extends A["length"]
  ? A
  : [...args: A, _stop?: undefined]

function StateValue(props: { state$: StateObservable<any> }) {
  return useStateObservable(props.state$)
}

function enhanceState<T>(state$: StateObservable<T>) {
  const element = <StateValue state$={state$} />
  return Object.assign(state$, element)
}
