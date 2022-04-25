/**
 * This is a special symbol that can be emitted from our observables to let the
 * react hook know that there is a value on its way, and that we want to
 * leverage React Suspense API while we are waiting for that value.
 */
export const SUSPENSE = Symbol("SUSPENSE")
export type SUSPENSE = typeof SUSPENSE
