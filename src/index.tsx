import { distinctShareReplay as internalDistinctShareReplay } from "./operators/distinct-share-replay"

// support for React Suspense
export { SUSPENSE } from "./SUSPENSE"
export { suspend } from "./operators/suspend"
export { suspended } from "./operators/suspended"
export { switchMapSuspended } from "./operators/switchMapSuspended"

// core
export { connectObservable } from "./connectObservable"
export { connectFactoryObservable } from "./connectFactoryObservable"

/**
 * A RxJS pipeable operator which performs a custom shareReplay that can be
 * useful when working with these bindings. It's roughly the equivalent of:
 *
 * ```ts
 *  source$.pipe(
 *    distinctUntilChanged(compare),
 *    multicast(() => new ReplaySubject<T>(1)),
 *    refCount(),
 *  )
 * ```
 *
 * @param compareFn Equality function.
 *
 * @remarks The enhanced observables returned from connectObservable and
 * connectFactoryObservable have been enhanced with this operator.
 */
export function distinctShareReplay<T>(compareFn?: (a: T, b: T) => boolean) {
  return internalDistinctShareReplay(compareFn)
}

// utils
export { createInput } from "./createInput"
