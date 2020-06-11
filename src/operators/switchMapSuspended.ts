import { ObservableInput, Observable } from "rxjs"
import { switchMap } from "rxjs/operators"
import { suspend } from "./suspend"

export const switchMapSuspended = <T>(fn: (i: T) => ObservableInput<T>) => (
  src$: Observable<T>,
) => src$.pipe(switchMap(x => suspend(fn(x))))
