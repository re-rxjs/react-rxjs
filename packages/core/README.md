# @react-rxjs/core

## Installation
    npm install @react-rxjs/core

## API

### connectObservable
```ts
const [useCounter, sharedCounter$] = connectObservable(
  clicks$.pipe(
    scan(prev => prev + 1, 0),
    startWith(0),
  )
)
```
Accepts: An Observable.

Returns `[1, 2]`

1. A React Hook that yields the latest emitted value of the observable. If the
Observable doesn't synchronously emit a value upon the first subscription, then
the hook will leverage React Suspense while it's waiting for the first value.

2. A `sharedLatest` version of the observable. It can be used for composing other
streams that depend on it. The shared subscription is closed as soon as there
are no subscribers to that observable.

### connectFactoryObservable
```tsx
const [useStory, getStory$] = connectFactoryObservable(
  (storyId: number) => getStoryWithUpdates$(storyId)
)

const Story: React.FC<{id: number}> = ({id}) => {
  const story = useStory(id);

  return (
    <article>
      <h1>{story.title}</h1>
      <p>{story.description}</p>
    </article>
  )
}
```
Accepts: A factory function that returns an Observable.

Returns `[1, 2]`

1. A React Hook function with the same parameters as the factory function. This hook
will yield the latest update from the observable returned from the factory function.
If the Observable doesn't synchronously emit a value upon the first subscription, then
the hook will leverage React Suspense while it's waiting for the first value.

2. A `sharedLatest` version of the observable returned by the factory function. It
can be used for composing other streams that depend on it. The shared subscription
is closed as soon as there are no subscribers to that observable.

### shareLatest
```ts
const activePlanetName$ = planet$.pipe(
  filter(planet => planet.isActive),
  map(planet => planet.name),
  shareLatest()
)
```

A RxJS pipeable operator which shares and replays the latest emitted value. It's
the equivalent of:

```ts
const shareLatest = <T>(): Observable<T> =>
  source$.pipe(
    multicast(() => new ReplaySubject<T>(1)),
    refCount(),
  )
```

The enhanced observables returned from `connectObservable` and `connectFactoryObservable` 
have been enhanced with this operator.

### SUSPENSE

```ts
const story$ = selectedStoryId$.pipe(
  switchMap(id => concat(
    SUSPENSE,
    getStory$(id)
  ))
)
```

This is a special symbol that can be emitted from our observables to let the react hook
know that there is a value on its way, and that we want to leverage React Suspense
while we are waiting for that value.

### suspend

```ts
const story$ = selectedStoryId$.pipe(
  switchMap(id => suspend(getStory$(id))
)
```

A RxJS creation operator that prepends a `SUSPENSE` on the source observable.

### suspended

```ts
const story$ = selectedStoryId$.pipe(
  switchMap(id => getStory$(id).pipe(
    suspended()
  ))
)
```

The pipeable version of `suspend`

### switchMapSuspended

```ts
const story$ = selectedStoryId$.pipe(
  switchMapSuspended(getStory$)
)
```

Like `switchMap` but applying a `startWith(SUSPENSE)` to the inner observable.
