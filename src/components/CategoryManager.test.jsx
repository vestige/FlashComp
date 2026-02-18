import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryManager from "./CategoryManager";

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

const CategoryHarness = () => {
  const [categories, setCategories] = useState([]);
  return <CategoryManager eventId="event-1" categories={categories} setCategories={setCategories} />;
};

describe("CategoryManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it("creates and reads categories", async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce(makeSnapshot([]))
      .mockResolvedValueOnce(makeSnapshot([{ id: "cat-1", name: "Beginner" }]));
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: "cat-1" });

    const user = userEvent.setup();
    render(<CategoryHarness />);

    await user.type(screen.getByPlaceholderText("カテゴリ名"), "Beginner");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      { path: "events/event-1/categories" },
      { name: "Beginner" }
    );
    await screen.findByText("Beginner");
  });

  it("updates a category", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([{ id: "cat-1", name: "Beginner" }])
    );
    firestoreMocks.updateDoc.mockResolvedValueOnce();

    const user = userEvent.setup();
    render(<CategoryHarness />);

    const rowEl = (await screen.findByText("Beginner")).closest("li");
    const row = within(rowEl);
    await user.click(row.getByRole("button", { name: "編集" }));

    const editInput = row.getByRole("textbox");
    await user.clear(editInput);
    await user.type(editInput, "Middle");
    await user.click(row.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "events/event-1/categories/cat-1" },
      { name: "Middle" }
    );
    await screen.findByText("Middle");
  });

  it("deletes a category", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      makeSnapshot([{ id: "cat-1", name: "Beginner" }])
    );
    firestoreMocks.deleteDoc.mockResolvedValueOnce();

    const user = userEvent.setup();
    render(<CategoryHarness />);

    const rowEl = (await screen.findByText("Beginner")).closest("li");
    const row = within(rowEl);
    await user.click(row.getByRole("button", { name: "削除" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(firestoreMocks.deleteDoc).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith({
      path: "events/event-1/categories/cat-1",
    });
    await waitFor(() => expect(screen.queryByText("Beginner")).not.toBeInTheDocument());
  });
});
