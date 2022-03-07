import { Subscription } from "rxjs"
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { useRef, useState } from "react"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { SUSPENSE } from "../SUSPENSE"

type VoidCb = () => void

interface Ref<T> {
  args: [(cb: VoidCb) => VoidCb, () => Exclude<T, typeof SUSPENSE>]
  source$: BehaviorObservable<T>
}

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  subscription?: Subscription,
): Exclude<O, typeof SUSPENSE> => {
  const [, setError] = useState()
  const callbackRef = useRef<Ref<O>>()

  if (!callbackRef.current || callbackRef.current.source$ !== source$) {
    callbackRef.current = {
      source$,
      args: [
        (next: () => void) => {
          const subscription = source$.subscribe({
            next,
            error: (e) => {
              setError(() => {
                throw e
              })
            },
          })

          return () => subscription.unsubscribe()
        },
        () => source$.gV(subscription),
      ],
    }
  }
  return useSyncExternalStore(...callbackRef.current!.args)
}
