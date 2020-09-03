import { Observable } from "rxjs"
import { take, filter, tap } from "rxjs/operators"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"
import { noop } from "./noop"
import { COMPLETE } from "./COMPLETE"

const reactEnhancer = <T>(source$: Observable<T>): BehaviorObservable<T> => {
  let refCount = 0
  let finalizeLastUnsubscription = noop

  const result = new Observable<T>((subscriber) => {
    refCount++
    let isActive = true
    let latestValue = EMPTY_VALUE
    const subscription = source$.subscribe(
      (value) => {
        if (
          isActive &&
          value !== (COMPLETE as any) &&
          !Object.is(latestValue, value)
        ) {
          subscriber.next((latestValue = value))
        }
      },
      (e) => {
        subscriber.error(e)
      },
    )
    finalizeLastUnsubscription()
    return () => {
      refCount--
      if (refCount > 0 || subscription.closed) {
        return subscription.unsubscribe()
      }

      isActive = false
      const timeoutToken = setTimeout(() => {
        finalizeLastUnsubscription()
      }, 250)

      finalizeLastUnsubscription = () => {
        clearTimeout(timeoutToken)
        subscription.unsubscribe()
        finalizeLastUnsubscription = noop
      }
    }
  }) as BehaviorObservable<T>

  let promise: any
  let error = EMPTY_VALUE
  const getValue = () => {
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
        type: "v",
        payload: (source$ as BehaviorObservable<T>).getValue(),
      }
    } catch (e) {
      if (promise) return promise

      let value = EMPTY_VALUE
      promise = {
        type: "s",
        payload: result
          .pipe(
            filter((value) => value !== (SUSPENSE as any)),
            take(1),
            tap({
              next(v) {
                value = v
              },
              error(e) {
                error = { type: "e", payload: e }
                timeoutToken = setTimeout(() => {
                  error = EMPTY_VALUE
                }, 50)
              },
            }),
          )
          .toPromise()
          .catch(() => {})
          .finally(() => {
            promise = undefined
          }),
      }

      if (value !== EMPTY_VALUE) {
        return { type: "v", payload: value }
      }

      if (error !== EMPTY_VALUE) {
        return error
      }

      return promise
    }
  }
  result.getValue = getValue as () => T | Promise<T>
  return result
}

export default reactEnhancer
