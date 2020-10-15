import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"

const reactEnhancer = <T>(
  source$: BehaviorObservable<T>,
  defaultValue: T,
): (() => T) => {
  let promise: Promise<T | void> | null
  let error: any = EMPTY_VALUE

  const res = (): T => {
    const currentValue = source$.getValue()
    if (currentValue !== SUSPENSE && currentValue !== EMPTY_VALUE) {
      return currentValue
    }
    if (defaultValue !== EMPTY_VALUE) return defaultValue

    let timeoutToken
    if (error !== EMPTY_VALUE) {
      clearTimeout(timeoutToken)
      timeoutToken = setTimeout(() => {
        error = EMPTY_VALUE
      }, 50)
      throw error
    }

    if (promise) throw promise

    let value: typeof EMPTY_VALUE | T = EMPTY_VALUE

    promise = new Promise<T>((res) => {
      const subscription = source$.subscribe(
        (v) => {
          if (v !== (SUSPENSE as any)) {
            value = v
            subscription && subscription.unsubscribe()
            res(v)
          }
        },
        (e) => {
          error = e
          timeoutToken = setTimeout(() => {
            error = EMPTY_VALUE
          }, 50)
          res()
        },
      )
      if (value !== EMPTY_VALUE) {
        subscription.unsubscribe()
      }
    }).finally(() => {
      promise = null
    })

    if (value !== EMPTY_VALUE) {
      promise = null
      return value
    }

    throw error !== EMPTY_VALUE ? error : promise
  }
  res.d = defaultValue
  return res
}

export default reactEnhancer
