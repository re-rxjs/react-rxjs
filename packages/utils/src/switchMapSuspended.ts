import {
  ObservableInput,
  Observable,
  OperatorFunction,
  ObservedValueOf,
} from "rxjs"
import { switchMap } from "rxjs/operators"
import { suspend } from "./suspend"
import { SUSPENSE } from "@react-rxjs/core"

/**
 * Same behaviour as rxjs' `switchMap`, but prepending every new event with
 * SUSPENSE.
 *
 * @param fn Projection function
 */
export const switchMapSuspended = <T, O extends ObservableInput<any>>(
  project: (value: T, index: number) => O,
): OperatorFunction<T, ObservedValueOf<O> | typeof SUSPENSE> => (
  src$: Observable<T>,
) => src$.pipe(switchMap((x, index) => suspend(project(x, index))))
