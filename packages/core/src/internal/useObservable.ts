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
    const suspend = () => {
      setState(() => [source$.gV(), source$])
    }

    let isEmpty = true
    const subscription = source$.aH(
      (value: O | typeof SUSPENSE) => {
        isEmpty = false
        if (value === SUSPENSE) {
          suspend()
        } else {
          if (!Object.is(prevStateRef.current, value)) {
            setState([(prevStateRef.current = value), source$])
          }
        }
      },
      (error: any) => {
        isEmpty = false
        setState(() => {
          throw error
        })
      },
    )
    if (isEmpty) suspend()

    return () => {
      subscription.unsubscribe()
    }
  }, [source$])

  return state[0] as Exclude<O, typeof SUSPENSE>
}
