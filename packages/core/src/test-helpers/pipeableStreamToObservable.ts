import { PipeableStream } from "react-dom/server"
import { Observable, scan } from "rxjs"
import { PassThrough } from "stream"

export function pipeableStreamToObservable(
  stream: PipeableStream,
): Observable<string> {
  return new Observable((subscriber) => {
    const passthrough = new PassThrough()
    const sub = readStream$<string>(passthrough)
      .pipe(scan((acc, v) => acc + v, ""))
      .subscribe(subscriber)

    stream.pipe(passthrough)

    return () => {
      sub.unsubscribe()
    }
  })
}

function readStream$<T>(stream: NodeJS.ReadableStream) {
  return new Observable<T>((subscriber) => {
    const dataHandler = (data: T) => subscriber.next(data)
    stream.addListener("data", dataHandler)

    const errorHandler = (error: any) => subscriber.error(error)
    stream.addListener("error", errorHandler)

    const closeHandler = () => subscriber.complete()
    stream.addListener("close", closeHandler)
    stream.addListener("end", closeHandler)

    return () => {
      stream.removeListener("data", dataHandler)
      stream.removeListener("error", errorHandler)
      stream.removeListener("close", closeHandler)
      stream.removeListener("end", closeHandler)
    }
  })
}
