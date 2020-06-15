import { useEffect, useReducer } from "react"
import { BehaviorObservable, SUSPENSE } from "./"

const reducer = (_: any, action: any) => action
const init = (source$: BehaviorObservable<any>) => {
  try {
    return source$.getValue()
  } catch (e) {
    return SUSPENSE
  }
}

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
  unsubscribeGraceTime = 200,
): Exclude<O, typeof SUSPENSE> => {
  const [state, dispatch] = useReducer(reducer, source$, init)

  useEffect(() => {
    try {
      dispatch(source$.getValue())
    } catch (e) {
      dispatch(SUSPENSE)
    }
    const subscription = source$.subscribe(dispatch)
    return () => subscription.unsubscribe()
  }, [source$, unsubscribeGraceTime])

  return state !== (SUSPENSE as any) ? (state as any) : source$.getValue()
}
