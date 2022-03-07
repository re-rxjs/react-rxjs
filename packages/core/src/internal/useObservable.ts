import { useSyncExternalStore } from "use-sync-external-store/shim"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { Subscription } from "rxjs"
import { useRef, useState } from "react"

type VoidCb = () => void

interface Ref<T> {
  args: [(cb: VoidCb) => VoidCb, () => T]
  source$: BehaviorObservable<T>
}

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  subscription?: Subscription,
): O => {
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
