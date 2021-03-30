import { GroupedObservable, Observable } from "rxjs"
import { map } from "rxjs/operators"
import { collect, getGroupedObservable, split } from "./"

export function partitionByKey<T, K, R>(
  stream: Observable<T>,
  keySelector: (value: T) => K,
  streamSelector: (grouped: Observable<T>, key: K) => Observable<R>,
): [Observable<K[]>, (key: K) => GroupedObservable<K, R>] {
  const source$ = stream.pipe(split(keySelector, streamSelector), collect())
  return [
    source$.pipe(map((x) => Array.from(x.keys()))),
    (key: K) => getGroupedObservable(source$, key),
  ]
}
