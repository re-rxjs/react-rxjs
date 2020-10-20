import { Observable, Subscription, Subject, noop } from "rxjs"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"

const shareLatest = <T>(
  source$: Observable<T>,
  shouldComplete = true,
  teardown = noop,
): BehaviorObservable<T> => {
  let subject: Subject<T> | null
  let subscription: Subscription | null
  let refCount = 0
  let currentValue: T = EMPTY_VALUE

  const result = new Observable<T>((subscriber) => {
    refCount++
    let innerSub: Subscription
    if (!subject) {
      subject = new Subject<T>()
      innerSub = subject.subscribe(subscriber)
      subscription = null
      subscription = source$.subscribe(
        (value) => {
          subject!.next((currentValue = value))
        },
        (err) => {
          const _subject = subject
          subscription = null
          subject = null
          _subject!.error(err)
        },
        () => {
          subscription = null
          shouldComplete && subject!.complete()
        },
      )
      if (subscription.closed) subscription = null
    } else {
      innerSub = subject.subscribe(subscriber)
      if (currentValue !== EMPTY_VALUE) {
        subscriber.next(currentValue)
      }
    }

    return () => {
      refCount--
      innerSub.unsubscribe()
      if (refCount === 0) {
        currentValue = EMPTY_VALUE
        if (subscription) {
          subscription.unsubscribe()
        }
        teardown()
        subject = null
        subscription = null
      }
    }
  }) as BehaviorObservable<T>

  result.getValue = () => currentValue

  return result
}
export default shareLatest
