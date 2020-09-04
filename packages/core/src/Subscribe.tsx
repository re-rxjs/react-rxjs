import React from "react"
import { useSubscribe } from "./useSubscribe"
import { Observable } from "rxjs"

/**
 * A React Component that creates a subscription to the provided observable once
 * the component mounts and it unsubscribes when the component unmounts.
 *
 * @param source$ Source observable that the Component will subscribe to.
 *
 * @remarks This Component doesn't trigger any updates.
 */
export const Subscribe: React.FC<{
  source$: Observable<any>
}> = ({ source$, children }) => {
  useSubscribe(source$)
  return <>{children}</>
}
