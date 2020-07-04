import { Subject, Observable, Observer } from "rxjs"
import { finalize, share } from "rxjs/operators"

/**
 * Creates a pool of Subjects identified by key, and returns:
 * - A function that accepts a key and returns the Subject linked to that key.
 *
 * @remarks Strictly speaking the returned value is not a real Subject. It's in
 * fact a multicasted Observable that it's also an Observer. That's because in
 * order to prevent memory-leaks this cached Observable will be removed from the
 * cache when it finalizes.
 */
type ObserverObservable<T> = Observable<T> & Observer<T>
export const subjectFactory = <K, V>() => {
  const cache = new Map<K, ObserverObservable<V>>()
  return (key: K) => {
    let result = cache.get(key)
    if (result) return result

    const subject = new Subject<V>()
    const close = () => {
      result!.closed = true
      cache.delete(key)
    }
    result = subject.pipe(finalize(close), share()) as ObserverObservable<V>

    result.closed = false
    result.next = subject.next.bind(subject)
    result.complete = () => {
      close()
      subject.complete()
    }
    result.error = (e: any) => {
      close()
      subject.error(e)
    }

    cache.set(key, result)
    return result
  }
}
