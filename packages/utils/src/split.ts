import {
  Observable,
  GroupedObservable,
  Subject,
  ReplaySubject,
  OperatorFunction,
} from "rxjs"
import { shareReplay } from "rxjs/operators"

const emptyError = {}

/**
 * Groups the items emitted by the source based on the keySelector function,
 * emitting one Observable for each group.
 *
 * @param keySelector Function to define the group of an item
 */
export function split<T, K>(
  keySelector: (value: T) => K,
): OperatorFunction<T, GroupedObservable<K, T>>

/**
 * Groups the items emitted by the source based on the keySelector function,
 * emitting one Observable for each group.
 *
 * @param keySelector Function to define the group of an item
 * @param streamSelector Function to apply to each resulting group
 */
export function split<T, K, R>(
  keySelector: (value: T) => K,
  streamSelector: (grouped: Observable<T>, key: K) => Observable<R>,
): OperatorFunction<T, GroupedObservable<K, R>>

export function split<T, K, R>(
  keySelector: (value: T) => K,
  streamSelector?: (grouped: Observable<T>, key: K) => Observable<R>,
): OperatorFunction<T, GroupedObservable<K, R>> {
  return (stream: Observable<T>) =>
    new Observable<GroupedObservable<K, R>>((subscriber) => {
      const groups: Map<K, Subject<T>> = new Map()

      let error = emptyError
      const sub = stream.subscribe(
        (x) => {
          const key = keySelector(x)
          if (groups.has(key)) {
            return groups.get(key)!.next(x)
          }

          const subject = streamSelector
            ? new Subject<T>()
            : new ReplaySubject<T>(1)
          groups.set(key, subject)

          const res = (streamSelector
            ? streamSelector(subject, key).pipe(shareReplay(1))
            : subject.asObservable()) as GroupedObservable<K, R>

          res.key = key
          const onFinish = () => groups.delete(key)
          res.subscribe(undefined, onFinish, onFinish)

          subject.next(x)
          subscriber.next(res)
        },
        (e) => {
          subscriber.error((error = e))
        },
        () => {
          subscriber.complete()
        },
      )

      return () => {
        sub.unsubscribe()
        groups.forEach(
          error === emptyError ? (g) => g.complete() : (g) => g.error(error),
        )
      }
    })
}
