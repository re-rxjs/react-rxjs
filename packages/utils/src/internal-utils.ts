import { Observable, defer, GroupedObservable, pipe } from "rxjs"
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

export const enum CollectorAction {
  Set,
  Delete,
  Complete,
}

export const collector = <K, V, VV>(
  enhancer: (
    source: GroupedObservable<K, V>,
  ) => Observable<
    | { t: CollectorAction.Delete; k: K }
    | { t: CollectorAction.Set; k: K; v: VV }
  >,
): ((source: Observable<GroupedObservable<K, V>>) => Observable<Map<K, VV>>) =>
  pipe(
    publish((x) => x.pipe(mergeMap(enhancer), takeUntil(takeLast(1)(x)))),
    endWith({ t: CollectorAction.Complete as const }),
    scanWithDefaultValue(
      (acc, val) => {
        if (val.t === CollectorAction.Set) {
          acc.set(val.k, val.v)
        } else if (val.t === CollectorAction.Delete) {
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
