import { shareLatest } from "@react-rxjs/core"
import {
  GroupedObservable,
  noop,
  Observable,
  Subject,
  Subscription,
} from "rxjs"
import { map } from "rxjs/operators"
import { getGroupedObservable } from "./"

/**
 * Groups the elements from the source stream by using `keySelector`, returning
 * a stream of the active keys, and a function to get the stream of a specific group
 *
 * @param stream Input stream
 * @param keySelector Function that specifies the key for each element in `stream`
 * @param streamSelector Function to apply to each resulting group
 * @returns [1, 2]
 * 1. A function that accepts a key and returns the stream for the group of that key.
 * 2. A stream with the list of active keys
 */
export function partitionByKey<T, K, R>(
  stream: Observable<T>,
  keySelector: (value: T) => K,
  streamSelector: (grouped: Observable<T>, key: K) => Observable<R>,
): [(key: K) => GroupedObservable<K, R>, Observable<K[]>] {
  const groupedObservables$ = new Observable<Map<K, GroupedObservable<K, R>>>(
    (subscriber) => {
      const groups: Map<K, InnerGroup<T, K, R>> = new Map()

      let warmup = true
      let sourceCompleted = false
      const sub = stream.subscribe(
        (x) => {
          const key = keySelector(x)
          if (groups.has(key)) {
            return groups.get(key)!.source.next(x)
          }

          const subject = new Subject<T>()

          const res = streamSelector(subject, key).pipe(
            shareLatest(),
          ) as GroupedObservable<K, R>
          res.key = key

          const innerGroup: InnerGroup<T, K, R> = {
            source: subject,
            observable: res,
            subscription: new Subscription(),
          }
          groups.set(key, innerGroup)

          const onFinish = () => {
            groups.delete(key)
            subscriber.next(mapGroups(groups))

            if (groups.size === 0 && sourceCompleted) {
              subscriber.complete()
            }
          }
          innerGroup.subscription = res.subscribe(noop, onFinish, onFinish)

          subject.next(x)
          if (!warmup) {
            subscriber.next(mapGroups(groups))
          }
        },
        (e) => {
          subscriber.error(e)
        },
        () => {
          sourceCompleted = true
          if (groups.size === 0) {
            subscriber.complete()
          }
          groups.forEach((g) => g.source.complete())
        },
      )

      warmup = false
      subscriber.next(mapGroups(groups))

      return () => {
        sub.unsubscribe()
        groups.forEach((g) => {
          g.source.unsubscribe()
          g.subscription.unsubscribe()
        })
      }
    },
  ).pipe(shareLatest())

  return [
    (key: K) => getGroupedObservable(groupedObservables$, key),
    groupedObservables$.pipe(map((x) => Array.from(x.keys()))),
  ]
}

interface InnerGroup<T, K, R> {
  source: Subject<T>
  observable: GroupedObservable<K, R>
  subscription: Subscription
}

function mapGroups<T, K, R>(
  groups: Map<K, InnerGroup<T, K, R>>,
): Map<K, GroupedObservable<K, R>> {
  return new Map(
    Array.from(groups.entries()).map(([key, group]) => [key, group.observable]),
  )
}
