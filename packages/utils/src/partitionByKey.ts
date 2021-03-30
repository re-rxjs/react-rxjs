import { GroupedObservable, Observable } from "rxjs"
import { map } from "rxjs/operators"
import { collect, getGroupedObservable, split } from "./"

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
  const source$ = stream.pipe(split(keySelector, streamSelector), collect())
  return [
    (key: K) => getGroupedObservable(source$, key),
    source$.pipe(map((x) => Array.from(x.keys()))),
  ]
}
