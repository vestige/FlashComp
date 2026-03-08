import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ManagementLayout from "./ManagementLayout";

const ownerProfileMock = vi.hoisted(() => ({
  useOwnerProfile: vi.fn(),
}));

vi.mock("../hooks/useOwnerProfile", () => ownerProfileMock);

const renderLayout = () => {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<ManagementLayout />}>
          <Route path="/dashboard" element={<div>dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe("ManagementLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading message while profile is being resolved", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: null,
      role: "",
      loading: true,
      error: "",
    });

    renderLayout();

    expect(screen.getByText("認証状態を確認中...")).toBeInTheDocument();
  });

  it("shows unauthorized message when role is missing", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: { uid: "uid-1", email: "owner@example.com" },
      role: "",
      loading: false,
      error: "",
    });

    renderLayout();

    expect(screen.getByText("管理画面のアクセス権が未設定です")).toBeInTheDocument();
    expect(screen.getByText("UID: uid-1")).toBeInTheDocument();
    expect(screen.getByText("Email: owner@example.com")).toBeInTheDocument();
  });

  it("renders outlet content for owner/admin roles", () => {
    ownerProfileMock.useOwnerProfile.mockReturnValue({
      authUser: { uid: "uid-2", email: "owner@example.com" },
      role: "owner",
      loading: false,
      error: "",
    });

    renderLayout();

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});
