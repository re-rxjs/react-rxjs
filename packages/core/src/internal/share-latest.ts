import { Observable, Subscription, Subject, noop, Subscriber } from "rxjs"
import { BehaviorObservable } from "./BehaviorObservable"
import { EMPTY_VALUE } from "./empty-value"
import { SUSPENSE } from "../SUSPENSE"

const shareLatest = <T>(
  source$: Observable<T>,
  defaultValue: T,
  shouldComplete = true,
  teardown = noop,
): BehaviorObservable<T> => {
  let subject: Subject<T> | null
  let subscription: Subscriber<T> | null
  let refCount = 0
  let currentValue: T = EMPTY_VALUE
  let promise: Promise<T> | null

  const emitIfEmpty =
    defaultValue === EMPTY_VALUE
      ? noop
      : () => {
          currentValue === EMPTY_VALUE &&
            subject &&
            subject!.next((currentValue = defaultValue))
        }

  const result = new Observable<T>((subscriber) => {
    if (!shouldComplete) subscriber.complete = noop

    refCount++
    let innerSub: Subscription

    subscriber.add(() => {
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
        promise = null
      }
    })

    if (!subject) {
      subject = new Subject<T>()
      innerSub = subject.subscribe(subscriber)
      subscription = null
      subscription = new Subscriber<T>({
        next: (value: T) => {
          subject!.next((currentValue = value))
        },
        error: (err: any) => {
          const _subject = subject
          subscription = null
          subject = null
          _subject!.error(err)
        },
        complete: () => {
          subscription = null
          emitIfEmpty()
          subject!.complete()
        },
      })
      source$.subscribe(subscription)
      emitIfEmpty()
    } else {
      innerSub = subject.subscribe(subscriber)
      if (currentValue !== EMPTY_VALUE) {
        subscriber.next(currentValue)
      }
    }
  }) as BehaviorObservable<T>

  result.gV = (
    outterSubscription?: Subscription,
  ): Exclude<T, typeof SUSPENSE> => {
    if ((currentValue as any) !== SUSPENSE && currentValue !== EMPTY_VALUE)
      return currentValue as any

    if (defaultValue !== EMPTY_VALUE) return defaultValue as any

    if (!subscription) {
      if (!outterSubscription) throw new Error("Missing Subscribe")

      let err = EMPTY_VALUE
      const sub = result.subscribe({
        error(e) {
          err = e
        },
      })
      if (err !== EMPTY_VALUE) throw err

      outterSubscription.add(sub)
      return result.gV()
    }
    if (promise) throw promise

    throw (promise = new Promise<T>((res, rej) => {
      const error = (e: any) => {
        rej(e)
        promise = null
      }
      const pSubs = subject!.subscribe({
        next: (v) => {
          if (v !== (SUSPENSE as any)) {
            pSubs.unsubscribe()
            res(v)
            promise = null
          }
        },
        error,
        complete: () => {
          error(new Error("Empty observable"))
        },
      })
      subscription!.add(pSubs)
    }))
  }

  return result
}
export default shareLatest
