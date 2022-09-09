import { state as coreState, StateObservable } from "@rx-state/core"
import React, { createElement, ReactElement } from "react"
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

const cache = new WeakMap<StateObservable<any>, React.ReactNode>()
function enhanceState<T>(state$: StateObservable<T>) {
  if (!cache.has(state$))
    cache.set(
      state$,
      createElement(() => useStateObservable(state$) as any, {}),
    )

  const originalPipeState = state$.pipeState.bind(state$)
  return Object.assign(state$, cache.get(state$)!, {
    pipeState: (...operators: any[]) =>
      enhanceState((originalPipeState as any)(...operators)),
  })
}
