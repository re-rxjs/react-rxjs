import { Observable } from "rxjs"
import useLayoutEffect from "./useLayoutEffect"

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
  useLayoutEffect(() => {
    const subscription = source$.subscribe()
    return () => subscription.unsubscribe()
  }, [source$])
}
