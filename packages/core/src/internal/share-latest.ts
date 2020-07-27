import { Observable, Subscription, Subject } from "rxjs"
import { SUSPENSE } from "../SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"
import { noop } from "./noop"
import { COMPLETE } from "./COMPLETE"

const shareLatest = <T>(
  source$: Observable<T>,
  teardown = noop,
): BehaviorObservable<T> => {
  let subject: Subject<T> | undefined
  let subscription: Subscription | undefined
  let refCount = 0
  let currentValue: T = EMPTY_VALUE

  const result = new Observable<T>((subscriber) => {
    refCount++
    let innerSub: Subscription
    if (!subject) {
      subject = new Subject<T>()
      innerSub = subject.subscribe(subscriber)
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
          subject!.next(COMPLETE as any)
        },
      )
      if (subscription.closed) subscription = undefined
    } else {
      innerSub = subject.subscribe(subscriber)
      if (currentValue !== EMPTY_VALUE) {
        subscriber.next(currentValue)
        if (!subscription) {
          subscriber.next(COMPLETE as any)
        }
      }
    }

    return () => {
      refCount--
      innerSub.unsubscribe()
      if (refCount === 0) {
        currentValue = EMPTY_VALUE
        if (subject !== undefined) {
          teardown()
        } else {
          setTimeout(teardown, 200)
        }
        subject = undefined
        if (subscription) {
          subscription.unsubscribe()
          subscription = undefined
        }
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
