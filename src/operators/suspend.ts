import { ObservableInput, from } from "rxjs"
import { startWith } from "rxjs/operators"
import { SUSPENSE } from "../SUSPENSE"

export const suspend = <T>(source$: ObservableInput<T>) =>
  from(source$).pipe(startWith(SUSPENSE))
