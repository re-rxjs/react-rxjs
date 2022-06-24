import { useRef, useState } from "react"
import { SUSPENSE } from "./SUSPENSE"
import { DefaultedStateObservable, StateObservable } from "@rxstate/core"
import useSyncExternalStore from "./internal/useSyncExternalStore"
import { useSubscription } from "./Subscribe"

type VoidCb = () => void

interface Ref<T> {
  source$: StateObservable<T>
  args: [(cb: VoidCb) => VoidCb, () => Exclude<T, typeof SUSPENSE>]
}

const filterOutSuspense = <T>(value: T): value is Exclude<T, SUSPENSE> =>
  value !== (SUSPENSE as any)

export const useStateObservable = <O>(
  source$: StateObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const subscription = useSubscription()
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
      if (!src.getRefCount() && !src.getDefaultValue) {
        if (!subscription) throw new Error("Missing Subscribe!")
        subscription(src)
      }
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
