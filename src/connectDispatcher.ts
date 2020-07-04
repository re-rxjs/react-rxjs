import { Observable } from "rxjs"
import shareLatest, { cache as sharedCache } from "./internal/share-latest"
import reactEnhancer, { cache as reactCache } from "./internal/react-enhancer"
import { useEffect } from "react"

const dispatchers = new WeakMap<Observable<any>, any>()

const getReactObservable$ = <T>(input$: Observable<T>) => {
  if (!sharedCache.has(input$)) {
    input$ = shareLatest(input$)
  }
  if (!reactCache.has(input$)) {
    reactEnhancer(input$, 200)
  }
  return reactCache.get(input$)!
}

export function connectDispatcher<
  A extends (number | string | boolean | null)[],
  Input,
  Output
>(
  getObservable: ((...args: A) => Observable<Output>) | Observable<Output>,
  dispatcher: (input: Input, ...args: A) => void,
) {
  const getHookObservable$ = (...args: A) =>
    getReactObservable$(
      typeof getObservable === "function"
        ? getObservable(...args)
        : getObservable,
    )

  const getDispather = (...args: A) => {
    const observable$ = getHookObservable$(...args)
    let result: (input: Input) => void = dispatchers.get(observable$)
    if (result) return result
    result = (input: Input) => {
      dispatcher(input, ...args)
    }
    return result
  }

  return (...args: A): ((input: Input) => void) => {
    const observable$ = getHookObservable$(...args)
    useEffect(() => {
      const subs = observable$.subscribe()
      return () => subs.unsubscribe()
    }, [observable$])
    return args.length === 0 ? dispatcher : getDispather(...args)
  }
}
