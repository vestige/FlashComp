import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScoreSummary from "./ScoreSummary";

const firebaseMock = vi.hoisted(() => ({
  db: { id: "mock-db" },
}));

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...segments) => ({ path: segments.slice(1).join("/") })),
  getDocs: vi.fn(),
}));

vi.mock("../firebase", () => firebaseMock);
vi.mock("firebase/firestore", () => firestoreMocks);

const makeSnapshot = (rows) => ({
  docs: rows.map((row) => ({
    id: row.id,
    data: () => {
      const rest = { ...row };
      delete rest.id;
      return rest;
    },
  })),
});

const setupFirestore = () => {
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const map = {
    events: makeSnapshot([
      {
        id: "event-upcoming",
        name: "Summer Practice",
        gymId: "gym-b",
        startDate: { seconds: Math.floor((nowMs + 5 * dayMs) / 1000) },
        endDate: { seconds: Math.floor((nowMs + 10 * dayMs) / 1000) },
      },
      {
        id: "event-ended",
        name: "Winter Flash",
        gymId: "gym-a",
        startDate: { seconds: Math.floor((nowMs - 10 * dayMs) / 1000) },
        endDate: { seconds: Math.floor((nowMs - 5 * dayMs) / 1000) },
      },
      {
        id: "event-ongoing",
        name: "Spring Flash",
        gymId: "gym-a",
        startDate: { seconds: Math.floor((nowMs - dayMs) / 1000) },
        endDate: { seconds: Math.floor((nowMs + dayMs) / 1000) },
      },
    ]),
    gyms: makeSnapshot([
      { id: "gym-a", name: "Alpha Gym" },
      { id: "gym-b", name: "Beta Gym" },
    ]),
  };

  firestoreMocks.getDocs.mockImplementation(async (ref) => map[ref.path] || makeSnapshot([]));
};

const renderSummary = (initialPath) => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/score-summary" element={<ScoreSummary />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("ScoreSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to Live view and filters by keyword", async () => {
    setupFirestore();
    renderSummary("/score-summary?q=Spring");

    await screen.findByRole("heading", { name: "Climber Portal" });
    expect(screen.getByRole("link", { name: "↑ Back to TOP" })).toHaveAttribute("href", "/");
    expect(screen.getByDisplayValue("Spring")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live" })).toBeInTheDocument();
    expect(screen.getByText("表示 1 / 1 件")).toBeInTheDocument();
    expect(screen.getByText("Spring Flash")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ランキングを見る" })).toHaveAttribute(
      "href",
      "/score-summary/event-ongoing/ranking?from=portal"
    );
    expect(screen.queryByRole("link", { name: "このイベントのランキングを見る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "新ランキング表示" })).not.toBeInTheDocument();
    expect(screen.queryByText("Winter Flash")).not.toBeInTheDocument();
    expect(screen.queryByText("Summer Practice")).not.toBeInTheDocument();
  });

  it("switches to Past view and resets back to Live", async () => {
    setupFirestore();
    const user = userEvent.setup();
    renderSummary("/score-summary?view=past&q=Winter");

    await screen.findByRole("heading", { name: "Climber Portal" });
    expect(screen.getByText("表示 1 / 1 件")).toBeInTheDocument();
    expect(screen.getByText("Winter Flash")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "フィルターをリセット" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("例: Spring")).toHaveValue("");
      expect(screen.getByLabelText(/ジム:/)).toHaveValue("all");
      expect(screen.getByText("表示 1 / 1 件")).toBeInTheDocument();
    });
    expect(screen.getByText("Spring Flash")).toBeInTheDocument();
    expect(screen.queryByText("Winter Flash")).not.toBeInTheDocument();
    expect(screen.queryByText("Summer Practice")).not.toBeInTheDocument();
  });

  it("switches to Past view and shows ended events only", async () => {
    setupFirestore();
    const user = userEvent.setup();
    renderSummary("/score-summary");

    await screen.findByRole("heading", { name: "Climber Portal" });
    await user.click(screen.getByRole("button", { name: "Past" }));

    await waitFor(() => {
      expect(screen.getByText("Winter Flash")).toBeInTheDocument();
    });
    expect(screen.queryByText("Spring Flash")).not.toBeInTheDocument();
    expect(screen.queryByText("Summer Practice")).not.toBeInTheDocument();
  });

  it("hides upcoming-only gyms from Live/Past lists", async () => {
    setupFirestore();
    renderSummary("/score-summary?gym=gym-b");

    await screen.findByRole("heading", { name: "Climber Portal" });

    expect(screen.getByLabelText(/ジム:/)).toHaveValue("gym-b");
    expect(screen.getByText("表示 0 / 0 件")).toBeInTheDocument();
    expect(screen.queryByText("Summer Practice")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Flash")).not.toBeInTheDocument();
    expect(screen.queryByText("Winter Flash")).not.toBeInTheDocument();
  });
});
