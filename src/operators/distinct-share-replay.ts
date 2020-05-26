import { Observable, ReplaySubject, concat, NEVER } from "rxjs"
import { distinctUntilChanged, multicast, refCount } from "rxjs/operators"

const distinctShareReplay = <T>(compare?: (a: T, b: T) => boolean) => (
  source$: Observable<T>,
): Observable<T> =>
  source$.pipe(
    distinctUntilChanged(compare),
    innerSource => concat(innerSource, NEVER),
    multicast(() => new ReplaySubject<T>(1)),
    refCount(),
  )

export default distinctShareReplay
