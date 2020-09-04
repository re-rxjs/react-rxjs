import { useEffect, useReducer } from "react"
import { BehaviorObservable } from "./BehaviorObservable"
import { SUSPENSE } from "../SUSPENSE"
import { Observable } from "rxjs"

const ERROR: "e" = "e"
const VALUE: "v" = "v"
type Action = "e" | "v" | "s"

const reducer = (
  current: { type: Action; payload: any },
  action: { type: Action; payload: any },
) =>
  Object.is(current.payload, action.payload) && current.type === action.type
    ? current
    : action

const init = (source$: BehaviorObservable<any>) => source$.getValue()

const defaultSUSPENSE = <T>(source$: Observable<T>) =>
  new Observable<T | typeof SUSPENSE>((observer) => {
    let isEmpty = true
    const subscription = source$.subscribe(
      (x) => {
        isEmpty = false
        observer.next(x)
      },
      (e) => observer.error(e),
    )

    if (isEmpty) {
      observer.next(SUSPENSE)
    }

    return subscription
  })

export const useObservable = <O>(
  source$: BehaviorObservable<O>,
): Exclude<O, typeof SUSPENSE> => {
  const [state, dispatch] = useReducer(reducer, source$, init)

  useEffect(() => {
    const subscription = defaultSUSPENSE(source$).subscribe(
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

  const { type, payload } = state
  if (type === VALUE) return payload
  throw payload
}
