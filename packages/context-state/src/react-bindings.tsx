import React, {
  FC,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { Subscription } from "rxjs"
import { Instance, StatePromise, getInternals } from "./internal"
import { KeysBaseType, StateNode } from "./types"

type VoidCb = () => void

interface Ref<T, K> {
  source$: Instance<T, K>
  args: [(cb: VoidCb) => VoidCb, () => T]
}

type KeyDef = { key: string; value: unknown }
const KeyContext = createContext<(key: string) => unknown>((key) => {
  throw new Error(`Missing key param or provider for "${key}"`)
})

export const KeyProvider: FC<PropsWithChildren<KeyDef>> = ({
  children,
  key,
  value,
}) => {
  const parent = useContext(KeyContext)

  const valueGetter = useCallback(
    (keyRequested: string) =>
      keyRequested === key ? value : parent(keyRequested),
    [parent, key, value],
  )

  return (
    <KeyContext.Provider value={valueGetter}>{children}</KeyContext.Provider>
  )
}

export const useStateNode = <O, K extends KeysBaseType>(
  stateNode: StateNode<O, K>,
  key: Partial<K> = {},
): O => {
  const keyGetter = useContext(KeyContext)
  const [, setError] = useState()
  const callbackRef = useRef<Ref<O, K>>()

  const internals = getInternals(stateNode)
  const keyObj = Object.fromEntries(
    internals.keysOrder.map((k) => [
      k,
      k in key ? key[k] : keyGetter(k as string),
    ]),
  )
  const instance = internals.getInstance(keyObj as K)

  if (!callbackRef.current) {
    const getValue = (src: StateNode<O, any>) => {
      const result = src.getValue()
      if (result instanceof StatePromise) throw result
      return result
    }

    const gv = () => getValue(callbackRef.current!.source$)

    callbackRef.current = {
      source$: null as any,
      args: [, gv] as any,
    }
  }

  const ref = callbackRef.current
  if (ref.source$ !== instance) {
    ref.source$ = instance
    ref.args[0] = (next: () => void) => {
      const subscription = new Subscription()
      subscription.add(
        instance.getState$().subscribe({
          next,
          error: (e) => {
            setError(() => {
              throw e
            })
          },
          complete() {
            next()
            subscription.add(ref.args[0](next))
          },
        }),
      )
      return () => {
        subscription.unsubscribe()
      }
    }
  }

  return useSyncExternalStore(...ref!.args)
}
