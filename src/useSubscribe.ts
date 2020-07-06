import { Observable } from "rxjs"
import { useEffect } from "react"

/**
 * A React hook that creates a subscription to the provided observable once the
 * component mounts and it unsubscribes when the component unmounts.
 *
 * @param source$ Source observable that the hook will subscribe to.
 * @param unsubscribeGraceTime (= 200): Amount of time in ms that the hook
 * should wait before unsubscribing from the source observable after it unmounts.
 *
 * @remarks This hook doesn't trigger any updates.
 */
export const useSubscribe = <T>(
  source$: Observable<T>,
  unsubscribeGraceTime = 200,
) => {
  useEffect(() => {
    const subscription = source$.subscribe()
    return () => {
      if (unsubscribeGraceTime === 0) {
        return subscription.unsubscribe()
      }
      setTimeout(() => {
        subscription.unsubscribe()
      }, unsubscribeGraceTime)
    }
  }, [source$, unsubscribeGraceTime])
}
