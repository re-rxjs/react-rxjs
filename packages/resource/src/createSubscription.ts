import { Observable, BehaviorSubject } from "rxjs"
import { filter, first } from "rxjs/operators"
import { SUSPENSE } from "@react-rxjs/core"

export interface SubscriptionResource<T> {
  getValue: () => T
  close: () => void
  subscribe: (callback: () => void) => () => void
}

export function createSubscription<T>(
  source: Observable<T>,
): SubscriptionResource<T> {
  const value$ = new BehaviorSubject<T | typeof SUSPENSE>(SUSPENSE)
  const subscription = source.subscribe(value$)

  return {
    getValue: () => {
      if (value$.hasError) {
        throw value$.thrownError
      }
      const value = value$.getValue()
      if (value === SUSPENSE) {
        throw value$
          .pipe(
            filter((v) => v !== SUSPENSE),
            first(),
          )
          .toPromise()
      }
      return value
    },
    close: () => {
      subscription.unsubscribe()
      value$.unsubscribe()
    },
    subscribe: (cb) => {
      const innerSub = value$.subscribe(cb, cb, cb)
      return () => innerSub.unsubscribe()
    },
  }
}
