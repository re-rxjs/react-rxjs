import { defer, OperatorFunction, scan } from "rxjs"
import { defaultStart } from "./internal-utils"
import { KeyChanges } from "./partitionByKey"

export function toKeySet<K>(): OperatorFunction<KeyChanges<K>, Set<K>> {
  return (source$) =>
    defer(() => {
      const result = new Set<K>()
      return source$.pipe(
        scan((acc, changes) => {
          if (changes.type === "add") {
            for (let k of changes.keys) {
              acc.add(k)
            }
          } else {
            for (let k of changes.keys) {
              acc.delete(k)
            }
          }

          return acc
        }, result),
        defaultStart(result),
      )
    })
}
