import { Observable } from "rxjs"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable, Action } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"

const reactEnhancer = <T>(source$: Observable<T>): BehaviorObservable<T> => {
  const result = new Observable<T>((subscriber) => {
    let latestValue = EMPTY_VALUE
    return source$.subscribe(
      (value) => {
        if (!Object.is(latestValue, value)) {
          subscriber.next((latestValue = value))
        }
      },
      (e) => {
        subscriber.error(e)
      },
    )
  }) as BehaviorObservable<T>

  let promise: undefined | { type: Action.Suspense; payload: Promise<T | void> }
  let error:
    | typeof EMPTY_VALUE
    | { type: Action.Error; payload: any } = EMPTY_VALUE
  const getValue = (): { type: Action; payload: any } => {
    let timeoutToken
    if (error !== EMPTY_VALUE) {
      clearTimeout(timeoutToken)
      timeoutToken = setTimeout(() => {
        error = EMPTY_VALUE
      }, 50)
      return error
    }

    try {
      return {
        type: Action.Value,
        payload: (source$ as BehaviorObservable<T>).getValue(),
      }
    } catch (e) {
      if (promise) return promise

      let value:
        | typeof EMPTY_VALUE
        | { type: Action.Value; payload: T } = EMPTY_VALUE

      promise = {
        type: Action.Suspense,
        payload: new Promise<T>((res) => {
          const subscription = result.subscribe(
            (v) => {
              if (v !== (SUSPENSE as any)) {
                value = { type: Action.Value, payload: v }
                subscription && subscription.unsubscribe()
                res(v)
              }
            },
            (e) => {
              error = { type: Action.Error, payload: e }
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
        }),
      }

      if (value !== EMPTY_VALUE) {
        return value
      }

      return error !== EMPTY_VALUE ? error : promise
    }
  }
  result.getValue = getValue
  return result
}

export default reactEnhancer
