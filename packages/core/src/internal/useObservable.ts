import { useEffect, useState, useRef } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { EMPTY_VALUE } from "./empty-value"
import { BehaviorObservable } from "../internal/BehaviorObservable"

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const [state, setState] = useState<[O, BehaviorObservable<O>]>(() => [
    source$.gV(),
    source$,
  ])
  const prevStateRef = useRef<O | (() => O)>(state[0])

  if (source$ !== state[1]) {
    setState([source$.gV(), source$])
  }

  useEffect(() => {
    const { gV } = source$
    let err: any = EMPTY_VALUE

    const onError = (error: any) => {
      err = error
      setState(() => {
        throw error
      })
    }

    let subscription = source$.subscribe(null, onError)
    if (err !== EMPTY_VALUE) return

    const set = (value: O) => {
      if (!Object.is(prevStateRef.current, value)) {
        setState([(prevStateRef.current = value), source$])
      }
    }

    const t = subscription
    subscription = source$.subscribe((value: O | typeof SUSPENSE) => {
      if (value !== SUSPENSE) set(value)
      else setState(gV as any)
    }, onError)
    t.unsubscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [source$])

  return state[0] as Exclude<O, typeof SUSPENSE>
}
