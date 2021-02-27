import { GroupedObservable, OperatorFunction } from "rxjs"
import { collector } from "./internal-utils"

/**
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the latest values of the inner observables.
 */
export const collectValues = <K, V>(): OperatorFunction<
  GroupedObservable<K, V>,
  Map<K, V>
> => collector((x) => x)
