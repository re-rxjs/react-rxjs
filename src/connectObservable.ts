import { Observable, NEVER, concat } from "rxjs"
import { distinctShareReplay } from "./operators/distinct-share-replay"
import reactEnhancer from "./operators/react-enhancer"
import { useObservable } from "./useObservable"
import { ConnectorOptions, defaultConnectorOptions } from "./options"

export function connectObservable<T>(
  observable: Observable<T>,
  _options?: ConnectorOptions<T>,
) {
  const options = {
    ...defaultConnectorOptions,
    ..._options,
  }
  const sharedObservable$ = distinctShareReplay(options.compare)(
    concat(observable, NEVER),
  )

  const reactObservable$ = reactEnhancer(
    sharedObservable$,
    options.unsubscribeGraceTime,
  )

  const useStaticObservable = () => useObservable(reactObservable$)

  return [useStaticObservable, sharedObservable$] as const
}
