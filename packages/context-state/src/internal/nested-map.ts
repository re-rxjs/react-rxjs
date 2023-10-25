import { EMPTY_VALUE } from "./empty-value"

export const Wildcard = Symbol("Wildcard")
export type Wildcard = typeof Wildcard

export class NestedMap<K, V> {
  protected subtree: Map<K, NestedMap<K, V>> = new Map()
  protected value: V | EMPTY_VALUE = EMPTY_VALUE

  get(keys: K[]): V | undefined {
    let current: NestedMap<K, V> = this
    for (let i = 0; i < keys.length; i++) {
      const next = current.subtree.get(keys[i])
      if (!next) return undefined
      current = next
    }

    return current.value === EMPTY_VALUE ? undefined : current.value
  }

  set(keys: K[], value: V): void {
    let current: NestedMap<K, V> = this
    for (let i = 0; i < keys.length; i++) {
      let nextCurrent = current.subtree.get(keys[i])
      if (!nextCurrent) {
        nextCurrent = new NestedMap<K, V>()
        current.subtree.set(keys[i], nextCurrent)
      }
      current = nextCurrent
    }
    current.value = value
  }

  delete(keys: K[]): void {
    let current: NestedMap<K, V> = this
    const maps = [current]

    for (let i = 0; i < keys.length; i++) {
      const next = current.subtree.get(keys[i])
      if (!next) break
      maps.push((current = next))
    }

    current.value = EMPTY_VALUE
    let currentIdx = maps.length
    while (
      --currentIdx > 0 &&
      maps[currentIdx].value === EMPTY_VALUE &&
      maps[currentIdx].subtree.size === 0
    ) {
      maps[currentIdx - 1].subtree.delete(keys[currentIdx - 1])
    }
  }

  *values(keys?: Array<K | typeof Wildcard>): Generator<V, void, void> {
    if (this.value !== EMPTY_VALUE && (!keys || keys.length === 0)) {
      yield this.value
    }

    const mapsToIterate: Array<[NestedMap<K, V>, number]> = [[this, 0]]
    let iteration: [NestedMap<K, V>, number] | undefined
    while ((iteration = mapsToIterate.pop())) {
      const [map, depth] = iteration
      if (
        map.value !== EMPTY_VALUE &&
        (!keys || keys.length <= depth || keys[depth] === Wildcard)
      ) {
        yield map.value
      }
      for (let [key, nestedMap] of map.subtree) {
        if (keys && keys[depth] !== Wildcard && keys[depth] !== key) continue

        mapsToIterate.push([nestedMap, depth + 1])
        if (nestedMap.value !== EMPTY_VALUE) {
          yield nestedMap.value
        }
      }
    }
  }
}
