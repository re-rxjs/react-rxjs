import { useState, useEffect } from "react"
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

export const useObservable = <O>(
  source$: Observable<O>,
  unsubscribeGraceTime = 200,
) => {
  const [state, setState] = useState<O>(SUSPENSE as any)

  useEffect(() => {
    const enhancedSource$ = getEnhancedSource(source$, unsubscribeGraceTime)
    try {
      setState(enhancedSource$.getValue())
    } catch (e) {
      setState(SUSPENSE as any)
    }
    const subscription = enhancedSource$.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [source$, unsubscribeGraceTime])

  return state !== (SUSPENSE as any)
    ? state
    : getEnhancedSource(source$, unsubscribeGraceTime).getValue()
}
