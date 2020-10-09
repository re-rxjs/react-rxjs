import { useEffect, useReducer } from "react"
import { BehaviorObservable, Action } from "./BehaviorObservable"
import { SUSPENSE } from "../SUSPENSE"
import { EMPTY_VALUE } from "./empty-value"

const reducer = (
  current: { type: Action; payload: any },
  action: { type: Action; payload: any },
) =>
  current.type === action.type && Object.is(current.payload, action.payload)
    ? current
    : action

const init = (source$: BehaviorObservable<any>) => source$.getValue()

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const [state, dispatch] = useReducer(reducer, source$, init)

  useEffect(() => {
    const onNext = (value: O | typeof SUSPENSE) => {
      if ((value as any) === SUSPENSE) {
        dispatch(source$.getValue())
      } else {
        dispatch({
          type: Action.Value,
          payload: value,
        })
      }
    }
    const onError = (error: any) =>
      dispatch({
        type: Action.Error,
        payload: error,
      })

    let val: O | typeof SUSPENSE = SUSPENSE
    let err: any = EMPTY_VALUE
    let subscription = source$.subscribe(
      (v) => (val = v),
      (e) => (err = e),
    )
    if (err !== EMPTY_VALUE) return onError(err)
    onNext(val)
    const t = subscription
    subscription = source$.subscribe(onNext, onError)
    t.unsubscribe()

    return () => subscription.unsubscribe()
  }, [source$])

  const { type, payload } = state
  if (type === Action.Value) return payload
  throw payload
}
