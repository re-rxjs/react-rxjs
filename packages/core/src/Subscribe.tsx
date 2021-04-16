import React, {
  useState,
  Suspense,
  ReactNode,
  createContext,
  useContext,
  useLayoutEffect,
} from "react"
import { Subscription } from "rxjs"

const p = Promise.resolve()
const Throw = () => {
  throw p
}

const subscriptionContext = createContext<Subscription>(null as any)
const { Provider } = subscriptionContext

export const useSubscription = () => useContext(subscriptionContext)

/**
 * A React Component that collects the subscriptions of its children
 * and it unsubscribes them when the component unmounts.
 *
 * @param fallback (=null) JSX Element to be rendered before the subscription exists.
 *
 * @remarks This Component doesn't trigger any updates.
 */
export const Subscribe: React.FC<{
  fallback?: NonNullable<ReactNode> | null
}> = ({ children, fallback }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  useLayoutEffect(() => {
    let subscription = new Subscription()
    setSubscription(subscription)
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  return (
    <Suspense fallback={fallback || null}>
      {subscription ? (
        <Provider value={subscription!}>{children}</Provider>
      ) : (
        <Throw />
      )}
    </Suspense>
  )
}
