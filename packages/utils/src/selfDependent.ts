import { Observable, Subject, MonoTypeOperatorFunction } from "rxjs"
import { tap } from "rxjs/operators"

/**
 * A creation operator that helps at creating observables that have circular
 * dependencies
 *
 * @returns [1, 2]
 * 1. The inner subject as an Observable
 * 2. A pipable operator that taps into the inner Subject
 */
export const selfDependent = <T>(): [
  Observable<T>,
  () => MonoTypeOperatorFunction<T>,
] => {
  const mirrored$ = new Subject<T>()
  return [
    mirrored$.asObservable(),
    () => tap(mirrored$) as MonoTypeOperatorFunction<T>,
  ]
}

/**
 * @deprecated renamed to `selfDependent`
 */
export const selfDependant = selfDependent
