import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventSummary from "./EventSummary";

const firebaseMock = vi.hoisted(() => ({
  db: { id: "mock-db" },
}));

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...segments) => ({ path: segments.slice(1).join("/") })),
  doc: vi.fn((...segments) => ({ path: segments.slice(1).join("/") })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("../firebase", () => firebaseMock);
vi.mock("firebase/firestore", () => firestoreMocks);

const makeDocSnap = (data, exists = true) => ({
  exists: () => exists,
  id: "doc-id",
  data: () => data,
});

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
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === "events/event-1") {
      return makeDocSnap({ name: "FlashComp Spring 2026" });
    }
    return makeDocSnap({}, false);
  });

  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    const map = {
      "events/event-1/seasons": makeSnapshot([{ id: "season-1", name: "Season 1" }]),
      "events/event-1/categories": makeSnapshot([{ id: "cat-1", name: "Beginner" }]),
      "events/event-1/participants": makeSnapshot([
        { id: "p1", name: "Aoi", memberNo: "M-1001", categoryId: "cat-1" },
        { id: "p2", name: "Riku", memberNo: "M-1002", categoryId: "cat-1" },
      ]),
      "events/event-1/seasons/season-1/tasks": makeSnapshot([
        { id: "task-01", name: "No.01", points: 100, grade: "6Q", taskNo: 1 },
      ]),
      "events/event-1/seasons/season-1/categoryTaskMap/cat-1/assignments": makeSnapshot([
        { id: "task-01", enabled: true, taskNo: 1 },
      ]),
      "events/event-1/seasons/season-1/categories/cat-1/participants": makeSnapshot([
        {
          id: "p1",
          scores: { "No.01": true },
          updatedAt: { seconds: 1710000000 },
        },
        {
          id: "p2",
          scores: { "No.01": false },
          updatedAt: { seconds: 1710003600 },
        },
      ]),
    };
    return map[ref.path] || makeSnapshot([]);
  });
};

const renderSummary = (initialPath) => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/score-summary/:eventId" element={<EventSummary />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("EventSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows selected participant only and resets quick filters", async () => {
    setupFirestore();
    const user = userEvent.setup();
    renderSummary("/score-summary/event-1?self=1&pid=p2&category=cat-1&q=M-1002");

    await screen.findByText(/FlashComp Spring 2026 - 集計結果/);
    await screen.findByText(/選択中: Riku/);
    await screen.findByText("該当 1 件");

    let table = screen.getByRole("table");
    expect(within(table).getByText("Riku")).toBeInTheDocument();
    expect(within(table).queryByText("Aoi")).not.toBeInTheDocument();

    const detailLink = screen.getByRole("link", { name: "詳細へ移動" });
    expect(detailLink).toHaveAttribute(
      "href",
      "/score-summary/event-1/participants/p2?category=cat-1&q=M-1002&pid=p2&self=1"
    );

    await user.click(screen.getByRole("button", { name: "フィルターをリセット" }));
    await waitFor(() => {
      expect(screen.getByLabelText(/カテゴリ:/)).toHaveValue("all");
      expect(screen.getByLabelText(/クライマー:/)).toHaveValue("");
      expect(screen.getByPlaceholderText("例: 山田 / M-1001")).toHaveValue("");
    });
    expect(screen.queryByRole("link", { name: "詳細へ移動" })).not.toBeInTheDocument();
    table = screen.getByRole("table");
    expect(within(table).getByText("Aoi")).toBeInTheDocument();
    expect(within(table).getByText("Riku")).toBeInTheDocument();
  });

  it("filters rows by keyword in ranking mode", async () => {
    setupFirestore();
    const user = userEvent.setup();
    renderSummary("/score-summary/event-1");

    await screen.findByText(/FlashComp Spring 2026 - 集計結果/);

    const input = screen.getByPlaceholderText("例: 山田 / M-1001");
    await user.type(input, "M-1002");

    await waitFor(() => expect(screen.getByText("該当 1 件")).toBeInTheDocument());
    const table = screen.getByRole("table");
    expect(within(table).getByText("Riku")).toBeInTheDocument();
    expect(within(table).queryByText("Aoi")).not.toBeInTheDocument();
  });
});
