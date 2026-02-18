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

  firestoreMocks.getDocs.mockResolvedValueOnce(
    makeSnapshot([
      {
        id: "event-ongoing",
        name: "Spring Flash",
        startDate: { seconds: Math.floor((nowMs - dayMs) / 1000) },
        endDate: { seconds: Math.floor((nowMs + dayMs) / 1000) },
      },
      {
        id: "event-upcoming",
        name: "Summer Practice",
        startDate: { seconds: Math.floor((nowMs + 5 * dayMs) / 1000) },
        endDate: { seconds: Math.floor((nowMs + 10 * dayMs) / 1000) },
      },
      {
        id: "event-ended",
        name: "Winter Flash",
        startDate: { seconds: Math.floor((nowMs - 10 * dayMs) / 1000) },
        endDate: { seconds: Math.floor((nowMs - 5 * dayMs) / 1000) },
      },
    ])
  );
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

  it("filters events by keyword and status", async () => {
    setupFirestore();
    renderSummary("/score-summary?status=ongoing&q=Spring");

    await screen.findByText("🏆 クライマー向け結果ページ");
    expect(screen.getByDisplayValue("Spring")).toBeInTheDocument();
    expect(screen.getByLabelText(/開催状況:/)).toHaveValue("ongoing");
    expect(screen.getByText("表示 1 / 3 件")).toBeInTheDocument();
    expect(screen.getByText("Spring Flash")).toBeInTheDocument();
    expect(screen.queryByText("Winter Flash")).not.toBeInTheDocument();
    expect(screen.queryByText("Summer Practice")).not.toBeInTheDocument();
  });

  it("resets filters and shows all events", async () => {
    setupFirestore();
    const user = userEvent.setup();
    renderSummary("/score-summary?status=ended&q=Winter");

    await screen.findByText("🏆 クライマー向け結果ページ");
    expect(screen.getByText("表示 1 / 3 件")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "フィルターをリセット" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("例: Spring")).toHaveValue("");
      expect(screen.getByLabelText(/開催状況:/)).toHaveValue("all");
      expect(screen.getByText("表示 3 / 3 件")).toBeInTheDocument();
    });
    expect(screen.getByText("Spring Flash")).toBeInTheDocument();
    expect(screen.getByText("Summer Practice")).toBeInTheDocument();
    expect(screen.getByText("Winter Flash")).toBeInTheDocument();
  });
});
