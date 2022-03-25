import { shareLatest } from "@react-rxjs/core"
import {
  GroupedObservable,
  identity,
  noop,
  Observable,
  Subject,
  Subscription,
} from "rxjs"
import { map } from "rxjs/operators"

export interface KeyChanges<K> {
  type: "add" | "remove"
  keys: Iterable<K>
}

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
): [(key: K) => GroupedObservable<K, R>, Observable<KeyChanges<K>>]

/**
 * Groups the elements from the source stream by using `keySelector`, returning
 * a stream of the active keys, and a function to get the stream of a specific group
 *
 * @param stream Input stream
 * @param keySelector Function that specifies the key for each element in `stream`
 * @returns [1, 2]
 * 1. A function that accepts a key and returns the stream for the group of that key.
 * 2. A stream with the list of active keys
 */
export function partitionByKey<T, K>(
  stream: Observable<T>,
  keySelector: (value: T) => K,
): [(key: K) => GroupedObservable<K, T>, Observable<KeyChanges<K>>]

export function partitionByKey<T, K, R>(
  stream: Observable<T>,
  keySelector: (value: T) => K,
  streamSelector?: (grouped: Observable<T>, key: K) => Observable<R>,
): [(key: K) => GroupedObservable<K, R>, Observable<KeyChanges<K>>] {
  const groupedObservables$ = new Observable<{
    groups: Map<K, InnerGroup<T, K, R>>
    changes: KeyChanges<K>
  }>((subscriber) => {
    const groups: Map<K, InnerGroup<T, K, R>> = new Map()

    let sourceCompleted = false
    const sub = stream.subscribe(
      (x) => {
        const key = keySelector(x)
        if (groups.has(key)) {
          return groups.get(key)!.source.next(x)
        }

        const subject = new Subject<T>()

        const res = shareLatest()(
          (streamSelector || identity)(subject, key),
        ) as GroupedObservable<K, R>
        ;(res as any).key = key

        const innerGroup: InnerGroup<T, K, R> = {
          source: subject,
          observable: res,
          subscription: new Subscription(),
        }
        groups.set(key, innerGroup)

        subscriber.next({
          groups,
          changes: {
            type: "add",
            keys: [key],
          },
        })

        innerGroup.subscription = res.subscribe(
          noop,
          (e) => subscriber.error(e),
          () => {
            groups.delete(key)
            subscriber.next({
              groups,
              changes: {
                type: "remove",
                keys: [key],
              },
            })

            if (groups.size === 0 && sourceCompleted) {
              subscriber.complete()
            }
          },
        )
        subject.next(x)
      },
      (e) => {
        sourceCompleted = true
        if (groups.size) {
          groups.forEach((g) => g.source.error(e))
        } else {
          subscriber.error(e)
        }
      },
      () => {
        sourceCompleted = true
        if (groups.size) {
          groups.forEach((g) => g.source.complete())
        } else {
          subscriber.complete()
        }
      },
    )

    return () => {
      sub.unsubscribe()
      groups.forEach((g) => {
        g.source.unsubscribe()
        g.subscription.unsubscribe()
      })
    }
  }).pipe(shareLatest())

  return [
    (key: K) =>
      getGroupedObservable(
        groupedObservables$.pipe(map(({ groups }) => groups)),
        key,
      ),
    groupedObservables$.pipe(
      map((m, i): KeyChanges<K> => {
        if (i === 0) {
          // Replay all the previously added keys
          return {
            type: "add",
            keys: m.groups.keys(),
          }
        }
        return m.changes
      }),
    ),
  ]
}

interface InnerGroup<T, K, R> {
  source: Subject<T>
  observable: GroupedObservable<K, R>
  subscription: Subscription
}

const getGroupedObservable = <K, T>(
  source$: Observable<Map<K, InnerGroup<any, K, T>>>,
  key: K,
) => {
  const result = new Observable<T>((observer) => {
    let innerSub: Subscription | undefined
    let outterSub: Subscription = source$.subscribe(
      (n) => {
        innerSub = innerSub || n.get(key)?.observable.subscribe(observer)
      },
      (e) => {
        observer.error(e)
      },
      () => {
        observer.complete()
      },
    )
    return () => {
      innerSub?.unsubscribe()
      outterSub.unsubscribe()
    }
  }) as GroupedObservable<K, T>
  ;(result as any).key = key
  return result
}
