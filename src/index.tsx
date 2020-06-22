import { Observable } from "rxjs"
import { distinctShareReplay as internalDistinctShareReplay } from "./operators/distinct-share-replay"

// support for React Suspense
export { SUSPENSE } from "./SUSPENSE"
export { suspend } from "./operators/suspend"
export { suspended } from "./operators/suspended"
export { switchMapSuspended } from "./operators/switchMapSuspended"

// core
export { connectObservable } from "./connectObservable"
export { connectFactoryObservable } from "./connectFactoryObservable"
export const distinctShareReplay = internalDistinctShareReplay as <T>(
  compareFn?: (a: T, b: T) => boolean,
) => (source$: Observable<T>) => Observable<T>

// utils
export { createInput } from "./createInput"
