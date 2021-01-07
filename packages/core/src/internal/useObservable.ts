import { useEffect, useState } from "react"
import { Observable } from "rxjs"
import { SUSPENSE } from "../SUSPENSE"
import { EMPTY_VALUE } from "./empty-value"

export const useObservable = <O>(
  source$: Observable<O>,
  getValue: () => O,
  keys: Array<any>,
): Exclude<O, typeof SUSPENSE> => {
  const [state, setState] = useState(getValue)

  useEffect(() => {
    let err: any = EMPTY_VALUE
    let syncVal: O | typeof SUSPENSE = EMPTY_VALUE

    const onError = (error: any) => {
      err = error
      setState(() => {
        throw error
      })
    }

    let subscription = source$.subscribe((val) => {
      syncVal = val
    }, onError)
    if (err !== EMPTY_VALUE) return

    const defaultValue = (getValue as any).d
    if (syncVal === EMPTY_VALUE) {
      setState(defaultValue === EMPTY_VALUE ? getValue : () => defaultValue)
    }

    const t = subscription
    subscription = source$.subscribe((value: O | typeof SUSPENSE) => {
      setState(value === SUSPENSE ? getValue : () => value)
    }, onError)
    t.unsubscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, keys)

  return state as Exclude<O, typeof SUSPENSE>
}
