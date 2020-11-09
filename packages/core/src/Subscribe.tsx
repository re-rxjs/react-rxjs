import React, { useState, Suspense, useLayoutEffect, ReactNode } from "react"
import { Observable, noop } from "rxjs"

const p = Promise.resolve()
const Throw = () => {
  throw p
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
  const [mounted, setMounted] = useState(() => {
    try {
      ;(source$ as any).gV()
      return source$
    } catch (e) {
      return e.then ? source$ : null
    }
  })
  useLayoutEffect(() => {
    const subscription = source$.subscribe(noop, (e) =>
      setMounted(() => {
        throw e
      }),
    )
    setMounted(source$)
    return () => {
      subscription.unsubscribe()
    }
  }, [source$])
  const fBack = fallback || null
  return (
    <Suspense fallback={fBack}>
      {mounted === source$ ? children : <Throw />}
    </Suspense>
  )
}
