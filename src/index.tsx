import { setBatch } from "./utils/batch"
import { unstable_batchedUpdates as batch } from "./utils/react-batched-updates"
setBatch(batch as any)

export { connectObservable } from "./connectObservable"
export { connectFactoryObservable } from "./connectFactoryObservable"
export { distinctShareReplay } from "./operators/distinct-share-replay"
export { useObservable } from "./useObservable"
export { createInput } from "./createInput"
export const SUSPENSE = Symbol("SUSPENSE")
