<div align="center">
  <h1>Re-RxJS</h1>

<img
  height="86"
  width="86"
  alt="Re-RxJS Logo"
  src="https://raw.githubusercontent.com/re-rxjs/re-rxjs/main/assets/logo-128.png"
/>

<p>React bindings for RxJS</p>

</div>

<hr />

<!-- prettier-ignore-start -->
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->
<!-- prettier-ignore-end -->

Main features
-------------
- :cyclone: Truly Reactive
- :zap: Highly performant and free of memory-leaks
- :twisted_rightwards_arrows: First class support for React Suspense
- :scissors: Decentralized and composable, thus enabling optimal code-splitting
- :microscope: Tiny and tree-shakeable
- :muscle: Supports TypeScript

## Docs
```tsx
const [useDocs] = connectObservable(NEVER)

function Docs() {
  const docs = useDocs()
  return <pre>{docs}</pre>
}

function App() {
  return (
    <>
      <h1>Docs</h1>
      <Suspense fallback={<span>Comming soon...</span>}>
        <Docs />
      </Suspense>
    </>
  )
}
```

## Examples
- [This is a contrived example](https://codesandbox.io/s/crazy-wood-vn7gg?file=/src/fakeApi.js) based on [this example](https://reactjs.org/docs/concurrent-mode-patterns.html#reviewing-the-changes) from the React docs.

- A search for Github repos that highlights the most recently updated one:

```tsx
import React, { Suspense } from "react"
import { Subject } from "rxjs"
import { startWith, map } from "rxjs/operators"
import { connectObservable, switchMapSuspended } from "re-rxjs"
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
    <td align="center"><a href="https://github.com/josepot"><img src="https://avatars1.githubusercontent.com/u/8620144?v=4" width="100px;" alt=""/><br /><sub><b>Josep M Sobrepere</b></sub></a><br /><a href="https://github.com/re-rxjs/re-rxjs/commits?author=josepot" title="Code">💻</a> <a href="#ideas-josepot" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-josepot" title="Maintenance">🚧</a> <a href="https://github.com/re-rxjs/re-rxjs/commits?author=josepot" title="Tests">⚠️</a> <a href="https://github.com/re-rxjs/re-rxjs/pulls?q=is%3Apr+reviewed-by%3Ajosepot" title="Reviewed Pull Requests">👀</a></td>
    <td align="center"><a href="https://github.com/voliva"><img src="https://avatars2.githubusercontent.com/u/5365487?v=4" width="100px;" alt=""/><br /><sub><b>Víctor Oliva</b></sub></a><br /><a href="#ideas-voliva" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/re-rxjs/re-rxjs/pulls?q=is%3Apr+reviewed-by%3Avoliva" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/re-rxjs/re-rxjs/commits?author=voliva" title="Code">💻</a> <a href="https://github.com/re-rxjs/re-rxjs/commits?author=voliva" title="Tests">⚠️</a></td>
    <td align="center"><a href="http://www.clayforthcarr.com"><img src="https://avatars3.githubusercontent.com/u/6012083?v=4" width="100px;" alt=""/><br /><sub><b>Ed</b></sub></a><br /><a href="#design-clayforthcarr" title="Design">🎨</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
