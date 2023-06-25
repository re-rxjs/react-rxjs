import { of } from "rxjs"
import { createStateNode } from "./internal"
import { StateNode } from "./types"

type RootNodeKey<K extends string, V> = K extends "" ? {} : Record<K, V>
export interface RootNode<V, K extends string>
  extends StateNode<never, RootNodeKey<K, V>> {
  run: K extends "" ? () => () => void : (key: V) => () => void
}

export function createRoot(): RootNode<never, "">
export function createRoot<KeyValue, KeyName extends string>(
  keyName: KeyName,
): RootNode<KeyValue, KeyName>
export function createRoot<KeyValue = never, KeyName extends string = "">(
  keyName?: KeyName,
): RootNode<KeyValue, KeyName> {
  const internalNode = createStateNode<
    null,
    RootNodeKey<KeyName, KeyValue>,
    null
  >(keyName ? [keyName] : [], null, () => of(null))

  internalNode.public.getState$ = () => {
    throw new Error("RootNode doesn't have value")
  }
  internalNode.public.getValue = () => {
    throw new Error("RootNode doesn't have value")
  }

  const result: RootNode<KeyValue, KeyName> = Object.assign(
    internalNode.public as any,
    {
      run: (root?: KeyValue) => {
        const key = (
          keyName
            ? {
                [keyName]: root,
              }
            : {}
        ) as RootNodeKey<KeyName, KeyValue>

        internalNode.addInstance(key)
        internalNode.activateInstance(key)
        return () => {
          internalNode.removeInstance(key)
        }
      },
    },
  )
  return result
}
