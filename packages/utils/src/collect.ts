import { GroupedObservable, Observable, OperatorFunction } from "rxjs"
import {
  startWith,
  endWith,
  ignoreElements,
  map,
  distinctUntilChanged,
  skipWhile,
} from "rxjs/operators"
import { CollectorAction, collector } from "./internal-utils"

const defaultFilter = (source$: Observable<any>) =>
  source$.pipe(ignoreElements(), startWith(true), endWith(false))

/**
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the active inner observables
 *
 * @param filter? A function that receives the inner Observable and returns an
 * Observable of boolean values, which indicates whether the inner observable
 * should be collected.
 */
export const collect = <K, V>(
  filter?: (source$: GroupedObservable<K, V>) => Observable<boolean>,
): OperatorFunction<
  GroupedObservable<K, V>,
  Map<K, GroupedObservable<K, V>>
> => {
  const enhancer = filter
    ? (source$: GroupedObservable<K, V>) =>
        filter(source$).pipe(
          endWith(false),
          skipWhile((x) => !x),
          distinctUntilChanged(),
        )
    : defaultFilter

  return (source$: Observable<GroupedObservable<K, V>>) =>
    collector(source$, (o) =>
      map((x) => ({
        t: x
          ? (CollectorAction.Set as const)
          : (CollectorAction.Delete as const),
        k: o.key,
        v: o,
      }))(enhancer(o)),
    )
}
