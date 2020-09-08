import { Observable, Subscription, Subject, noop } from "rxjs"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"

const shareLatest = <T>(
  source$: Observable<T>,
  shouldComplete = true,
  teardown = noop,
): BehaviorObservable<T> => {
  let subject: Subject<T> | undefined
  let subscription: Subscription | undefined | null
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
          subscription = undefined
          subject = undefined
          _subject!.error(err)
        },
        () => {
          subscription = undefined
          shouldComplete && subject!.complete()
        },
      )
      if (subscription.closed) subscription = undefined
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
        subject = undefined
        subscription = undefined
      }
    }
  }) as BehaviorObservable<T>

  result.getValue = () => {
    if (currentValue === EMPTY_VALUE || currentValue === (SUSPENSE as any)) {
      throw currentValue
    }
    return currentValue
  }

  return result
}
export default shareLatest
