# <img height="86" width="86" alt="React-RxJS Logo" src="assets/logo-128.png" /> React-RxJS: React bindings for RxJS

<!-- prettier-ignore-start -->
[![Build Status](https://img.shields.io/travis/re-rxjs/react-rxjs.svg?style=flat-square)](https://travis-ci.org/re-rxjs/react-rxjs)
[![codecov](https://img.shields.io/codecov/c/github/re-rxjs/react-rxjs.svg?style=flat-square)](https://codecov.io/gh/re-rxjs/react-rxjs)
[![version](https://img.shields.io/npm/v/react-rxjs.svg?style=flat-square)](https://www.npmjs.com/package/react-rxjs)
[![MIT License](https://img.shields.io/npm/l/react-rxjs.svg?style=flat-square)](https://github.com/re-rxjs/react-rxjs/blob/main/LICENSE)
[![All Contributors](https://img.shields.io/badge/all_contributors-5-orange.svg?style=flat-square)](#contributors-)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Code of Conduct](https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square)](https://github.com/re-rxjs/react-rxjs/blob/main/CODE_OF_CONDUCT.md)
<!-- prettier-ignore-end -->

## Main features

- :cyclone: Truly Reactive
- :zap: Highly performant and free of memory-leaks
- :twisted_rightwards_arrows: First class support for React Suspense and [ready for Concurrent Mode](https://github.com/dai-shi/will-this-react-global-state-work-in-concurrent-mode#results)
- :scissors: Decentralized and composable, thus enabling optimal code-splitting
- :microscope: [Tiny and tree-shakeable](https://bundlephobia.com/result?p=react-rxjs)
- :muscle: Supports TypeScript

## Table of Contents

- [Installation](#installation)
- [API](#api)
  - Core
    - [connectObservable](#connectObservable)
    - [connectFactoryObservable](#connectFactoryObservable)
    - [shareLatest](#shareLatest)
  - React Suspense Support
    - [SUSPENSE](#SUSPENSE)
    - [suspend](#suspend)
    - [suspended](#suspended)
    - [switchMapSuspended](#switchMapSuspended)
  - Utils
    - [subjectFactory](#subjectFactory)
- [Examples](#examples)


## Installation
    npm install react-rxjs

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
      <p>{story.description</p>
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

### subjectFactory

```tsx
const getCounterActions$ = subjectFactory<string, 'INC' | 'DEC'>()

const onInc = (id: string) => getCounterActions$(id).next('INC')
const onDec = (id: string) => getCounterActions$(id).next('DEC')

const useCounter = connectFactoryObservable(
  (id: string) => getCounterActions$(id).pipe(
    map(type => type === 'INC' ? 1 : -1)
    startWith(0),
    scan((a, b) => a + b)
  )
)

const Counter: React.FC<{id: string}> = ({id}) => {
  const counter = useCounter(id);
  return (
    <button onClick={onDec(id)} />-</button>
    {counter}
    <button onClick={onInc(id)} />+</button
  )
}
```

Creates a pool of Subjects identified by key, and returns:
- A function that accepts a key and returns the Subject linked to that key.

Strictly speaking the returned value is not a real Subject. It's in fact a
multicasted Observable that it's also an Observer. That's because in order to
prevent memory-leaks this cached Observable will be removed from the cache when
it finalizes.

## Examples
- [This is a contrived example](https://codesandbox.io/s/crazy-wood-vn7gg?file=/src/fakeApi.js) based on [this example](https://reactjs.org/docs/concurrent-mode-patterns.html#reviewing-the-changes) from the React docs.

- A search for Github repos that highlights the most recently updated one:

```tsx
import React, { Suspense } from "react"
import { Subject } from "rxjs"
import { startWith, map } from "rxjs/operators"
import { connectObservable, switchMapSuspended } from "react-rxjs"
import { Header, Search, LoadingResults, Repo } from "./components"

interface Repo {
  id: number
  name: string
  description: string
  author: string
  stars: number
  lastUpdate: number
}

const searchInput$ = new Subject<string>()
const onSubmit = (value: string) => searchInput$.next(value)

const findRepos = (query: string): Promise<Repo[]> =>
  fetch(`https://api.github.com/search/repositories?q=${query}`)
    .then(response => response.json())
    .then(rawData =>
      (rawData.items ?? []).map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        description: repo.description,
        author: repo.owner.login,
        stars: repo.stargazers_count,
        lastUpdate: Date.parse(repo.update_at),
      })),
    )

const [useRepos, repos$] = connectObservable(
  searchInput$.pipe(
    switchMapSuspended(findRepos),
    startWith(null),
  ),
)

function Repos() {
  const repos = useRepos()

  if (repos === null) {
    return null
  }

  if (repos.length === 0) {
    return <div>No results were found.</div>
  }

  return (
    <ul>
      {repos.map(repo => (
        <li key={repo.id}>
          <Repo {...repo} />
        </li>
      ))}
    </ul>
  )
}

const [useMostRecentlyUpdatedRepo] = connectObservable(
  repos$.pipe(
    map(repos =>
      Array.isArray(repos) && repos.length > 0
        ? repos.reduce((winner, current) =>
            current.lastUpdate > winner.lastUpdate ? current : winner,
          )
        : null,
    ),
  ),
)

function MostRecentlyUpdatedRepo() {
  const mostRecent = useMostRecentlyUpdatedRepo()

  if (mostRecent === null) {
    return null
  }

  const { id, name } = mostRecent
  return (
    <div>
      The most recently updated repo is <a href={`#${id}`}>{name}</a>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Header>Search Github Repos</Header>
      <Search onSubmit={onSubmit} />
      <Suspense fallback={<LoadingResults />}>
        <MostRecentlyUpdatedRepo />
        <Repos />
      </Suspense>
    </>
  )
}
```

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/josepot"><img src="https://avatars1.githubusercontent.com/u/8620144?v=4" width="100px;" alt=""/><br /><sub><b>Josep M Sobrepere</b></sub></a><br /><a href="https://github.com/react-rxjs/react-rxjs/commits?author=josepot" title="Code">💻</a> <a href="#ideas-josepot" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-josepot" title="Maintenance">🚧</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=josepot" title="Tests">⚠️</a> <a href="https://github.com/react-rxjs/react-rxjs/pulls?q=is%3Apr+reviewed-by%3Ajosepot" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=josepot" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/voliva"><img src="https://avatars2.githubusercontent.com/u/5365487?v=4" width="100px;" alt=""/><br /><sub><b>Víctor Oliva</b></sub></a><br /><a href="#ideas-voliva" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/react-rxjs/react-rxjs/pulls?q=is%3Apr+reviewed-by%3Avoliva" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=voliva" title="Code">💻</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=voliva" title="Tests">⚠️</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=voliva" title="Documentation">📖</a></td>
    <td align="center"><a href="http://www.clayforthcarr.com"><img src="https://avatars3.githubusercontent.com/u/6012083?v=4" width="100px;" alt=""/><br /><sub><b>Ed</b></sub></a><br /><a href="#design-clayforthcarr" title="Design">🎨</a></td>
    <td align="center"><a href="https://github.com/pgrimaud"><img src="https://avatars1.githubusercontent.com/u/1866496?v=4" width="100px;" alt=""/><br /><sub><b>Pierre Grimaud</b></sub></a><br /><a href="https://github.com/react-rxjs/react-rxjs/commits?author=pgrimaud" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/bhavesh-desai-scratch"><img src="https://avatars3.githubusercontent.com/u/15194540?v=4" width="100px;" alt=""/><br /><sub><b>Bhavesh Desai</b></sub></a><br /><a href="https://github.com/react-rxjs/react-rxjs/pulls?q=is%3Apr+reviewed-by%3Abhavesh-desai-scratch" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=bhavesh-desai-scratch" title="Documentation">📖</a> <a href="https://github.com/react-rxjs/react-rxjs/commits?author=bhavesh-desai-scratch" title="Tests">⚠️</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
