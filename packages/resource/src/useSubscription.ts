import { SubscriptionResource } from "./createSubscription"
import { useState, useEffect } from "react"

export function useSubscription<T>(subscription: SubscriptionResource<T>) {
  const [value, setValue] = useState(subscription.getValue())

  useEffect(
    () => subscription.subscribe(() => setValue(() => subscription.getValue())),
    [subscription],
  )

  return value
}
