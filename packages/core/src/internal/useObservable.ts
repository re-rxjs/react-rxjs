import { useEffect, useState, useRef } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "../internal/BehaviorObservable"
import { useSubscription } from "../Subscribe"
import { MissingSubscription } from "./MissingSubscription"
import { Subscription } from "rxjs"

const getStateFromSource$ = <T>(
  source$: BehaviorObservable<T>,
  subscription?: Subscription,
): [T, BehaviorObservable<T>] => {
  let value: any = source$.gV()

  if (value === MissingSubscription) {
    let err: any = MissingSubscription

    if (!subscription) throw new Error("Missing Subscribe")

    subscription.add(
      source$.subscribe({
        error: (e) => {
          err = e
        },
      }),
    )

    if (err !== MissingSubscription) throw err

    value = source$.gV()
  }
  return [value, source$]
}

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const subscription = useSubscription()
  const [state, setState] = useState<[O, BehaviorObservable<O>]>(() =>
    getStateFromSource$(source$, subscription),
  )
  const prevStateRef = useRef<O | (() => O)>(state[0])

  if (source$ !== state[1]) {
    setState(getStateFromSource$(source$, subscription))
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
