import { useState, useLayoutEffect } from "react"
import delayUnsubscription from "./operators/delay-unsubscription"
import { BehaviorObservable } from "operators/distinct-share-replay"

const cache = new WeakMap<
  BehaviorObservable<any>,
  [BehaviorObservable<any>, number]
>()
const getEnhancedSource = <T>(
  source$: BehaviorObservable<T>,
  graceTime: number,
): BehaviorObservable<T> => {
  let [result, prevGraceTime] = cache.get(source$) ?? []
  if (result && prevGraceTime === graceTime) {
    return result
  }
  result = delayUnsubscription(graceTime)(source$)
  cache.set(source$, [result, graceTime])
  return result
}

const defaultValue: any = {}
const useObservable = <O>(
  source$: BehaviorObservable<O>,
  unsubscribeGraceTime: number,
) => {
  const [state, setState] = useState<O>(defaultValue)

  useLayoutEffect(() => {
    const enhancedSource$ = getEnhancedSource(source$, unsubscribeGraceTime)
    setState(enhancedSource$.getValue())
    const subscription = enhancedSource$.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [source$, unsubscribeGraceTime])

  return state !== defaultValue
    ? state
    : getEnhancedSource(source$, unsubscribeGraceTime).getValue()
}

export default useObservable
