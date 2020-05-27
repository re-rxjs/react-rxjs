import { Observable, ReplaySubject, concat, NEVER } from "rxjs"
import {
  distinctUntilChanged,
  multicast,
  refCount,
  finalize,
} from "rxjs/operators"

const distinctShareReplay = <T>(
  compare?: (a: T, b: T) => boolean,
  tearDown?: () => void,
) => (source$: Observable<T>): Observable<T> =>
  source$.pipe(
    distinctUntilChanged(compare),
    innerSource => concat(innerSource, NEVER),
    tearDown ? finalize(tearDown) : x => x,
    multicast(() => new ReplaySubject<T>(1)),
    refCount(),
  )

export default distinctShareReplay
