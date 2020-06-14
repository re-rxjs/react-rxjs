# <img src="assets/logo-128.png" alt="Re-RxJS Logo" width="86" height="86"> Re-RxJS: React bindings for RxJS
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

- :cyclone: Truly Reactive
- :twisted_rightwards_arrows: First class support for React Suspense
- :scissors: Decentralized and composable, thus enabling optimal code-splitting
- :zap: Highly performant (while avoiding memory leaks)
- :microscope: Tiny and tree-shakeable

## Examples

- [This is a contrived example](https://codesandbox.io/s/crazy-wood-vn7gg?file=/src/fakeApi.js) based on [this example](https://reactjs.org/docs/concurrent-mode-patterns.html#reviewing-the-changes) from the React docs.

## Docs
```tsx
const useDocs = connectObservable(NEVER)

function Docs() {
  const docs = useDocs()
  return <pre>{docs}</pre>
}

function App() {
  return (
    <>
      <h1>Docs</h1>
      <Suspense fallback={() => <span>Comming soon...</span>}>
        <Docs />
      </Suspense>
    </>
  )
}
```

Now seriously: they are coming soon, for real! 

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/josepot"><img src="https://avatars1.githubusercontent.com/u/8620144?v=4" width="100px;" alt=""/><br /><sub><b>Josep M Sobrepere</b></sub></a><br /><a href="https://github.com/re-rxjs/re-rxjs/commits?author=josepot" title="Code">💻</a> <a href="#ideas-josepot" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-josepot" title="Maintenance">🚧</a> <a href="https://github.com/re-rxjs/re-rxjs/commits?author=josepot" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/voliva"><img src="https://avatars2.githubusercontent.com/u/5365487?v=4" width="100px;" alt=""/><br /><sub><b>Víctor Oliva</b></sub></a><br /><a href="#ideas-voliva" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/re-rxjs/re-rxjs/pulls?q=is%3Apr+reviewed-by%3Avoliva" title="Reviewed Pull Requests">👀</a></td>
    <td align="center"><a href="http://www.clayforthcarr.com"><img src="https://avatars3.githubusercontent.com/u/6012083?v=4" width="100px;" alt=""/><br /><sub><b>Ed</b></sub></a><br /><a href="#design-clayforthcarr" title="Design">🎨</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
