import React, { useState, Suspense, useEffect, ReactNode } from "react"
import { Observable, noop } from "rxjs"

const p = Promise.resolve()
const Throw = () => {
  throw p
}

const initFn = (source$: Observable<any>) => {
  try {
    ;(source$ as any).gV()
    return source$
  } catch (e) {
    return e.then ? source$ : null
  }
}

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
  fallback?: NonNullable<ReactNode> | null
}> = ({ source$, children, fallback }) => {
  const [subscribedSource, setSubscribedSource] = useState(() =>
    initFn(source$),
  )
  if (subscribedSource && subscribedSource !== source$) {
    const result = initFn(source$)
    if (result) {
      setSubscribedSource(result)
    }
  }

  useEffect(() => {
    const subscription = source$.subscribe(noop, (e) =>
      setSubscribedSource(() => {
        throw e
      }),
    )
    setSubscribedSource(source$)
    return () => {
      subscription.unsubscribe()
    }
  }, [source$])
  const fBack = fallback || null
  return (
    <Suspense fallback={fBack}>
      {subscribedSource === source$ ? children : <Throw />}
    </Suspense>
  )
}
