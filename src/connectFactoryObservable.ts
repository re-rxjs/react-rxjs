import { Observable, NEVER, concat } from "rxjs"
import {
  distinctShareReplay,
  BehaviorObservable,
} from "./operators/distinct-share-replay"
import { ConnectorOptions, defaultConnectorOptions } from "./options"
import { useObservable, SUSPENSE } from "./"

export function connectFactoryObservable<
  A extends (number | string | boolean | null)[],
  O
>(
  getObservable: (...args: A) => Observable<O>,
  _options?: ConnectorOptions<O>,
): [
  (...args: A) => Exclude<O, typeof SUSPENSE>,
  (...args: A) => Observable<O>,
] {
  const options = {
    ...defaultConnectorOptions,
    ..._options,
  }

  const cache = new Map<string, BehaviorObservable<O>>()

  const getSharedObservable$ = (...input: A): BehaviorObservable<O> => {
    const key = JSON.stringify(input)
    const cachedVal = cache.get(key)

    if (cachedVal !== undefined) {
      return cachedVal
    }

    const reactObservable$ = distinctShareReplay(options.compare, () => {
      cache.delete(key)
    })(concat(getObservable(...input), NEVER))

    cache.set(key, reactObservable$)
    return reactObservable$
  }

  return [
    (...input: A) =>
      useObservable(
        getSharedObservable$(...input),
        options.unsubscribeGraceTime,
      ),

    getSharedObservable$,
  ]
}
