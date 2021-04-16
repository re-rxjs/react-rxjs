import React, {
  useState,
  Suspense,
  useEffect,
  ReactNode,
  useRef,
  createContext,
  useContext,
} from "react"
import { Observable, Subscription } from "rxjs"

const SubscriptionContext = createContext<Subscription>(null as any)
const { Provider } = SubscriptionContext
export const useSubscription = () => useContext(SubscriptionContext)

const p = Promise.resolve()
const Throw = () => {
  throw p
}

/**
 * A React Component that:
 * - collects the subscriptions of its children and it unsubscribes them when
 * the component unmounts.
 * - if a source$ property is used, then it ensures that the subscription to the
 * observable will exist before the children gets rendered, and it unsubscribes
 * from it when the component unmounts.
 *
 * If the fallback property is used, then the component will create a Suspense
 * boundary with the provided JSX Element, otherwise it will render null until
 * the subscription exists.
 *
 * @param [source$] (=undefined) - Source observable that the Component will
 * subscrib to before it renders its children.
 * @param [fallback] (=null) - JSX Element to be used by the Suspense boundary.
 *
 * @remarks This Component doesn't trigger any updates from the source$.
 */
export const Subscribe: React.FC<{
  source$?: Observable<any>
  fallback?: NonNullable<ReactNode> | null
}> = ({ source$, children, fallback }) => {
  const subscriptionRef = useRef<Subscription>()

  if (!subscriptionRef.current) {
    subscriptionRef.current = new Subscription()
  }

  const [subscribedSource, setSubscribedSource] = useState<
    Observable<any> | null | undefined
  >(null)

  if (subscribedSource !== null && subscribedSource !== source$) {
    if (source$ === undefined) {
      setSubscribedSource(source$)
    } else {
      let result: any
      try {
        ;(source$ as any).gV()
        result = source$
      } catch (e) {
        result = e.then ? source$ : null
      }
      if (result) {
        setSubscribedSource(result)
      }
    }
  }

  useEffect(() => {
    const subscription =
      source$ &&
      source$.subscribe({
        error: (e) =>
          setSubscribedSource(() => {
            throw e
          }),
      })
    setSubscribedSource(source$)
    return () => {
      subscription && subscription.unsubscribe()
    }
  }, [source$])

  useEffect(() => {
    return () => {
      subscriptionRef.current!.unsubscribe()
    }
  }, [])

  const actualChildren =
    subscribedSource === source$ ? (
      <Provider value={subscriptionRef.current!}>{children}</Provider>
    ) : fallback === undefined ? null : (
      <Throw />
    )

  return fallback === undefined ? (
    actualChildren
  ) : (
    <Suspense fallback={fallback}>{actualChildren}</Suspense>
  )
}
