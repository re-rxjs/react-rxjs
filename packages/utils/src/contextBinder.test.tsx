import { render, screen } from "@testing-library/react"
import React, { createContext, useContext } from "react"
import { of } from "rxjs"
import { contextBinder } from "./index"

describe("contextBinder", () => {
  it("bounds the provided context into the first args of the hook", () => {
    const idContext = createContext<string>("id1")
    const countContext = createContext<number>(3)
    const useId = () => useContext(idContext)
    const useCount = () => useContext(countContext)
    const idCountBind = contextBinder(useId, useCount)

    const [useSomething] = idCountBind(
      (id: string, count: number, append: string) =>
        of(Array(count).fill(id).concat(append).join("-")),
      "",
    )

    const Result: React.FC = () => <span>Result {useSomething("bar")}</span>

    const Component: React.FC<{ id: string; count: number }> = ({
      id,
      count,
    }) => {
      return (
        <idContext.Provider value={id}>
          <countContext.Provider value={count}>
            <Result />
          </countContext.Provider>
        </idContext.Provider>
      )
    }

    render(<Component id="foo" count={4} />)

    expect(screen.queryByText("Result foo-foo-foo-foo-bar")).not.toBeNull()
  })

  it("the returned function matches the signature of the original one", () => {
    const idContext = createContext<string>("id1")
    const countContext = createContext<number>(3)
    const useId = () => useContext(idContext)
    const useCount = () => useContext(countContext)
    const idCountBind = contextBinder(useId, useCount)

    const [, getSomething$] = idCountBind(
      (id: string, count: number, append: string) =>
        of(Array(count).fill(id).concat(append).join("-")),
      "",
    )

    let value = ""
    getSomething$("foo", 4, "bar").subscribe((v) => {
      value = v
    })

    expect(value).toBe("foo-foo-foo-foo-bar")
  })
})
