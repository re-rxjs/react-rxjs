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

  let error: any = EMPTY_VALUE
  let resetErrorTimeout: any
  let teardownTimeout: any
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
        subject = null
        subscription = null
        promise = null
      }
      // For factoryObservable we want to remove it from the cache after a small delay
      // this is relevant when the observable emits an error: On that case refCount goes to 0
      // it's removed from the cache, and when react re-renders the component a new observable instance is created.
      // The alternative is to use a `const [, setError] = useState(); ... setError(() => { throw error })`
      // instead. On that case, when react re-renders, useState will retrigger the function from within setError,
      // this way skipping creating a new observable instance.
      clearTimeout(teardownTimeout)
      teardownTimeout = setTimeout(() => {
        if (refCount === 0) {
          teardown()
        }
      }, 50)
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
          error = err
          resetErrorTimeout = setTimeout(() => {
            error = EMPTY_VALUE
          }, 50)
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

  result.gV = (outterSubscription?: Subscription): T => {
    if (error !== EMPTY_VALUE) {
      clearTimeout(resetErrorTimeout)
      resetErrorTimeout = setTimeout(() => {
        error = EMPTY_VALUE
      }, 50)
      throw error
    }

    if ((currentValue as any) !== SUSPENSE && currentValue !== EMPTY_VALUE) {
      return currentValue
    }
    if (defaultValue !== EMPTY_VALUE) return defaultValue

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
      const setError = (e: any) => {
        rej(e)
        promise = null
      }
      const pSubs = subject!.subscribe(
        (v) => {
          if (v !== (SUSPENSE as any)) {
            pSubs.unsubscribe()
            res(v)
            promise = null
          }
        },
        setError,
        () => {
          setError(new Error("Empty observable"))
        },
      )
      subscription!.add(pSubs)
    }))
  }
  result.sB = (callback) => {
    const sub = result.subscribe({
      next: callback,
      error: callback,
    })
    return () => sub.unsubscribe()
  }

  const cachedCallback: WeakMap<Subscription, () => any> = new WeakMap()
  result.gVS = (subscription) => {
    if (!subscription) {
      return result.gV
    }
    if (!cachedCallback.has(subscription)) {
      cachedCallback.set(subscription, () => result.gV(subscription))
    }
    return cachedCallback.get(subscription)!
  }

  return result
}
export default shareLatest
