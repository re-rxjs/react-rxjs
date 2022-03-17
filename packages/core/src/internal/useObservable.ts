import { Subscription } from "rxjs"
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { useRef, useState } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { DefaultedStateObservable, StateObservable } from "@josepot/rxjs-state"
import { EMPTY_VALUE } from "./empty-value"

type VoidCb = () => void

interface Ref<T> {
  source$: StateObservable<T>
  args: [(cb: VoidCb) => VoidCb, () => Exclude<T, typeof SUSPENSE>]
}

export const useObservable = <O>(
  source$: DefaultedStateObservable<O>,
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
        () => {
          if (source$.getRefCount() > 0 || source$.getDefaultValue) {
            const result = source$.getValue((x) => x !== (SUSPENSE as any))
            if (result instanceof Promise) throw result
            return result as any
          }

          if (!subscription) {
            throw new Error("Missing Subscribe!")
          }

          let error = EMPTY_VALUE
          subscription.add(
            source$.subscribe({
              error: (e) => {
                error = e
              },
            }),
          )
          if (error === EMPTY_VALUE) {
            const result = source$.getValue((x) => x !== (SUSPENSE as any))
            if (result instanceof Promise) throw result
            return result as any
          }

          throw error
        },
      ],
    }
  }
  return useSyncExternalStore(...callbackRef.current!.args)
}
