import internalShareLatest from "../internal/share-latest"
import { MonoTypeOperatorFunction } from "rxjs"

/**
 * A RxJS pipeable operator which shares and replays the latest emitted value.
 * It's the equivalent of:
 *
 * ```ts
 *  source$.pipe(
 *    multicast(() => new ReplaySubject<T>(1)),
 *    refCount(),
 *  )
 * ```
 *
 * @remarks The enhanced observables returned from `connectObservable` and
 * `connectFactoryObservable` have been enhanced with this operator, but do not
 * complete. Meaning that the latest emitted value will be available until the
 * `refCount` drops to zero.
 */
export const shareLatest = <T>() =>
  internalShareLatest<T>() as MonoTypeOperatorFunction<T>
