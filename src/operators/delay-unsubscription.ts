import { Observable } from "rxjs"

const delayUnsubscription = <T>(delayTime: number) => (
  source$: Observable<T>,
): Observable<T> =>
  delayTime === 0
    ? source$
    : new Observable<T>(subscriber => {
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
        return () => {
          isActive = false
          setTimeout(() => {
            subscription.unsubscribe()
          }, delayTime)
        }
      })

export default delayUnsubscription
