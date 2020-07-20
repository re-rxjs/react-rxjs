# @react-rxjs/dom

## Installation
    npm install @react-rxjs/dom

## API

### batchUpdates

A RxJS pipeable operator which observes the source observable on
an asapScheduler and uses `ReactDom.unstable_batchedUpdates` to emit the
values. It's useful for observing streams of events that come from outside
of ReactDom event-handlers.

IMPORTANT: This operator will be deprecated when React 17 is released
(or whenever React CM is released). The reason being that React Concurrent Mode
automatically batches all synchronous updates. Meaning that with React CM,
observing a stream through the asapScheduler accomplishes the same thing.

```ts
const marketUpdates$ = defer(() => api.getMarketUpdates()).pipe(
  batchUpdates()
)
```
