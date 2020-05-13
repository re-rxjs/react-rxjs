import { Observable } from "rxjs"
import { useEffect, useState } from "react"
import reactOperator from "./react-operator"
import { batchUpdates } from "./batch-updates"

export interface ConnectFactoryObservableOptions {
  suspenseTime?: number
  gracePeriod?: number
}

interface FactoryObservableOptions {
  suspenseTime: number
  subscriptionGraceTime: number
}

const defaultOptions: FactoryObservableOptions = {
  suspenseTime: 200,
  subscriptionGraceTime: 100,
}

export function connectFactoryObservable<
  I,
  A extends (number | string | boolean | null)[],
  O
>(
  getObservable: (...args: A) => Observable<O>,
  initialValue: I,
  options_?: Partial<FactoryObservableOptions>,
): [(...args: A) => O | I, (...args: A) => Observable<O>] {
  const { suspenseTime, subscriptionGraceTime } = {
    ...options_,
    ...defaultOptions,
  }
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
      subscriptionGraceTime,
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

        const subscription = batchUpdates(
          getReactObservable$(...input),
        ).subscribe(value => {
          if (timeoutToken !== null) clearTimeout(timeoutToken)
          setValue(value)
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
