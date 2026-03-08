import { Link, Outlet } from "react-router-dom";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import {
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  subtleButtonClass,
} from "./uiStyles";

const ManagementLayout = () => {
  const { authUser, role, loading, error } = useOwnerProfile();
  const isManagementRole = role === "owner" || role === "admin";

  if (loading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <div className={sectionCardClass}>
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
            <Link to="/" className={`mt-4 ${subtleButtonClass}`}>
              ← TOPに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isManagementRole) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <div className={sectionCardClass}>
            <h2 className="text-xl font-bold text-slate-900">管理画面のアクセス権が未設定です</h2>
            <p className="mt-2 text-sm text-slate-700">
              システム管理者が <code>users/{"{uid}"}</code> に role / gymIds を設定すると利用できます。
            </p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p>UID: {authUser?.uid || "-"}</p>
              <p>Email: {authUser?.email || "-"}</p>
            </div>
            <Link to="/" className={`mt-4 ${subtleButtonClass}`}>
              ← TOPに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ManagementLayout;
