import { useObservable } from "./internal/useObservable"
import { SUSPENSE } from "./SUSPENSE"
import type { StateObservable } from "@josepot/rxjs-state"

export const useStateObservable = <T>(
  stateObservable: StateObservable<T>,
): Exclude<T, typeof SUSPENSE> => useObservable(stateObservable)
