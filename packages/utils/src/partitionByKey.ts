import { shareLatest } from "@react-rxjs/core"
import {
  defer,
  GroupedObservable,
  identity,
  noop,
  Observable,
  Subject,
  Subscription,
} from "rxjs"
import { finalize, map } from "rxjs/operators"

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

        const shared$ = shareLatest()(
          (streamSelector || identity)(subject, key),
        )

        const res = defer(() => {
          incRefcount()
          return shared$
        }).pipe(finalize(() => decRefcount())) as any as GroupedObservable<K, R>
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

        innerGroup.subscription = shared$.subscribe(
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

  let refCount = 0
  let sub: Subscription | undefined
  function incRefcount() {
    refCount++
    if (refCount === 1) {
      sub = groupedObservables$.subscribe()
    }
  }
  function decRefcount() {
    refCount--
    if (refCount === 0) {
      sub?.unsubscribe()
    }
  }

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
    let outerSub: Subscription | undefined
    let foundSynchronously = false
    outerSub = source$.subscribe(
      (n) => {
        const innerGroup = n.get(key)
        if (innerGroup && !innerSub) {
          innerSub = innerGroup.observable.subscribe(observer)
          outerSub?.unsubscribe()
          foundSynchronously = true
        }
      },
      (e) => {
        observer.error(e)
      },
      () => {
        observer.complete()
      },
    )
    if (foundSynchronously) {
      outerSub.unsubscribe()
      outerSub = undefined
    }

    return () => {
      innerSub?.unsubscribe()
      outerSub?.unsubscribe()
    }
  }) as GroupedObservable<K, T>
  ;(result as any).key = key
  return result
}
