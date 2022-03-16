import { Subscription } from "rxjs"
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { useRef, useState } from "react"
import { SUSPENSE } from "../SUSPENSE"
import {
  DefaultedStateObservable,
  StateObservable,
  StatePromise,
} from "@josepot/rxjs-state"
import { EMPTY_VALUE } from "./empty-value"

type VoidCb = () => void

interface Ref<T> {
  args: [(cb: VoidCb) => VoidCb, () => Exclude<T, typeof SUSPENSE>]
  source$: StateObservable<T>
}

function getState<O>(source$: StateObservable<O>): O {
  const result = source$.getValue()
  if (result instanceof StatePromise) throw result
  return result
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
          if (source$.getRefCount() > 0) return getState(source$)
          if (!source$.getDefaultValue)
            return (source$ as any).getDefaultValue()
          if (!subscription) throw new Error("Missing Subscribe!")

          let error = EMPTY_VALUE
          subscription.add(
            source$.subscribe({
              error: (e) => {
                error = e
              },
            }),
          )
          if (error !== EMPTY_VALUE) {
            setError(() => {
              throw error
            })
            throw error
          }
          return getState(source$)
        },
      ],
    }
  }
  return useSyncExternalStore(...callbackRef.current!.args)
}
