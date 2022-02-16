import { Subscription } from "rxjs"
// @ts-ignore
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { SUSPENSE } from "../SUSPENSE"

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  subscription?: Subscription,
): Exclude<O, typeof SUSPENSE> => {
  return useSyncExternalStore(source$.sB, source$.gVS(subscription))
}
