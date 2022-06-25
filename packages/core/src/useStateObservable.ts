import {
  DefaultedStateObservable,
  liftEffects,
  StateObservable,
  SUSPENSE,
} from "@rx-state/core"
import { useRef, useState } from "react"
import useSyncExternalStore from "./internal/useSyncExternalStore"
import { useSubscription } from "./Subscribe"

type VoidCb = () => void

interface Ref<T, E> {
  source$: StateObservable<T, E>
  args: [(cb: VoidCb) => VoidCb, () => Exclude<T, SUSPENSE>]
}

export const useStateObservable = <O, E>(
  source$: StateObservable<O, E>,
): Exclude<O, typeof SUSPENSE> => {
  const subscription = useSubscription()
  const [, setError] = useState()
  const callbackRef = useRef<Ref<O, E>>()

  if (!callbackRef.current) {
    const getValue = (src: StateObservable<O, E>) => {
      const result = src.getValue()
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
      const subscription = liftEffects()(source$).subscribe({
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
