import { Observable, of, Subscription, Subject, race } from "rxjs"
import { delay, takeUntil, take, filter, tap, catchError } from "rxjs/operators"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"
import { noop } from "./noop"
import { COMPLETE } from "./COMPLETE"

const IS_SSR =
  typeof window === "undefined" ||
  typeof window.document === "undefined" ||
  typeof window.document.createElement === "undefined"

const reactEnhancer = <T>(
  source$: Observable<T>,
  delayTime: number,
): BehaviorObservable<T> => {
  let finalizeLastUnsubscription = noop
  const onSubscribe = new Subject()
  const result = new Observable<T>(subscriber => {
    let isActive = true
    let latestValue = EMPTY_VALUE
    const subscription = source$.subscribe({
      next(value) {
        if (
          isActive &&
          value !== (COMPLETE as any) &&
          !Object.is(latestValue, value)
        ) {
          subscriber.next((latestValue = value))
        }
      },
      error(e) {
        subscriber.error(e)
      },
    })
    onSubscribe.next()
    finalizeLastUnsubscription()
    return () => {
      finalizeLastUnsubscription()
      isActive = false
      let timeoutSub: Subscription | undefined =
        delayTime < Infinity
          ? of(null)
              .pipe(delay(delayTime))
              .subscribe(() => {
                timeoutSub = undefined
                subscription.unsubscribe()
              })
          : undefined
      finalizeLastUnsubscription = () => {
        timeoutSub?.unsubscribe()
        subscription.unsubscribe()
        finalizeLastUnsubscription = noop
      }
    }
  }) as BehaviorObservable<T>

  let promise: any
  let hasError = false
  let error: unknown = undefined
  const getValue = () => {
    if (hasError) {
      throw error
    }
    try {
      return (source$ as BehaviorObservable<T>).getValue()
    } catch (e) {
      if (promise) throw promise

      if (!IS_SSR && e !== SUSPENSE) {
        source$
          .pipe(
            takeUntil(race(onSubscribe, of(true).pipe(delay(60000)))),
            catchError(() => of(true)),
          )
          .subscribe()
        try {
          return (source$ as BehaviorObservable<T>).getValue()
        } catch (e) {}
      }
    }
    promise = source$
      .pipe(
        filter(value => value !== (SUSPENSE as any)),
        take(1),
        tap(
          () => {
            promise = undefined
          },
          err => {
            hasError = true
            error = err
          },
        ),
      )
      .toPromise()
    throw promise
  }

  result.getValue = getValue as () => T
  return result
}

export default reactEnhancer
