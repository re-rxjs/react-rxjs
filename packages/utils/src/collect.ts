import { GroupedObservable, noop, Observable } from "rxjs"
import { collector } from "./internal-utils"

const enhancer = <K, V>(source: GroupedObservable<K, V>) =>
  new Observable<GroupedObservable<K, V>>((observer) => {
    const done = () => {
      observer.complete()
    }
    observer.next(source)
    return source.subscribe(noop, done, done)
  })

/** @deprecated collect is deprecated and it will be removed in the next version, please use partitionByKey
 *
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the active inner observables
 */
export const collect = <K, V>(): ((
  source$: Observable<GroupedObservable<K, V>>,
) => Observable<Map<K, GroupedObservable<K, V>>>) => collector(enhancer)
