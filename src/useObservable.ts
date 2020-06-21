import { useEffect, useReducer } from "react"
import { SUSPENSE } from "./SUSPENSE"
import { BehaviorObservable } from "./BehaviorObservable"

const reducer = (
  _: any,
  { type, payload }: { type: "next" | "error"; payload: any },
) => {
  if (type === "error") {
    throw payload
  }
  return payload
}
const init = (source$: BehaviorObservable<any>) => {
  try {
    return source$.getValue()
  } catch (e) {
    return SUSPENSE
  }
}

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const [state, dispatch] = useReducer(reducer, source$, init)

  useEffect(() => {
    try {
      dispatch({
        type: "next",
        payload: source$.getValue(),
      })
    } catch (e) {
      dispatch({
        type: "next",
        payload: SUSPENSE,
      })
    }
    const subscription = source$.subscribe(
      value =>
        dispatch({
          type: "next",
          payload: value,
        }),
      error =>
        dispatch({
          type: "error",
          payload: error,
        }),
    )
    return () => subscription.unsubscribe()
  }, [source$])

  return state !== (SUSPENSE as any) ? (state as any) : source$.getValue()
}
