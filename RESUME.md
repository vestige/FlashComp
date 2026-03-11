## 次回着手チェックリスト

### 1) まず確認（毎回最初）
- [ ] `git status -sb` で作業前状態を確認
- [ ] `git fetch origin` を実行
- [ ] `git status -sb` で `main...origin/main` が `0 0` かを確認

### 2) 直近コミットの共有状況
- [x] `89dc5ac`（`main`）は `origin/main` と一致
- [ ] 必要なら未コミット変更を別コミット化する

### 3) 未コミット差分（現状）
- [ ] `README.md`
- [ ] `SPEC.md`
- [ ] `TODO.md`（`KAN-102`済扱い）
- [ ] `firestore.rules`
- [ ] `src/App.jsx`
- [ ] `src/components/ManagementLayout.jsx`
- [ ] `src/components/ManagementLayout.test.jsx`
- [ ] `src/components/ProtectedRoute.jsx`
- [ ] `src/components/ProtectedRoute.test.jsx`（新規）
- [ ] `src/firebase.js`
- [ ] `src/hooks/useOwnerProfile.js`（`refreshProfile`追加）
- [ ] `src/lib/ownerProfileService.js`（追加）
- [ ] `src/pages/CreateEvent.jsx`
- [ ] `src/pages/Dashboard.jsx`
- [ ] `src/pages/Login.jsx`
- [ ] `src/pages/SystemAdmin.jsx`（`refreshProfile`呼び出し）
- [ ] `TEST.md`（`env`の運用メモ）
- [ ] `.env.example`（追跡対象）

### 4) 次に進む項目
- [ ] `KAN-105` 着手
- [ ] `KAN-106` 着手
- [ ] `KAN-107` 着手

### 5) ローカル検証（必要最小）
- [ ] `npm install`（初回）
- [ ] `npm run dev -- --mode staging`
- [ ] ログイン後、`/system-admin` / `/dashboard` / `/events/...` の権限制御を目視確認
- [ ] SystemAdminで自分の権限変更時の反映挙動確認（`KAN-102`の動作）
