import { MonoTypeOperatorFunction, ReplaySubject, share } from "rxjs"

/**
 * A RxJS pipeable operator which shares and replays the latest emitted value.
 * It's the equivalent of:
 *
 * ```ts
 * share<T>({
 *   connector: () => new ReplaySubject<T>(1),
 *   resetOnError: true,
 *   resetOnComplete: true,
 *   resetOnRefCountZero: true,
 * })
 * ```
 */
export const shareLatest = <T>(): MonoTypeOperatorFunction<T> =>
  share<T>({
    connector: () => new ReplaySubject<T>(1),
    resetOnError: true,
    resetOnComplete: true,
    resetOnRefCountZero: true,
  })
