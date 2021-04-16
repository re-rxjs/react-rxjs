import { useEffect, useState, useRef } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { Subscription } from "rxjs"

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  subscription?: Subscription,
): Exclude<O, typeof SUSPENSE> => {
  const [state, setState] = useState<[O, BehaviorObservable<O>]>(() => [
    source$.gV(subscription),
    source$,
  ])
  const prevStateRef = useRef<O | (() => O)>(state[0])

  if (source$ !== state[1]) {
    setState([source$.gV(subscription), source$])
  }

  useEffect(() => {
    const suspend = () => {
      setState(() => [source$.gV(), source$])
    }

    const subscription = source$.subscribe(
      (value: O | typeof SUSPENSE) => {
        if (value === SUSPENSE) {
          suspend()
        } else {
          if (!Object.is(prevStateRef.current, value)) {
            setState([(prevStateRef.current = value), source$])
          }
        }
      },
      (error: any) => {
        setState(() => {
          throw error
        })
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [source$])

  return state[0] as Exclude<O, typeof SUSPENSE>
}
