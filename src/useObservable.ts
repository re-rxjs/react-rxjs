import { useState, useEffect } from "react"
import delayUnsubscription from "./operators/delay-unsubscription"
import { BehaviorObservable } from "operators/distinct-share-replay"

const emptyArr = [undefined, undefined]
const cache = new WeakMap<
  BehaviorObservable<any>,
  [BehaviorObservable<any>, number]
>()
const getEnhancedSource = <T>(
  source$: BehaviorObservable<T>,
  graceTime: number,
): BehaviorObservable<T> => {
  let [result, prevGraceTime] = cache.get(source$) ?? emptyArr
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
  unsubscribeGraceTime = 200,
) => {
  const [state, setState] = useState<O>(defaultValue)

  useEffect(() => {
    const enhancedSource$ = getEnhancedSource(source$, unsubscribeGraceTime)
    try {
      setState(enhancedSource$.getValue())
    } catch (e) {
      setState(defaultValue)
    }
    const subscription = enhancedSource$.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [source$, unsubscribeGraceTime])

  return state !== defaultValue
    ? state
    : getEnhancedSource(source$, unsubscribeGraceTime).getValue()
}

export default useObservable
