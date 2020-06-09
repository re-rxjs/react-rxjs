import { Observable, of, Subscription, Subject, race } from "rxjs"
import { delay, takeUntil, take, filter, tap } from "rxjs/operators"
import { BehaviorObservable } from "./distinct-share-replay"
import { SUSPENSE } from "../"

const IS_SSR =
  typeof window === "undefined" ||
  typeof window.document === "undefined" ||
  typeof window.document.createElement === "undefined"
const noop = Function.prototype as () => void

const delayUnsubscription = <T>(delayTime: number) => (
  source$: Observable<T>,
): BehaviorObservable<T> => {
  let finalizeLastUnsubscription = noop
  const onSubscribe = new Subject()
  const result = new Observable<T>(subscriber => {
    let isActive = true
    const subscription = source$.subscribe({
      next(value) {
        if (isActive) {
          subscriber.next(value)
        }
      },
      error(e) {
        subscriber.error(e)
      },
      complete() {
        subscriber.complete()
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
  const getValue = () => {
    try {
      return (source$ as BehaviorObservable<T>).getValue()
    } catch (e) {
      if (promise) throw promise

      if (!IS_SSR && e !== SUSPENSE) {
        source$
          .pipe(takeUntil(race(onSubscribe, of(true).pipe(delay(60000)))))
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
        tap(() => {
          promise = undefined
        }),
      )
      .toPromise()
    throw promise
  }

  result.getValue = getValue as () => T
  return result
}

export default delayUnsubscription
