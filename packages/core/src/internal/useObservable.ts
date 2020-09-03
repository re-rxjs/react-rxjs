import { useEffect, useReducer } from "react"
import { BehaviorObservable } from "./BehaviorObservable"
import { SUSPENSE } from "../SUSPENSE"

const ERROR: "e" = "e"
const VALUE: "v" = "v"
const SUSP: "s" = "s"
type Action = "e" | "v" | "s"

const reducer = (
  current: { type: Action; payload: any },
  action: { type: Action; payload: any },
) =>
  Object.is(current.payload, action.payload) && current.type === action.type
    ? current
    : action

const init = (source$: BehaviorObservable<any>) => source$.getValue()

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const [state, dispatch] = useReducer(reducer, source$, init)
  if (state.type === ERROR) throw state.payload

  useEffect(() => {
    dispatch(source$.getValue())
    const subscription = source$.subscribe(
      (value) => {
        if ((value as any) === SUSPENSE) {
          dispatch(source$.getValue())
        } else {
          dispatch({
            type: VALUE,
            payload: value,
          })
        }
      },
      (error) =>
        dispatch({
          type: ERROR,
          payload: error,
        }),
    )
    return () => subscription.unsubscribe()
  }, [source$])

  if (state.type === SUSP) {
    throw state.payload
  }
  return state.payload
}
