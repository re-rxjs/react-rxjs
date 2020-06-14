import { setBatch } from "./utils/batch"
import { unstable_batchedUpdates as batch } from "./utils/react-batched-updates"
setBatch(batch as any)

export const SUSPENSE = Symbol("SUSPENSE")
export { connectObservable } from "./connectObservable"
export { connectFactoryObservable } from "./connectFactoryObservable"
export { distinctShareReplay } from "./operators/distinct-share-replay"
export { createInput } from "./createInput"
export { suspend } from "./operators/suspend"
export { suspended } from "./operators/suspended"
export { switchMapSuspended } from "./operators/switchMapSuspended"
