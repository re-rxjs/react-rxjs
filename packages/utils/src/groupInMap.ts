import { Observable, GroupedObservable, concat, of, defer } from "rxjs"
import {
  map,
  mergeMap,
  scan,
  publish,
  takeUntil,
  takeLast,
} from "rxjs/operators"
import continuousGroupBy from "./continuousGroupBy"

const DELETE = Symbol("DELETE")

/**
 * Groups all values by key and emits a Map that holds the latest value for each
 * key.
 *
 * @param keyGetter A function that extracts the key for each item.
 * @param projection Projection function for each group.
 */
export const groupInMap = <T, K, V>(
  keyGetter: (x: T) => K,
  projection: (x: GroupedObservable<K, T>) => Observable<V>,
) => (source$: Observable<T>): Observable<Map<K, V>> => {
  const res = new Map<K, V>()

  return concat(
    source$.pipe(
      continuousGroupBy(keyGetter),
      publish(multicasted$ => {
        return multicasted$.pipe(
          mergeMap(inner$ =>
            concat(
              projection(inner$).pipe(map(v => [inner$.key, v] as const)),
              of([inner$.key, DELETE] as const),
            ),
          ),
          takeUntil(multicasted$.pipe(takeLast(1))),
        )
      }),
      scan((acc, [key, value]) => {
        if (value !== DELETE) return acc.set(key, value)
        acc.delete(key)
        return acc
      }, res),
    ),
    defer(() => {
      res.clear()
      return of(res)
    }),
  )
}
