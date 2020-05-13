import { Observable, ReplaySubject, Subscription } from "rxjs"

export interface ReactObservable<O, IO> extends Observable<O> {
  getCurrentValue: () => O | IO
}

const DEFAULT_GRACE_PERIOD = 100
const reactOperator = <T, I>(
  source$: Observable<T>,
  initialValue: I,
  gracePeriod: number = DEFAULT_GRACE_PERIOD,
  teardown?: () => void,
): ReactObservable<T, I> => {
  let subject: ReplaySubject<T> | undefined
  let subscription: Subscription | undefined
  let timeoutToken: NodeJS.Timeout | undefined = undefined
  let refCount = 0
  let hasError = false
  let currentValue: T | I = initialValue

  const observable$ = new Observable<T>(subscriber => {
    if (timeoutToken !== undefined) {
      clearTimeout(timeoutToken)
    }
    refCount++
    if (!subject || hasError) {
      hasError = false
      subject = new ReplaySubject<T>(1)
      subscription = source$.subscribe({
        next(value) {
          currentValue = value
          subject!.next(value)
        },
        error(err) {
          hasError = true
          subject!.error(err)
        },
        complete() {
          subscription = undefined
          subject!.complete()
        },
      })
    }

    const innerSub = subject.subscribe(subscriber)
    const cleanup = () => {
      timeoutToken = undefined
      currentValue = initialValue
      teardown?.()
      if (subscription) {
        subscription.unsubscribe()
        subscription = undefined
      }
      subject = undefined
    }
    return () => {
      refCount--
      innerSub.unsubscribe()
      if (refCount === 0) {
        if (gracePeriod > 0) {
          timeoutToken = setTimeout(cleanup, gracePeriod)
        } else {
          cleanup()
        }
      }
    }
  })

  const result = observable$ as ReactObservable<T, I>
  result.getCurrentValue = () => currentValue
  return result
}

export default reactOperator
