import { Observable, NEVER, concat } from "rxjs"
import distinctShareReplay from "./operators/distinct-share-replay"
import { FactoryObservableOptions, defaultFactoryOptions } from "./options"
import useSharedReplayableObservable from "./useSharedReplayableObservable"

export function connectFactoryObservable<
  I,
  A extends (number | string | boolean | null)[],
  O
>(
  getObservable: (...args: A) => Observable<O>,
  initialValue: I,
  _options?: FactoryObservableOptions<O>,
): [(...args: A) => O | I, (...args: A) => Observable<O>] {
  const options = {
    ...defaultFactoryOptions,
    ..._options,
  }

  const cache = new Map<string, Observable<O>>()

  const getSharedObservable$ = (...input: A): Observable<O> => {
    const key = JSON.stringify(input)
    const cachedVal = cache.get(key)

    if (cachedVal !== undefined) {
      return cachedVal
    }

    const reactObservable$ = concat(getObservable(...input), NEVER).pipe(
      distinctShareReplay(options.compare, () => {
        cache.delete(key)
      }),
    )

    cache.set(key, reactObservable$)
    return reactObservable$
  }

  return [
    (...input: A) =>
      useSharedReplayableObservable(
        getSharedObservable$(...input),
        initialValue,
        options,
      ),

    getSharedObservable$,
  ]
}
