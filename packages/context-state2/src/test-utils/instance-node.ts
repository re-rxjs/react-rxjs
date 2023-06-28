import { of } from "rxjs"
import { InternalStateNode, createStateNode, getInternals } from "../internal"
import { KeysBaseType, StateNode } from "../types"

export function instanceNode<T, K extends KeysBaseType, KN extends string>(
  parent: StateNode<T, K>,
  keyName: KN,
) {
  type MergedKey = {
    [key in keyof (K & Record<KN, any>)]: (K & Record<KN, any>)[key]
  }
  const parentInternals = getInternals(parent)
  const result: InternalStateNode<any, MergedKey> = createStateNode(
    [...parentInternals.keysOrder, keyName],
    [parentInternals],
    (_ctx, _obs, key) => of(key[keyName]),
  )

  return Object.assign(result.public, {
    addInstance(key: MergedKey) {
      result.addInstance(key)
      result.activateInstance(key)
    },
    removeInstance(key: MergedKey) {
      result.removeInstance(key)
    },
  })
}
