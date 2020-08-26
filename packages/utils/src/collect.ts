import { GroupedObservable, Observable } from "rxjs"
import {
  takeUntil,
  takeLast,
  startWith,
  endWith,
  ignoreElements,
  publish,
  mergeMap,
  map,
  distinctUntilChanged,
  skipWhile,
} from "rxjs/operators"
import { shareLatest } from "@react-rxjs/core"
import { scanWithDefaultValue } from "./internal-utils"

const defaultFilter = (source$: Observable<any>) =>
  source$.pipe(ignoreElements(), startWith(true), endWith(false))

const set = "s" as const
const del = "d" as const
const complete = "c" as const

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
) => {
  const enhancer = filter
    ? (source$: GroupedObservable<K, V>) =>
        filter(source$).pipe(
          endWith(false),
          skipWhile((x) => !x),
          distinctUntilChanged(),
        )
    : defaultFilter

  return (source$: Observable<GroupedObservable<K, V>>) =>
    source$.pipe(
      publish((multicasted$) =>
        multicasted$.pipe(
          mergeMap((o) => map((x) => ({ t: x ? set : del, o }))(enhancer(o))),
          takeUntil(takeLast(1)(multicasted$)),
        ),
      ),
      endWith({ t: complete }),
      scanWithDefaultValue(
        (acc, val) => {
          if (val.t === set) {
            acc.set(val.o.key, val.o)
          } else if (val.t === del) {
            acc.delete(val.o.key)
          } else {
            acc.clear()
          }
          return acc
        },
        () => new Map<K, GroupedObservable<K, V>>(),
      ),
      shareLatest(),
    )
}
