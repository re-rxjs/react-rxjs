import { Observable, GroupedObservable, OperatorFunction } from "rxjs"
import { map, endWith } from "rxjs/operators"
import { CollectorAction, collector } from "./internal-utils"

/**
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the latest values of the inner observables.
 */
export const collectValues = <K, V>(): OperatorFunction<
  GroupedObservable<K, V>,
  Map<K, V>
> => (source$: Observable<GroupedObservable<K, V>>): Observable<Map<K, V>> =>
  collector(source$, (inner$) =>
    inner$.pipe(
      map((v) => ({ t: CollectorAction.Set as const, k: inner$.key, v })),
      endWith({ t: CollectorAction.Delete, k: inner$.key }),
    ),
  )
