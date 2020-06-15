import { ObservableInput, Observable } from "rxjs"
import { switchMap } from "rxjs/operators"
import { suspend } from "./suspend"

export const switchMapSuspended = <Input, Output>(
  fn: (input: Input) => ObservableInput<Output>,
) => (src$: Observable<Input>) => src$.pipe(switchMap(x => suspend(fn(x))))
