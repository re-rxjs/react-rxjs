import { Observable, Subscription, Subject } from "rxjs"

const defaultCompare = (a: any, b: any) => a === b
function defaultTeardown() {}

const EMPTY_VALUE: any = {}
const distinctShareReplay = <T>(
  compareFn: (a: T, b: T) => boolean = defaultCompare,
  teardown = defaultTeardown,
) => (source$: Observable<T>): Observable<T> => {
  let subject: Subject<T> | undefined
  let subscription: Subscription | undefined
  let refCount = 0
  let currentValue: { value: T }

  return new Observable<T>(subscriber => {
    refCount++
    if (!subject) {
      currentValue = { value: EMPTY_VALUE }
      subject = new Subject<T>()
      subscription = source$.subscribe({
        next(value) {
          if (
            currentValue.value === EMPTY_VALUE ||
            !compareFn(value, currentValue.value)
          ) {
            subject!.next((currentValue.value = value))
          }
        },
        error(err) {
          subscription = undefined
          subject!.error(err)
        },
        complete() {
          subscription = undefined
          subject!.complete()
        },
      })
    }

    if (currentValue.value !== EMPTY_VALUE) {
      subscriber.next(currentValue.value)
    }

    const innerSub = subject.subscribe(subscriber)
    return () => {
      refCount--
      innerSub.unsubscribe()
      if (refCount === 0) {
        currentValue.value = EMPTY_VALUE
        subject = undefined
        teardown()
        if (subscription) {
          subscription.unsubscribe()
          subscription = undefined
        }
      }
    }
  })
}

export default distinctShareReplay
