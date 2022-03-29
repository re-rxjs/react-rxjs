import { Subscription } from "rxjs"
import { useRef, useState } from "react"
import { SUSPENSE, filterOutSuspense } from "../SUSPENSE"
import { DefaultedStateObservable, StateObservable } from "@josepot/rxjs-state"
import { EMPTY_VALUE } from "./empty-value"
import useSyncExternalStore from "./useSyncExternalStore"

type VoidCb = () => void

interface Ref<T> {
  source$: StateObservable<T>
  args: [(cb: VoidCb) => VoidCb, () => Exclude<T, typeof SUSPENSE>]
}

export const useObservable = <O>(
  source$: StateObservable<O>,
  subscription?: Subscription,
): Exclude<O, typeof SUSPENSE> => {
  const [, setError] = useState()
  const callbackRef = useRef<Ref<O>>()

  if (!callbackRef.current) {
    const getValue = (src: StateObservable<O>) => {
      const result = src.getValue(filterOutSuspense)
      if (result instanceof Promise) throw result
      return result as any
    }

    const gv: <T>() => Exclude<T, typeof SUSPENSE> = () => {
      const src = callbackRef.current!.source$ as DefaultedStateObservable<O>

      if (src.getRefCount() > 0 || src.getDefaultValue) return getValue(src)

      if (!subscription) throw new Error("Missing Subscribe!")

      let error = EMPTY_VALUE
      subscription.add(
        src.subscribe({
          error: (e) => {
            error = e
          },
        }),
      )
      if (error !== EMPTY_VALUE) throw error
      return getValue(src)
    }

    callbackRef.current = {
      source$: null as any,
      args: [, gv] as any,
    }
  }

  const ref = callbackRef.current
  if (ref.source$ !== source$) {
    ref.source$ = source$
    ref.args[0] = (next: () => void) => {
      const subscription = source$.subscribe({
        next,
        error: (e) => {
          setError(() => {
            throw e
          })
        },
      })
      return () => {
        subscription.unsubscribe()
      }
    }
  }

  return useSyncExternalStore(...ref!.args)
}
