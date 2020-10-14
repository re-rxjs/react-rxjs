import { useEffect, useState } from "react"
import { SUSPENSE } from "../SUSPENSE"
import { EMPTY_VALUE } from "./empty-value"
import { Observable } from "rxjs"

export const useObservable = <O>(
  source$: Observable<O>,
  getValue: () => O,
): Exclude<O, typeof SUSPENSE> => {
  const [state, setState] = useState(getValue)

  useEffect(() => {
    let prevVal: O | typeof SUSPENSE = EMPTY_VALUE
    let err: any = EMPTY_VALUE

    const onNext = (value: O | typeof SUSPENSE) => {
      if (value === SUSPENSE) {
        setState(getValue)
      } else if (!Object.is(value, prevVal)) {
        setState(value)
      }
      prevVal = value
    }
    const onError = (error: any) => {
      err = error
      setState(() => {
        throw error
      })
    }

    let subscription = source$.subscribe(onNext, onError)
    if (err !== EMPTY_VALUE) return
    if (prevVal === EMPTY_VALUE) onNext(SUSPENSE)
    const t = subscription
    subscription = source$.subscribe(onNext, onError)
    t.unsubscribe()

    return () => subscription.unsubscribe()
  }, [source$])

  return state as Exclude<O, typeof SUSPENSE>
}
