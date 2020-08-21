import { Observable, GroupedObservable, Subject, ReplaySubject } from "rxjs"
import { shareReplay } from "rxjs/operators"

export function split<K, T>(
  keySelector: (value: T) => K,
): (stream: Observable<T>) => Observable<GroupedObservable<K, T>>

export function split<K, T, R>(
  keySelector: (value: T) => K,
  streamSelector: (grouped: Observable<T>, key: K) => Observable<R>,
): (stream: Observable<T>) => Observable<GroupedObservable<K, R>>

export function split<K, T, R>(
  keySelector: (value: T) => K,
  streamSelector?: (grouped: Observable<T>, key: K) => Observable<R>,
) {
  return (stream: Observable<T>) =>
    new Observable<GroupedObservable<K, R>>((subscriber) => {
      const groups: Map<K, Subject<T>> = new Map()

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
          res.subscribe({
            complete() {
              groups.delete(key)
            },
          })

          subject.next(x)
          subscriber.next(res)
        },
        (e) => {
          subscriber.error(e)
          groups.forEach((g) => g.error(e))
        },
        () => {
          subscriber.complete()
          groups.forEach((g) => g.complete())
        },
      )

      return () => {
        sub.unsubscribe()
        groups.forEach((g) => g.complete())
      }
    })
}
