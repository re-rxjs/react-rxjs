import { Observable, NEVER, concat } from "rxjs"
import {
  distinctShareReplay,
  BehaviorObservable,
} from "./operators/distinct-share-replay"
import { ConnectorOptions, defaultConnectorOptions } from "./options"
import { SUSPENSE } from "./"
import { useObservable } from "./useObservable"
import reactEnhancer from "./operators/react-enhancer"

interface ConnectFactoryObservable {
  <A extends (number | string | boolean | null)[], O>(
    getObservable: (...args: A) => Observable<O>,
    _options?: ConnectorOptions<O>,
  ): [
    (...args: A) => Exclude<O, typeof SUSPENSE>,
    (...args: A) => Observable<O>,
  ]
  <A extends Object, O>(
    getObservable: (key: A) => Observable<O>,
    _options?: ConnectorOptions<O>,
  ): [(key: A) => Exclude<O, typeof SUSPENSE>, (key: A) => Observable<O>]
}

export const connectFactoryObservable: ConnectFactoryObservable = <O>(
  getObservable: (...args: any) => Observable<O>,
  _options?: ConnectorOptions<O>,
) => {
  const options = {
    ...defaultConnectorOptions,
    ..._options,
  }

  const cache = new Map<
    string | Object,
    [BehaviorObservable<O>, BehaviorObservable<O>]
  >()

  const getSharedObservables$ = (
    ...input: any
  ): [BehaviorObservable<O>, BehaviorObservable<O>] => {
    const key =
      input.length === 1 && typeof input[0] === "object" && input[0] !== null
        ? input[0]
        : JSON.stringify(input)
    const cachedVal = cache.get(key)

    if (cachedVal) {
      return cachedVal
    }

    const sharedObservable$ = distinctShareReplay(options.compare, () =>
      cache.delete(key),
    )(concat(getObservable(...input), NEVER)) as BehaviorObservable<O>

    const reactObservable$ = reactEnhancer(
      sharedObservable$,
      options.unsubscribeGraceTime,
    )
    const result: [BehaviorObservable<O>, BehaviorObservable<O>] = [
      sharedObservable$,
      reactObservable$,
    ]

    cache.set(key, result)
    return result
  }

  const getSharedObservable$ = (...input: any) =>
    getSharedObservables$(...input)[0]

  return [
    (...input: any) =>
      useObservable(
        getSharedObservables$(...input)[1],
        options.unsubscribeGraceTime,
      ),

    getSharedObservable$,
  ] as any
}
