import { Observable, defer, GroupedObservable } from "rxjs"
import { shareLatest } from "@react-rxjs/core"
import {
  scan,
  publish,
  endWith,
  takeLast,
  takeUntil,
  mergeMap,
} from "rxjs/operators"

export const defaultStart = <T>(value: T) => (source$: Observable<T>) =>
  new Observable<T>((observer) => {
    let emitted = false
    const subscription = source$.subscribe(
      (x) => {
        emitted = true
        observer.next(x)
      },
      (e) => observer.error(e),
      () => observer.complete(),
    )

    if (!emitted) {
      observer.next(value)
    }

    return subscription
  })

export const scanWithDefaultValue = <I, O>(
  accumulator: (acc: O, current: I) => O,
  getSeed: () => O,
) => (source: Observable<I>) =>
  defer(() => {
    const seed = getSeed()
    return source.pipe(scan(accumulator, seed), defaultStart(seed))
  })

export const set = "s" as const
export const del = "d" as const
export const complete = "c" as const

export const collector = <K, V, VV>(
  source: Observable<GroupedObservable<K, V>>,
  enhancer: (
    source: GroupedObservable<K, V>,
  ) => Observable<{ t: "d"; k: K } | { t: "s"; k: K; v: VV }>,
): Observable<Map<K, VV>> =>
  source.pipe(
    publish((x) => x.pipe(mergeMap(enhancer), takeUntil(takeLast(1)(x)))),
    endWith({ t: complete }),
    scanWithDefaultValue(
      (acc, val) => {
        if (val.t === set) {
          acc.set(val.k, val.v)
        } else if (val.t === del) {
          acc.delete(val.k)
        } else {
          acc.clear()
        }
        return acc
      },
      () => new Map<K, VV>(),
    ),
    shareLatest(),
  )
