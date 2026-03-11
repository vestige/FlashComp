import { Navigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import {
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  subtleButtonClass,
} from "./uiStyles";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { authUser, role, loading, error } = useOwnerProfile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">認証状態を確認中...</p>
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

  if (!authUser) {
    const from = `${location.pathname}${location.search}`;
    const to = `/login?from=${encodeURIComponent(from)}`;
    return <Navigate to={to} replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <div className={sectionCardClass}>
            <h2 className="text-xl font-bold text-slate-900">アクセス権限がありません</h2>
            <p className="mt-2 text-sm text-slate-700">
              この画面は対象ロールだけが利用できます。
            </p>
            <Link to="/dashboard" className={`mt-4 ${subtleButtonClass}`}>
              ← ダッシュボードに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
