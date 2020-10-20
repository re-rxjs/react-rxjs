import { Observable } from "rxjs"
import { useEffect } from "react"

/**
 * A React hook that creates a subscription to the provided observable once the
 * component mounts and it unsubscribes when the component unmounts.
 *
 * @param source$ Source observable that the hook will subscribe to.
 * @returns void
 *
 * @remarks This hook doesn't trigger any updates.
 */
export const useSubscribe = <T>(source$: Observable<T>) => {
  useEffect(() => {
    const subscription = source$.subscribe()
    return () => {
      subscription.unsubscribe()
    }
  }, [source$])
}
