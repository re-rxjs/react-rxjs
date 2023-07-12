## 0.10.6 (2023-07-12)

- fix(webpack build): default condition should be last one (#304)

## 0.10.5 (2023-07-11)

- fix: types not read when moduleResolution is not "node" (#302)

### utils@0.9.6

- fix(selfDependent): prevent subject from being closed after unsubscription (#283)

## 0.10.4 (2023-03-11)

- fix: can't derive a StateObservable with takeUntil

## 0.10.3 (2022-09-09)

- fix: avoid errors on unmounted Suspense components

## 0.10.2 (2022-09-09)

- fix: pipeState also enhanced as a React element (#282)

## 0.10.1 (2022-09-09)

- fix: re-export types correctly from @rx-state/core

### utils

- chore: rename `selfDependant` to `selfDependent` (#272)

## 0.10.0 (2022-09-09)

- StateObservables as JSX Elements.

StateObservables are now also JSX Elements, which lets you use them directly as children of other components.

```tsx
const count$ = state(interval(1000), 0)

const App = () => {
  const count = useStateObservable(count$)

  return <div>{count}</div>
}

// Becomes

const App = () => {
  return <div>{count$}</div>
}
```

- `.pipeState()`, `withDefault()`

StateObservables now have a shorthand method `.pipeState(...args)` which works as RxJS `.pipe(`, but it wraps the result into a new state.

```ts
const newState$ = state(
  parent$.pipe(
    map(...)
  )
)

// Becomes
const newState$ = parent$.pipeState(
  map(...)
)
```

`withDefault(value)` is an operator that creates a DefaultedStateObservable. It can be used at the end of `pipeState` to set the default value for that one.

```ts
const newState$ = state(
  parent$.pipe(
    map(...)
  ),
  "defaultVal"
)

// Becomes
const newState$ = parent$.pipeState(
  map(...),
  withDefault("defaultVal")
)
```

- Add additional argument on factory observables to prevent using them in incompatible HOF.

Previously factory functions had the same signature that was passed into the function. You can use them in higher-order-functions and Typescript will think it's valid:

```ts
const user$ = state((id: string) => ...);

const selectedUser$ = state(
  selectedId$.pipe(
    switchMap(user$)
  )
);
```

This is problematic because `switchMap` also passes in the number of elements emitted so far as the second argument, and the parametric state will then understand each call as a new instance.

Now `user$` will have a typescript signature that will prevent it from being used into places that give more parameters than it has, so Typescript will flag this as an error.

- `sinkSuspense()`, `liftSuspense()`

These two new operators help deal with SUSPENSE values on the streams, which is useful when the meaning of SUSPENSE is that everything needs to be reset.

`sinkSuspense()` is an operator that when it receives a SUSPENSE, it will throw it as an error down the stream, which resets all of the observables down below. It will then hold the subscription to the upstream, waiting for a resubscription to happen immediately. If it doesn't happen, then it will unsubscribe from upstream.

`liftSuspense()` is an operator that when it receives SUSPENSE as an error, it will immediately resubscribe to its upstream, and emit SUSPENSE as a value.

This allows to avoid dealing with SUSPENSE on the streams that are in-between the one that generates SUSPENSE and the one that needs to receive it.

```ts
const account$ = accountSwitch$.pipe(switchMapSuspended((v) => fetchAccount(v)))

const posts$ = account$.pipe(
  switchMap((v) => (v === SUSPENSE ? of(SUSPENSE) : fetchPosts(v))),
)

/// with sinkSuspense
const account$ = accountSwitch$.pipe(
  switchMapSuspended((v) => fetchAccount(v)),
  sinkSuspense(),
)

const posts$ = account$.pipe(switchMap((v) => fetchPosts(v)))
```

`useStateObservable` is already fitted with `liftSuspense()`, so there's no need to call it on the StateObservables that are to be used in components.

It's very important to remember that `sinkSuspense` is throwing SUSPENSE values as errors, which means that subscriptions will get closed, in ways that are not always obvious. In most of the cases, it can be solved by using `liftSuspense()`, dealing with that value, and calling `sinkSuspense()` again. Use at your own risk.

### Fixes

- Fix observable of promises triggering suspense.
- Fix observables emitting synchronous completes triggering NoSubscribersError on Subscribe

## 0.9.8 (2022-06-24)

- Fix asynchronous errors on Subscribe not getting caught on ErrorBoundaries.

## 0.9.7 (2022-06-14)

- Fix Subscribe error on immediate unmount when running in React18 StrictMode

## 0.9.6 (2022-04-29)

- RemoveSubscribe

New component that prevents its children from using a parent `<Subscribe>` to manage their subscriptions.

- improve SUSPENSE types

## 0.9.5 (2022-04-11)

- upgrade dependencies (React 18)

## 0.9.4 (2022-04-04)

- utils: `toKeySet()`

Operator that turns an `Observable<KeyChanges<K>>` into an `Observable<Set<K>>`

- fix useStateObservable on StateObservables that emit synchronously without default value.
- fix partitionByKey not emitting synchronously when a new group came in.

## 0.9.3 (2022-03-30)

- utils: Improve performance of `partitionByKey` with a big number of elements (#232)

BREAKING CHANGE: partitionByKey's key stream now returns deltas `Observable<KeyChanges<K>>` instead of list of keys `Observable<K[]>`. Shouldn't have an impact if the stream was used directly into `combineKeys`.

- fix Subscribe running in react18 StrictMode (#249)

## 0.9.2 (2022-03-29)

- fix React Native build

## 0.9.1 (2022-03-27)

- fix types for DefaultedStateObservable
- fix compile error on Next.js 12

## 0.9.0 (2022-03-20)

- `state()`, `useStateObservable()`

There's a different way of creating and consuming observables now.

Instead of calling `bind` which returns a hook and a shared observable, `state()` just returns the shared observable. This can be consumed in the components by using the hook `useStateObservable()`.

```tsx
const [useUser, user$] = bind(fetchUser());

const App = () => {
  const user = useUser();

  ...
}

// Becomes
const user$ = state(fetchUser());

const App = () => {
  const user = useStateObservable(user$);

  ...
}
```
