import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScoreManager from "./ScoreManager";

const firebaseMock = vi.hoisted(() => ({
  db: { id: "mock-db" },
}));

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...segments) => ({ path: segments.slice(1).join("/") })),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
  query: vi.fn((ref, ...conditions) => {
    const categoryFilter = conditions.find(
      (condition) => condition.field === "categoryId" && condition.operator === "=="
    );
    const categoryId = categoryFilter?.value || "";
    return { path: `${ref.path}?categoryId=${categoryId}` };
  }),
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
  const map = {
    "events/event-1/seasons": makeSnapshot([{ id: "season-1", name: "Season 1" }]),
    "events/event-1/seasons/season-1/tasks": makeSnapshot([]),
    "events/event-1/seasons/season-1/categoryTaskMap/cat-1/assignments": makeSnapshot([]),
    "events/event-1/seasons/season-1/categories/cat-1/participants": makeSnapshot([
      { id: "p1", scores: {} },
    ]),
    "events/event-1/categories": makeSnapshot([{ id: "cat-1", name: "Beginner" }]),
    "events/event-1/participants?categoryId=cat-1": makeSnapshot([
      { id: "p1", name: "Aoi", memberNo: "M-1", categoryId: "cat-1" },
    ]),
  };
  firestoreMocks.getDocs.mockImplementation(async (ref) => map[ref.path] || makeSnapshot([]));
};

const ScoreManagerRoute = () => {
  const { eventId } = useParams();
  return <ScoreManager eventId={eventId} />;
};

const ScoreInputDummy = () => {
  const navigate = useNavigate();
  return (
    <div>
      <p>score input page</p>
      <button type="button" onClick={() => navigate(-1)}>
        ブラウザバック
      </button>
    </div>
  );
};

const renderScoreManager = (initialPath) => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/events/:eventId/scores" element={<ScoreManagerRoute />} />
        <Route
          path="/events/:eventId/scoreinput/:seasonId/:categoryId/:participantId"
          element={<ScoreInputDummy />}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("ScoreManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores selected season/category from query params", async () => {
    setupFirestore();
    renderScoreManager("/events/event-1/scores?scoreSeason=season-1&scoreCategory=cat-1");

    await waitFor(() => expect(screen.getByLabelText(/シーズン選択:/)).toHaveValue("season-1"));
    expect(screen.getByLabelText(/カテゴリ選択:/)).toHaveValue("cat-1");
    expect(screen.getByText("Aoi")).toBeInTheDocument();
    expect(screen.getByText("M-1")).toBeInTheDocument();
  });

  it("keeps selected season/category after navigating to score input and back", async () => {
    setupFirestore();
    const user = userEvent.setup();
    renderScoreManager("/events/event-1/scores");

    await user.selectOptions(await screen.findByLabelText(/シーズン選択:/), "season-1");
    await user.selectOptions(screen.getByLabelText(/カテゴリ選択:/), "cat-1");
    const inputLink = await screen.findByRole("link", { name: /採点画面へ:/ });
    expect(inputLink).toHaveAttribute("href", "/events/event-1/scoreinput/season-1/cat-1/p1");

    await user.click(inputLink);
    await screen.findByText("score input page");

    await user.click(screen.getByRole("button", { name: "ブラウザバック" }));

    await waitFor(() => expect(screen.getByLabelText(/シーズン選択:/)).toHaveValue("season-1"));
    expect(screen.getByLabelText(/カテゴリ選択:/)).toHaveValue("cat-1");
    expect(screen.getByText("Aoi")).toBeInTheDocument();
  });
});
