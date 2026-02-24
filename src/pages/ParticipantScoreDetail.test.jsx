import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import ParticipantScoreDetail from "./ParticipantScoreDetail";

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

const mockFirestoreForDetail = ({ participantId }) => {
  const participants = [
    { id: "p1", name: "Aoi", memberNo: "M-1001", categoryId: "cat-1" },
    { id: "p2", name: "Riku", memberNo: "M-1002", categoryId: "cat-1" },
    { id: "p3", name: "Mio", memberNo: "M-1003", categoryId: "cat-1" },
  ];

  const tasks = [
    { id: "task-01", name: "No.01", points: 100, grade: "7Q", taskNo: 1 },
    { id: "task-02", name: "No.02", points: 80, grade: "6Q", taskNo: 2 },
  ];

  const scoreRows = [
    {
      id: "p1",
      scores: { "No.01": true, "No.02": true },
      updatedAt: { toDate: () => new Date("2026-03-10T10:00:00") },
    },
    {
      id: "p2",
      scores: { "No.01": true, "No.02": false },
      updatedAt: { toDate: () => new Date("2026-03-10T11:00:00") },
    },
    {
      id: "p3",
      scores: { "No.01": false, "No.02": false },
      updatedAt: { toDate: () => new Date("2026-03-10T12:00:00") },
    },
  ];

  const selectedParticipant = participants.find((p) => p.id === participantId);

  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === "events/event-1") {
      return makeDocSnap({ name: "FlashComp Spring 2026" });
    }
    if (ref.path === `events/event-1/participants/${participantId}`) {
      return makeDocSnap(selectedParticipant || {}, !!selectedParticipant);
    }
    return makeDocSnap({}, false);
  });

  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    const map = {
      "events/event-1/participants": makeSnapshot(participants),
      "events/event-1/seasons": makeSnapshot([{ id: "season-1", name: "Season 1" }]),
      "events/event-1/categories": makeSnapshot([{ id: "cat-1", name: "Beginner" }]),
      "events/event-1/seasons/season-1/tasks": makeSnapshot(tasks),
      "events/event-1/seasons/season-1/categoryTaskMap/cat-1/assignments": makeSnapshot([
        { id: "task-01", enabled: true, taskNo: 1 },
        { id: "task-02", enabled: true, taskNo: 2 },
      ]),
      "events/event-1/seasons/season-1/categories/cat-1/participants": makeSnapshot(scoreRows),
    };
    return map[ref.path] || makeSnapshot([]);
  });
};

const renderDetail = (initialPath) => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/score-summary/:eventId/participants/:participantId"
          element={<ParticipantScoreDetail />}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("ParticipantScoreDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows rank summary and keeps query params in links", async () => {
    mockFirestoreForDetail({ participantId: "p2" });
    renderDetail("/score-summary/event-1/participants/p2?season=season-1&category=cat-1&q=M-1002");

    await screen.findByText(/FlashComp Spring 2026 - クライマー詳細/);
    await screen.findByText(/順位（Beginner）:/);

    const rankRow = screen.getByText(/順位（Beginner）:/);
    expect(rankRow.textContent).toContain("2");
    expect(rankRow.textContent).toContain("/ 3");

    const backLink = screen.getAllByRole("link", { name: "← 集計結果に戻る" })[0];
    expect(backLink).toHaveAttribute(
      "href",
      "/score-summary/event-1?season=season-1&category=cat-1&q=M-1002"
    );

    const upperLink = screen.getByRole("link", { name: /↑ 1位 Aoi/ });
    const lowerLink = screen.getByRole("link", { name: /↓ 3位 Mio/ });
    expect(upperLink).toHaveAttribute(
      "href",
      "/score-summary/event-1/participants/p1?season=season-1&category=cat-1&q=M-1002"
    );
    expect(lowerLink).toHaveAttribute(
      "href",
      "/score-summary/event-1/participants/p3?season=season-1&category=cat-1&q=M-1002"
    );

    const detailTable = screen.getByRole("table");
    const row = within(detailTable).getByText("No.01").closest("tr");
    expect(row).toBeTruthy();
    expect(within(row).getByText("7Q")).toBeInTheDocument();
    expect(within(row).getByText("100")).toBeInTheDocument();
  });

  it("shows boundary message when participant is top rank", async () => {
    mockFirestoreForDetail({ participantId: "p1" });
    renderDetail("/score-summary/event-1/participants/p1?season=season-1");

    await screen.findByText(/FlashComp Spring 2026 - クライマー詳細/);

    await waitFor(() =>
      expect(screen.getByText("これより上位のクライマーはいません")).toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: /↓ 2位 Riku/ })).toBeInTheDocument();
  });
});
