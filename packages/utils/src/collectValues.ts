import { Observable, GroupedObservable } from "rxjs"
import { map, endWith } from "rxjs/operators"
import { set, del, collector } from "./internal-utils"

/**
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the latest values of the inner observables.
 */
export const collectValues = <K, V>() => (
  source$: Observable<GroupedObservable<K, V>>,
): Observable<Map<K, V>> =>
  collector(source$, (inner$) =>
    inner$.pipe(
      map((v) => ({ t: set, k: inner$.key, v })),
      endWith({ t: del, k: inner$.key }),
    ),
  )
