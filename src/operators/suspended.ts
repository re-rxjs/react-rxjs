import { suspend } from "./suspend"

/**
 * A RxJS pipeable operator that prepends a SUSPENSE on the source observable.
 */
export const suspended = () => suspend
