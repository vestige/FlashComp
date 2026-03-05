import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppShell from "./AppShell";

const firebaseMock = vi.hoisted(() => ({
  auth: { id: "mock-auth" },
}));

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn((_, callback) => {
    callback({ displayName: "Owner", email: "owner@example.com" });
    return vi.fn();
  }),
  signOut: vi.fn(async () => {}),
}));

vi.mock("../firebase", () => firebaseMock);
vi.mock("firebase/auth", () => authMocks);

const renderAppShell = () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps user menu and portal menu mutually exclusive", async () => {
    const user = userEvent.setup();
    renderAppShell();

    const userMenuButton = await screen.findByRole("button", { name: "user menu" });
    const menuButton = screen.getByRole("button", { name: "menu" });

    await user.click(userMenuButton);
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TOP" })).not.toBeInTheDocument();

    await user.click(menuButton);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "TOP" })).toBeInTheDocument();

    await user.click(userMenuButton);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "TOP" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });
});
