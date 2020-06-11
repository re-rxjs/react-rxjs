# re-rxjs

## The ultimate React-RxJS bindings

- :cyclone: Truly Reactive
- :twisted_rightwards_arrows: First class support for React Suspense
- :scissors: Decentralized and composable, thus enabling optimal code-splitting
- :zap: Highly performant (while avoiding memory leaks)
- :microscope: Tiny and tree-shakeable

## Examples

- [This is a contrived example](https://codesandbox.io/s/crazy-wood-vn7gg?file=/src/fakeApi.js) based on [this example](https://reactjs.org/docs/concurrent-mode-patterns.html#reviewing-the-changes) from the React docs.

## Docs
```tsx
const useDocs = () => useObservable(NEVER)

function Docs() {
  const docs = useDocs()
  return <pre>{docs}</pre>
}

function App() {
  return (
    <>
      <h1>Docs</h1>
      <Suspense fallback={() => <h2>Comming soon...</h1>}>
        <Docs />
      </Suspense>
    </>
  )
}
```

Now seriously: they are coming soon, for real! 
