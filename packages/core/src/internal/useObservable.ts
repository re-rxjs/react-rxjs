import { useEffect, useState, useRef } from "react"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { Subscription } from "rxjs"

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  subscription?: Subscription,
): O => {
  const [state, setState] = useState<[O, BehaviorObservable<O>]>(() => [
    source$.gV(subscription),
    source$,
  ])
  const prevStateRef = useRef<O | (() => O)>(state[0])

  if (source$ !== state[1]) {
    setState([source$.gV(subscription), source$])
  }

  useEffect(() => {
    const subscription = source$.subscribe({
      next: (value: O) => {
        if (!Object.is(prevStateRef.current, value)) {
          setState([(prevStateRef.current = value), source$])
        }
      },
      error: (error: any) => {
        setState(() => {
          throw error
        })
      },
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [source$])

  return state[0]
}
