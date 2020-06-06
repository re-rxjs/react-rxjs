import { Observable, of, Subscription } from "rxjs"
import { delay } from "rxjs/operators"

const noop = Function.prototype as () => void

const delayUnsubscription = <T>(delayTime: number) => (
  source$: Observable<T>,
): Observable<T> => {
  if (delayTime === 0) {
    return source$
  }
  let finalizeLastUnsubscription = noop
  return new Observable<T>(subscriber => {
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
  })
}

export default delayUnsubscription
