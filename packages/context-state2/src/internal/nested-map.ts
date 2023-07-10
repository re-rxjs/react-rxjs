export const Wildcard = Symbol("Wildcard")
export type Wildcard = typeof Wildcard

export class NestedMap<K, V> {
  private root: Map<K, any>
  private rootValue?: V
  constructor() {
    this.root = new Map()
    this.rootValue = undefined
  }

  get(keys: K[]): V | undefined {
    if (keys.length === 0) return this.rootValue
    let current: any = this.root
    for (let i = 0; i < keys.length; i++) {
      current = current.get(keys[i])
      if (!current) return undefined
      // a child instance could be checking for a parent instance with its (longer) key
      if (!(current instanceof Map)) return current
    }
    return current
  }

  set(keys: K[], value: V): void {
    if (keys.length === 0) {
      this.rootValue = value
      return
    }
    let current: Map<K, any> = this.root
    let i
    for (i = 0; i < keys.length - 1; i++) {
      let nextCurrent = current.get(keys[i])
      if (!nextCurrent) {
        nextCurrent = new Map<K, any>()
        current.set(keys[i], nextCurrent)
      }
      current = nextCurrent
    }
    current.set(keys[i], value)
  }

  delete(keys: K[]): void {
    if (keys.length === 0) {
      delete this.rootValue
      return
    }
    const maps: Map<K, any>[] = [this.root]
    let current: Map<K, any> = this.root

    for (let i = 0; i < keys.length - 1; i++) {
      maps.push((current = current.get(keys[i])))
    }

    let mapIdx = maps.length - 1
    maps[mapIdx].delete(keys[mapIdx])

    while (--mapIdx > -1 && maps[mapIdx].get(keys[mapIdx]).size === 0) {
      maps[mapIdx].delete(keys[mapIdx])
    }
  }

  *values(keys?: Array<K | typeof Wildcard>): Generator<V, void, void> {
    if (this.rootValue && (!keys || keys.length === 0)) {
      yield this.rootValue
    }

    const mapsToIterate: Array<[Map<K, any>, number]> = [[this.root, 0]]
    let iteration: [Map<K, any>, number] | undefined
    while ((iteration = mapsToIterate.pop())) {
      const [map, depth] = iteration
      for (let [key, value] of map) {
        if (keys && keys[depth] !== Wildcard && keys[depth] !== key) continue
        if (value instanceof Map) {
          mapsToIterate.push([value, depth + 1])
        } else {
          yield value
        }
      }
    }
  }
}
