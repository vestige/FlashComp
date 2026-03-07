import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Home from "./Home";

const renderHome = (initialPath = "/") => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("Home", () => {
  it("shows legacy portal notice when redirected from old score-summary event route", async () => {
    renderHome("/?legacy=score-summary-event");

    expect(
      await screen.findByText("旧URLです。クライマーポータルは「イベント結果を見る」からアクセスしてください。")
    ).toBeInTheDocument();
  });

  it("does not show legacy portal notice on normal access", () => {
    renderHome("/");

    expect(
      screen.queryByText("旧URLです。クライマーポータルは「イベント結果を見る」からアクセスしてください。")
    ).not.toBeInTheDocument();
  });
});
