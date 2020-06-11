import { useEffect, useReducer } from "react"
import delayUnsubscription from "./operators/delay-unsubscription"
import {
  distinctShareReplay,
  BehaviorObservable,
} from "./operators/distinct-share-replay"
import { SUSPENSE } from "./"
import { Observable } from "rxjs"

const emptyArr = [undefined, undefined]
const cache = new WeakMap<Observable<any>, [BehaviorObservable<any>, number]>()
const getEnhancedSource = <T>(
  source$: Observable<T>,
  graceTime: number,
): BehaviorObservable<T> => {
  let [result, prevGraceTime] = cache.get(source$) ?? emptyArr
  if (result && prevGraceTime === graceTime) {
    return result
  }
  result =
    (source$ as any).__id === distinctShareReplay
      ? (source$ as BehaviorObservable<T>)
      : distinctShareReplay()(source$)
  result = delayUnsubscription(graceTime)(result)
  cache.set(source$, [result, graceTime])
  return result
}

const reducer = (_: any, action: any) => action
const init = (args: any) => {
  try {
    return getEnhancedSource(...(args as [any, any])).getValue()
  } catch (e) {
    return SUSPENSE
  }
}

export const useObservable = <O>(
  source$: Observable<O>,
  unsubscribeGraceTime = 200,
): Exclude<O, typeof SUSPENSE> => {
  const [state, dispatch] = useReducer(
    reducer,
    [source$, unsubscribeGraceTime],
    init,
  )

  useEffect(() => {
    const enhancedSource$ = getEnhancedSource(source$, unsubscribeGraceTime)
    try {
      dispatch(enhancedSource$.getValue())
    } catch (e) {
      dispatch(SUSPENSE)
    }
    const subscription = enhancedSource$.subscribe(dispatch)
    return () => subscription.unsubscribe()
  }, [source$, unsubscribeGraceTime])

  return state !== (SUSPENSE as any)
    ? (state as any)
    : getEnhancedSource(source$, unsubscribeGraceTime).getValue()
}
