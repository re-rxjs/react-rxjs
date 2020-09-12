import React, { useState, useEffect } from "react"
import { Observable } from "rxjs"

/**
 * A React Component that creates a subscription to the provided observable once
 * the component mounts and it unsubscribes when the component unmounts.
 *
 * @param source$ Source observable that the Component will subscribe to.
 * @param fallback (=null) JSX Element to be rendered before the subscription exists.
 *
 * @remarks This Component doesn't trigger any updates.
 */
export const Subscribe: React.FC<{
  source$: Observable<any>
  fallback?: null | JSX.Element
}> = ({ source$, children, fallback }) => {
  const [mounted, setMounted] = useState(0)
  useEffect(() => {
    const subscription = source$.subscribe()
    setMounted(1)
    return () => subscription.unsubscribe()
  }, [source$])
  return <>{mounted ? children : fallback}</>
}
