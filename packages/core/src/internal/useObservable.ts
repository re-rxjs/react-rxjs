import { useEffect, useState, useRef } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { EMPTY_VALUE } from "./empty-value"
import { Observable } from "rxjs"

export const useObservable = <O>(
  source$: Observable<O>,
  getValue: () => O,
): Exclude<O, typeof SUSPENSE> => {
  const [state, setState] = useState(getValue)
  const prevStateRef = useRef<O | (() => O)>(state)

  useEffect(() => {
    let err: any = EMPTY_VALUE
    let syncVal: O | typeof SUSPENSE = EMPTY_VALUE
    const onError = (error: any) => {
      err = error
      setState(() => {
        throw error
      })
    }

    let subscription = source$.subscribe((val) => (syncVal = val), onError)
    if (err !== EMPTY_VALUE) return

    const set = (val: O | (() => O)) => {
      if (!Object.is(val, prevStateRef.current)) {
        setState((prevStateRef.current = val))
      }
    }

    if (syncVal === EMPTY_VALUE) set(getValue)
    const t = subscription
    subscription = source$.subscribe((value: O | typeof SUSPENSE) => {
      set(value === SUSPENSE ? getValue : value)
    }, onError)
    t.unsubscribe()

    return () => subscription.unsubscribe()
  }, [source$])

  return state as Exclude<O, typeof SUSPENSE>
}
