import { Observable } from "rxjs"
import { debounceTime } from "rxjs/operators"

export const batchUpdates: <T>(
  source: Observable<T>,
) => Observable<T> = debounceTime(0)

export default batchUpdates
