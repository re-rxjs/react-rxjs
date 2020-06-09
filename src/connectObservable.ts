import { Observable, NEVER, concat } from "rxjs"
import { useObservable, distinctShareReplay } from "./"
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

  const useStaticObservable = () =>
    useObservable(sharedObservable$, options.unsubscribeGraceTime)
  useStaticObservable.shared$ = sharedObservable$

  return [useStaticObservable, sharedObservable$] as const
}
