import { Observable } from "rxjs"
import { useEffect, useState } from "react"
import reactOperator from "./react-operator"

export function connectFactoryObservable<
  I,
  A extends (number | string | boolean | null)[],
  O
>(
  getObservable: (...args: A) => Observable<O>,
  initialValue: I,
  suspenseTime: number = 200,
): [(...args: A) => O | I, (...args: A) => Observable<O>] {
  const cache = new Map<string, Observable<O>>()

  const getReactObservable$ = (...input: A): Observable<O> => {
    const key = JSON.stringify(input)
    const cachedVal = cache.get(key)

    if (cachedVal !== undefined) {
      return cachedVal
    }

    const reactObservable$ = reactOperator(
      getObservable(...input),
      initialValue,
      () => {
        cache.delete(key)
      },
    )

    cache.set(key, reactObservable$)
    return reactObservable$
  }

  return [
    (...input: A) => {
      const [value, setValue] = useState<I | O>(initialValue)

      useEffect(() => {
        let timeoutToken: NodeJS.Timeout | null = null
        if (suspenseTime === 0) {
          setValue(initialValue)
        } else if (suspenseTime < Infinity) {
          timeoutToken = setTimeout(() => {
            timeoutToken = null
            setValue(initialValue)
          }, suspenseTime)
        }

        const subscription = getReactObservable$(...input).subscribe(value => {
          setValue(value)
          if (timeoutToken !== null) clearTimeout(timeoutToken)
        })
        return () => {
          subscription.unsubscribe()
          if (timeoutToken !== null) clearTimeout(timeoutToken)
        }
      }, input)

      return value
    },
    getReactObservable$,
  ]
}
