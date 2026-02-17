import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ParticipantManager from "./ParticipantManager";

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
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

vi.mock("../firebase", () => firebaseMock);
vi.mock("firebase/firestore", () => firestoreMocks);

const categories = [
  { id: "cat-beginner", name: "Beginner" },
  { id: "cat-open", name: "Open" },
];

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

describe("ParticipantManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it("registers a participant", async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce(makeSnapshot([]))
      .mockResolvedValueOnce(
        makeSnapshot([
          {
            id: "p-1",
            name: "山田 太郎",
            memberNo: "M-100",
            age: 20,
            gender: "male",
            categoryId: "cat-beginner",
          },
        ])
      );
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: "p-1" });

    const user = userEvent.setup();
    render(<ParticipantManager eventId="event-1" categories={categories} />);

    await user.type(screen.getByPlaceholderText("参加者名"), "  山田 太郎  ");
    await user.type(screen.getByPlaceholderText("会員番号"), "  M-100  ");
    await user.type(screen.getByPlaceholderText("年齢"), "20");

    const createSelects = screen.getAllByRole("combobox");
    await user.selectOptions(createSelects[0], "male");
    await user.selectOptions(createSelects[1], "cat-beginner");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      { path: "events/event-1/participants" },
      {
        name: "山田 太郎",
        memberNo: "M-100",
        age: 20,
        gender: "male",
        categoryId: "cat-beginner",
        createdAt: "mock-timestamp",
      }
    );
  });

  it("updates a participant", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "p-1",
          name: "佐藤 花子",
          memberNo: "M-200",
          age: 19,
          gender: "female",
          categoryId: "cat-beginner",
        },
      ])
    );
    firestoreMocks.updateDoc.mockResolvedValueOnce();

    const user = userEvent.setup();
    render(<ParticipantManager eventId="event-1" categories={categories} />);

    await screen.findByText(/佐藤 花子/);
    const listItem = screen.getByText(/佐藤 花子/).closest("li");
    const row = within(listItem);

    await user.click(row.getByRole("button", { name: "編集" }));

    const textInputs = row.getAllByRole("textbox");
    await user.clear(textInputs[0]);
    await user.type(textInputs[0], "佐藤 花子A");
    await user.clear(textInputs[1]);
    await user.type(textInputs[1], "M-999");
    await user.clear(row.getByRole("spinbutton"));
    await user.type(row.getByRole("spinbutton"), "21");

    const editSelects = row.getAllByRole("combobox");
    await user.selectOptions(editSelects[0], "other");
    await user.selectOptions(editSelects[1], "cat-open");

    await user.click(row.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "events/event-1/participants/p-1" },
      {
        name: "佐藤 花子A",
        memberNo: "M-999",
        age: 21,
        gender: "other",
        categoryId: "cat-open",
        updatedAt: "mock-timestamp",
      }
    );
    await screen.findByText(/佐藤 花子A/);
  });

  it("deletes a participant", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "p-1",
          name: "田中 一郎",
          memberNo: "M-300",
          age: 25,
          gender: "male",
          categoryId: "cat-open",
        },
      ])
    );
    firestoreMocks.deleteDoc.mockResolvedValueOnce();

    const user = userEvent.setup();
    render(<ParticipantManager eventId="event-1" categories={categories} />);

    await screen.findByText(/田中 一郎/);
    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(firestoreMocks.deleteDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith({
      path: "events/event-1/participants/p-1",
    });
    await waitFor(() => expect(screen.queryByText(/田中 一郎/)).not.toBeInTheDocument());
  });
});
