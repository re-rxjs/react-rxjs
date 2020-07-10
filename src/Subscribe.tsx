import React from "react"
import { useSubscribe } from "./useSubscribe"
import { Observable } from "rxjs"

/**
 * A React Component that creates a subscription to the provided observable once
 * the component mounts and it unsubscribes when the component unmounts.
 *
 * @param source$ Source observable that the Component will subscribe to.
 * @param graceTime (= 200): Amount of time in ms that the Component should wait
 * before unsubscribing from the source observable after it unmounts.
 *
 * @remarks This Component doesn't trigger any updates.
 */
export const Subscribe: React.FC<{
  source$: Observable<any>
  graceTime?: number
}> = ({ source$, graceTime, children }) => {
  useSubscribe(source$, graceTime)
  return <>{children}</>
}
