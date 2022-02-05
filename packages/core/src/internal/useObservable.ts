import { useState, useRef, useCallback } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { Subscription } from "rxjs"
// @ts-ignore
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { EMPTY_VALUE } from "./empty-value"

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  subscription?: Subscription,
): Exclude<O, typeof SUSPENSE> => {
  const [, setError] = useState(null)

  const prevStateRef = useRef<O>(EMPTY_VALUE)

  return useSyncExternalStore(
    useCallback(
      (callback: () => void) => {
        const sub = source$.subscribe({
          next: (value) => {
            if (!Object.is(prevStateRef.current, value)) {
              prevStateRef.current = value
              callback()
            }
          },
          error: (error: any) => {
            setError(() => {
              throw error
            })
          },
        })
        return () => sub.unsubscribe()
      },
      [source$],
    ),
    useCallback(() => source$.gV(subscription), [source$, subscription]),
  )
}
