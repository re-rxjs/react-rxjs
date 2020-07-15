import { ObservableInput, Observable } from "rxjs"
import { switchMap } from "rxjs/operators"
import { suspend } from "./suspend"

/**
 * Same behaviour as rxjs' `switchMap`, but prepending every new event with
 * SUSPENSE.
 *
 * @param fn Projection function
 */
export const switchMapSuspended = <Input, Output>(
  fn: (input: Input) => ObservableInput<Output>,
) => (src$: Observable<Input>) => src$.pipe(switchMap(x => suspend(fn(x))))
