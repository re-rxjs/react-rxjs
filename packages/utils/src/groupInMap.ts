import { Observable, GroupedObservable, concat, of } from "rxjs"
import { map, mergeMap, scan } from "rxjs/operators"
import continuousGroupBy from "./continuousGroupBy"

const DELETE = Symbol("DELETE")
export const groupInMap = <T, K, V>(
  keyGetter: (x: T) => K,
  projection: (x: GroupedObservable<K, T>) => Observable<V>,
) => (source$: Observable<T>): Observable<Map<K, V>> =>
  source$.pipe(
    continuousGroupBy(keyGetter),
    mergeMap(inner$ =>
      concat(
        projection(inner$).pipe(map(v => [inner$.key, v] as const)),
        of([inner$.key, DELETE] as const),
      ),
    ),
    scan((acc, [key, value]) => {
      if (value !== DELETE) return acc.set(key, value)
      acc.delete(key)
      return acc
    }, new Map<K, V>()),
  )
