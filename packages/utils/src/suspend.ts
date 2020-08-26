import { ObservableInput, from } from "rxjs"
import { startWith } from "rxjs/operators"
import { SUSPENSE } from "@react-rxjs/core"

/**
 * A RxJS creation operator that prepends a SUSPENSE on the source observable.
 *
 * @param source$ Source observable
 */
export const suspend = <T>(source$: ObservableInput<T>) =>
  from(source$).pipe(startWith(SUSPENSE))
