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
import { liftSuspense, StateObservable } from "@rx-state/core"
import { EMPTY_VALUE } from "./internal/empty-value"

const SubscriptionContext = createContext<
  ((src: StateObservable<any>) => void) | null
>(null)
const { Provider } = SubscriptionContext
/**
 * @returns A function that registers a subscription to the nearest `Subscribe`
 */
export const useSubscription = () => useContext(SubscriptionContext)

const p = Promise.resolve()
/**
 * A React Component that throws a promise that resolves immediately to signal
 * to React that the nearest Suspense boundary should fallback and attempt to
 * rerender its children. In theory this can cause a potentially infinite render
 * loop if we repeatedly render this component. In practice, the way we are
 * using it, we know it will only render once or twice.
 */
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
 * subscribe to before it renders its children.
 * @param [fallback] (=null) - JSX Element to be used by the Suspense boundary.
 *
 * @remarks This Component doesn't trigger any updates from the source$.
 */
export const Subscribe: React.FC<{
  children?: React.ReactNode | undefined
  source$?: Observable<any>
  fallback?: NonNullable<ReactNode> | null
}> = ({ source$, children, fallback }) => {
  const subscriptionRef = useRef<{
    subscription: Subscription
    registerSubscription: (source: StateObservable<any>) => void
  }>()

  if (!subscriptionRef.current) {
    const s = new Subscription()
    subscriptionRef.current = {
      subscription: s,
      registerSubscription: (src) => {
        let error = EMPTY_VALUE
        let synchronous = true
        s.add(
          // create a subscription to src; we are not concerned with consuming
          // the values, only with instantiating the subscription and handling
          // errors
          liftSuspense()(src).subscribe({
            error: (e) => {
              if (synchronous) {
                // Can't setState of this component when another one is rendering.
                error = e
                return
              }
              setSubscribedSource(() => {
                throw e
              })
            },
          }),
        )
        synchronous = false
        if (error !== EMPTY_VALUE) {
          throw error
        }
      },
    }
  }

  const [subscribedSource, setSubscribedSource] = useState<
    Observable<any> | null | undefined
  >(null)

  if (subscribedSource !== null && subscribedSource !== source$) {
    if (source$ === undefined) {
      setSubscribedSource(source$)
    } else {
      try {
        // don't setSubscribedSource if getValue() throws, because if it does,
        // source$ is in an error state
        ;(source$ as any).getValue()
        setSubscribedSource(source$)
      } catch (e: any) {}
    }
  }

  useEffect(() => {
    setSubscribedSource(source$)
    if (!source$) return

    const subscription = liftSuspense()(source$).subscribe({
      error: (e) =>
        setSubscribedSource(() => {
          throw e
        }),
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [source$])

  useEffect(() => {
    return () => {
      subscriptionRef.current?.subscription.unsubscribe()
      subscriptionRef.current = undefined
    }
  }, [])

  // If source$ was not provided, both source$ and subscribedSource$ will be
  // undefined. If source$ was provided, suspend and trigger re-render until we
  // know it was subscribed to.
  const actualChildren =
    subscribedSource === source$ ? (
      <Provider value={subscriptionRef.current!.registerSubscription}>
        {children}
      </Provider>
    ) : fallback === undefined ? null : (
      <Throw />
    )

  return fallback === undefined ? (
    actualChildren
  ) : subscribedSource === null ? (
    fallback
  ) : (
    <Suspense fallback={fallback}>{actualChildren}</Suspense>
  )
}

/**
 * Component that prevents its children from using the parent `Subscribe` boundary
 * to manage their subscriptions.
 */
export const RemoveSubscribe: React.FC<{
  children?: React.ReactNode | undefined
}> = ({ children }) => <Provider value={null}>{children}</Provider>
