# @react-rxjs/utils

## Installation

    npm install @react-rxjs/utils

## API

### useSubscribe

A React hook that creates a subscription to the provided observable once the
component mounts and it unsubscribes when the component unmounts.

Arguments:

- `source$`: Source observable that the hook will subscribe to.
- `unsubscribeGraceTime`: Amount of time in ms that the hook should wait before
  unsubscribing from the source observable after it unmounts (default = 200).

Important: This hook doesn't trigger any updates.

### Subscribe

A React Component that creates a subscription to the provided observable once
the component mounts and it unsubscribes from it when the component unmounts.

Properties:

- `source$`: Source observable that the Component will subscribe to.
- `graceTime`: an optional property that describes the amount of time in ms
  that the Component should wait before unsubscribing from the source observable
  after it unmounts (default = 200).

Important: This Component doesn't trigger any updates.

### collectValues

A pipeable operator that collects all the GroupedObservables emitted by
the source and emits a Map with the latest values of the inner observables.

```ts
const votesByKey$ = new Subject<{ key: string }>()
const counters$ = votesByKey$.pipe(
  split(
    (vote) => vote.key,
    (votes$) =>
      votes$.pipe(
        mapTo(1),
        scan((count) => count + 1),
        takeWhile((count) => count < 3),
      ),
  ),
  collectValues(),
)

counters$.subscribe((counters) => {
  console.log("counters$:")
  counters.forEach((value, key) => {
    console.log(`${key}: ${value}`)
  })
})

votesByKey$.next({ key: "foo" })
// > counters$:
// > foo: 1

votesByKey$.next({ key: "foo" })
// > counters$:
// > foo: 2

votesByKey$.next({ key: "bar" })
// > counters$:
// > foo: 2
// > bar: 1

votesByKey$.next({ key: "foo" })
// > counters$:
// > bar: 1

votesByKey$.next({ key: "bar" })
// > counters$:
// > bar: 2
//
votesByKey$.next({ key: "bar" })
// > counters$:
```

### mergeWithKey

Emits the values from all the streams of the provided object, in a result
which provides the key of the stream of that emission.

Arguments:

- `inputObject`: Object of streams

```ts
const inc$ = new Subject()
const dec$ = new Subject()
const resetTo$ = new Subject<number>()

const counter$ = mergeWithKey({
  inc$,
  dec$,
  resetTo$,
}).pipe(
  scan((acc, current) => {
    switch (current.type) {
      case "inc$":
        return acc + 1
      case "dec$":
        return acc - 1
      case "resetTo$":
        return current.payload
      default:
        return acc
    }
  }, 0),
  startWith(0),
)
```
