import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"

const reactEnhancer = <T>(source$: BehaviorObservable<T>): (() => T) => {
  let promise: Promise<T | void> | undefined
  let error: any = EMPTY_VALUE

  return (): T => {
    const currentValue = source$.getValue()
    if (currentValue !== SUSPENSE && currentValue !== EMPTY_VALUE) {
      return currentValue
    }

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
      promise = undefined
    })

    if (value !== EMPTY_VALUE) {
      promise = undefined
      return value
    }

    throw error !== EMPTY_VALUE ? error : promise
  }
}

export default reactEnhancer
