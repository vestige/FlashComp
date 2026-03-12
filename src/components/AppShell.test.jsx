import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppShell from "./AppShell";

const firebaseMock = vi.hoisted(() => ({
  auth: { id: "mock-auth" },
}));

const authMocks = vi.hoisted(() => {
  const listeners = new Set();

  return {
    __emitAuthState: (user) => {
      listeners.forEach((listener) => listener(user));
    },
    onAuthStateChanged: vi.fn((_, callback) => {
      listeners.add(callback);
      callback({ uid: "owner-1", displayName: "Owner", email: "owner@example.com" });
      return vi.fn(() => listeners.delete(callback));
    }),
    signOut: vi.fn(async () => {
      authMocks.__emitAuthState(null);
    }),
  };
});

vi.mock("../firebase", () => firebaseMock);
vi.mock("firebase/auth", () => authMocks);

const renderAppShell = () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>home</div>} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
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

  it("closes menus and shows login button after logout", async () => {
    const user = userEvent.setup();
    renderAppShell();

    await user.click(await screen.findByRole("button", { name: "user menu" }));
    await user.click(screen.getByRole("button", { name: "ログアウト" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "ログイン" })).toBeInTheDocument();
    });
    expect(authMocks.signOut).toHaveBeenCalledWith(firebaseMock.auth);
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TOP" })).not.toBeInTheDocument();
  });

  it("closes opened menus when auth session switches", async () => {
    const user = userEvent.setup();
    renderAppShell();

    await user.click(await screen.findByRole("button", { name: "menu" }));
    expect(screen.getByRole("button", { name: "TOP" })).toBeInTheDocument();

    await act(async () => {
      authMocks.__emitAuthState({ uid: "owner-2", displayName: "Owner B", email: "owner-b@example.com" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "TOP" })).not.toBeInTheDocument();
    });
  });
});
