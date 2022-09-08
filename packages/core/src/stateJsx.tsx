import { state as coreState, StateObservable } from "@rx-state/core"
import React, { ReactElement } from "react"
import { useStateObservable } from "./useStateObservable"

declare module "@rx-state/core" {
  interface StateObservable<T> extends ReactElement {}
}

export const state: typeof coreState = (...args: any[]): any => {
  const result = (coreState as any)(...args)

  if (typeof result === "function") {
    return (...args: any[]) => enhanceState(result(...args))
  }
  return enhanceState(result)
}

function StateValue(props: { state$: StateObservable<any> }) {
  return useStateObservable(props.state$)
}

function enhanceState<T>(state$: StateObservable<T>) {
  const element = <StateValue state$={state$} />
  return Object.assign(state$, element)
}
