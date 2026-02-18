import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeasonManager from "./SeasonManager";

const firebaseMock = vi.hoisted(() => ({
  db: { id: "mock-db" },
}));

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...segments) => ({ path: segments.slice(1).join("/") })),
  doc: vi.fn((...segments) => ({ path: segments.slice(1).join("/") })),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
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

const createTimestampValue = (dateText) => ({
  toDate: () => new Date(`${dateText}T00:00:00`),
});

describe("SeasonManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it("creates and reads seasons", async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce(makeSnapshot([]))
      .mockResolvedValueOnce(
        makeSnapshot([
          {
            id: "season-1",
            name: "Season 1",
            startDate: createTimestampValue("2026-03-01"),
            endDate: createTimestampValue("2026-03-31"),
          },
        ])
      );
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: "season-1" });

    const user = userEvent.setup();
    const { container } = render(<SeasonManager eventId="event-1" />);

    await user.type(screen.getByPlaceholderText("シーズン名"), "Season 1");
    const createDateInputs = container.querySelectorAll("input[type='date']");
    await user.type(createDateInputs[0], "2026-03-01");
    await user.type(createDateInputs[1], "2026-03-31");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      { path: "events/event-1/seasons" },
      {
        name: "Season 1",
        startDate: expect.any(Object),
        endDate: expect.any(Object),
      }
    );
    expect(firestoreMocks.Timestamp.fromDate).toHaveBeenCalledTimes(2);
    await screen.findByText(/Season 1/);
  });

  it("updates a season", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "season-1",
          name: "Season 1",
          startDate: createTimestampValue("2026-03-01"),
          endDate: createTimestampValue("2026-03-31"),
        },
      ])
    );
    firestoreMocks.updateDoc.mockResolvedValueOnce();

    const user = userEvent.setup();
    render(<SeasonManager eventId="event-1" />);

    const rowEl = (await screen.findByText(/Season 1/)).closest("li");
    const row = within(rowEl);

    await user.click(row.getByRole("button", { name: "編集" }));

    const rowTextInput = rowEl.querySelector("input[type='text']");
    await user.clear(rowTextInput);
    await user.type(rowTextInput, "Season X");

    const rowDateInputs = rowEl.querySelectorAll("input[type='date']");
    await user.clear(rowDateInputs[0]);
    await user.type(rowDateInputs[0], "2026-04-01");
    await user.clear(rowDateInputs[1]);
    await user.type(rowDateInputs[1], "2026-04-30");

    await user.click(row.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "events/event-1/seasons/season-1" },
      {
        name: "Season X",
        startDate: expect.any(Object),
        endDate: expect.any(Object),
      }
    );
    expect(firestoreMocks.Timestamp.fromDate).toHaveBeenCalledTimes(2);
    await screen.findByText(/Season X/);
  });

  it("deletes a season", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "season-1",
          name: "Season 1",
          startDate: createTimestampValue("2026-03-01"),
          endDate: createTimestampValue("2026-03-31"),
        },
      ])
    );
    firestoreMocks.deleteDoc.mockResolvedValueOnce();

    const user = userEvent.setup();
    render(<SeasonManager eventId="event-1" />);

    const rowEl = (await screen.findByText(/Season 1/)).closest("li");
    const row = within(rowEl);
    await user.click(row.getByRole("button", { name: "削除" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(firestoreMocks.deleteDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith({
      path: "events/event-1/seasons/season-1",
    });
    await waitFor(() => expect(screen.queryByText(/Season 1/)).not.toBeInTheDocument());
  });
});
