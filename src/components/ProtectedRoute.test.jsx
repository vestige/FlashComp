import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";

const ownerProfileMock = vi.hoisted(() => ({
  useOwnerProfile: vi.fn(),
}));

vi.mock("../hooks/useOwnerProfile", () => ownerProfileMock);

const renderWithRoute = (element) => {
  render(
    <MemoryRouter initialEntries={["/system-admin"]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/system-admin" element={element} />
      </Routes>
    </MemoryRouter>
  );
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows checking state while profile is loading", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: null,
      role: "",
      loading: true,
      error: "",
    });

    renderWithRoute(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("認証状態を確認中...")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("shows error state when profile has error", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: null,
      role: "",
      loading: false,
      error: "ユーザープロファイルの初期化に失敗しました。",
    });

    renderWithRoute(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("ユーザープロファイルの初期化に失敗しました。")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: null,
      role: "",
      loading: false,
      error: "",
    });

    renderWithRoute(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("blocks roles that are not allowed", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: { uid: "owner-uid", email: "owner@example.com" },
      role: "owner",
      loading: false,
      error: "",
    });

    renderWithRoute(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("アクセス権限がありません")).toBeInTheDocument();
    expect(screen.getByText("この画面は対象ロールだけが利用できます。")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("allows allowed roles", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: { uid: "admin-uid", email: "admin@example.com" },
      role: "admin",
      loading: false,
      error: "",
    });

    renderWithRoute(
      <ProtectedRoute allowedRoles={["owner", "admin", "viewer"]}>
        <div>protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});
