import {
  DefaultedStateObservable,
  liftSuspense,
  NoSubscribersError,
  StateObservable,
  StatePromise,
  SUSPENSE,
} from "@rx-state/core"
import { useRef, useState } from "react"
import useSyncExternalStore from "./internal/useSyncExternalStore"
import { useSubscription } from "./Subscribe"

type VoidCb = () => void

interface Ref<T> {
  source$: StateObservable<T>
  args: [
    (cb: VoidCb) => VoidCb,
    () => Exclude<T, typeof SUSPENSE>,
    () => Exclude<T, typeof SUSPENSE>,
  ]
}

export const useStateObservable = <O>(
  source$: StateObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const subscription = useSubscription()
  const [, setError] = useState()
  const callbackRef = useRef<Ref<O>>()

  if (!callbackRef.current) {
    const getValue = (src: StateObservable<O>) => {
      const result = src.getValue()
      if (result instanceof StatePromise)
        throw result.catch((e) => {
          if (e instanceof NoSubscribersError) return e
          throw e
        })
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
      args: [, gv, gv] as any,
    }
  }

  const ref = callbackRef.current
  if (ref.source$ !== source$) {
    ref.source$ = source$
    ref.args[0] = (next: () => void) => {
      const subscription = liftSuspense()(source$).subscribe({
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
