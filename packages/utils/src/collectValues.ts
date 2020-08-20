import { Observable, GroupedObservable } from "rxjs"
import {
  map,
  mergeMap,
  endWith,
  publish,
  takeLast,
  takeUntil,
} from "rxjs/operators"
import { scanWithDefaultValue } from "./internal-utils"

/**
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the latest values of the inner observables.
 */
export const collectValues = <K, V>() => (
  source$: Observable<GroupedObservable<K, V>>,
): Observable<Map<K, V>> =>
  source$.pipe(
    publish((multicasted$) =>
      multicasted$.pipe(
        mergeMap((inner$) =>
          inner$.pipe(
            map((v) => ({ t: "s" as const, k: inner$.key, v })),
            endWith({ t: "d" as const, k: inner$.key }),
          ),
        ),
        takeUntil(multicasted$.pipe(takeLast(1))),
      ),
    ),
    endWith({ t: "c" as const }),
    scanWithDefaultValue(
      (acc, val) => {
        if (val.t === "s") {
          acc.set(val.k, val.v)
        } else if (val.t === "d") {
          acc.delete(val.k)
        } else {
          acc.clear()
        }
        return acc
      },
      () => new Map<K, V>(),
    ),
  )
