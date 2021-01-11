import { useEffect, useState, useRef } from "react"
import { SUSPENSE } from "../SUSPENSE"
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
    const { gV }: { gV: any } = source$

    let isEmtpy = true
    const subscription = source$.aH(
      (value: O | typeof SUSPENSE) => {
        isEmtpy = false
        if (value === SUSPENSE) {
          setState(gV)
        } else {
          if (!Object.is(prevStateRef.current, value)) {
            setState([(prevStateRef.current = value), source$])
          }
        }
      },
      (error: any) => {
        isEmtpy = false
        setState(() => {
          throw error
        })
      },
    )
    if (isEmtpy) setState(gV)

    return () => {
      subscription.unsubscribe()
    }
  }, [source$])

  return state[0] as Exclude<O, typeof SUSPENSE>
}
