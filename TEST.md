# 認証移行テスト手順メモ（Googleログイン運用）

このドキュメントは `TODO.md` の認証関連実装を検証するための実行手順です。  
`KAN-007` 以降、管理画面の認証は Google 1 通常の実行です。  
（メール/パスワード認証のローカル検証はこの方針では対象外）

---

## 0) 事前準備（共通）

- `src/firebase.js` が以下を環境変数から読む構成になっていることを確認
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- Firebase Console で対象環境（ステージング/本番）を確認
  - Authentication > Sign-in method: **Google有効**
  - Email/Password は運用上無効想定
  - Authentication > Settings > Authorized domains: 検証対象のドメイン登録済み
- Google Cloud OAuth クライアントのリダイレクト設定が対象ドメインに一致している
- テスト用アカウント用に `users/{uid}` を管理
  - `role: "admin"` / `gymIds: ["*"]`（管理者）
  - `role: "owner"` / `gymIds: ["gym-xxx"]`（担当ジムのみ）
  - 未割り当て状態: `role: "viewer"` / `gymIds: []`（ログイン後はダッシュボード閲覧のみ）
  - 非許可テスト用: 対象アカウントの `users/{uid}` を未作成または `role` 未設定

---

## 1) ローカル確認

### 1-1. 環境起動

```bash
npm install
```

- ローカル専用の `.env.staging.local` を作成してから値を埋める（ファイルは Git 未追跡）

```bash
Copy-Item .env.example .env.staging.local   # Windows PowerShell
```

内容例（`VITE_FIREBASE_*`）:
  - `VITE_FIREBASE_API_KEY=<stagingのAPIキー>`
  - `VITE_FIREBASE_AUTH_DOMAIN=<staging auth domain>`
  - `VITE_FIREBASE_PROJECT_ID=<staging project id>`
  - `VITE_FIREBASE_STORAGE_BUCKET=<staging bucket>`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID=<staging sender id>`
  - `VITE_FIREBASE_APP_ID=<staging app id>`

```bash
npm run dev -- --mode staging
```

### 1-2. Googleログイン導線

1. `http://localhost:5173/FlashComp/login` を開く（`vite.config.js` の `base` を確認）
2. Googleログインボタンでサインイン
3. 期待値
   - 「メール/パスワード入力」のような従来UIが表示されない
   - 正常時に `from` 遷移先（保護ルート）へ戻る

### 1-3. 保護ルートとリダイレクト

1. ログイン前に次を直接開く
   - `/dashboard`
   - `/system-admin`
   - `/events/sample-event/scores`
2. 期待値
   - `/login?from=...` へ遷移
   - サインイン後に最初に開いた画面へ復帰

### 1-4. 権限テスト

### 公開閲覧 / 管理操作の分離
- `/score-summary` 系のページはログイン不要で `events/{eventId}`, `gyms`, その配下参照が読み込める
- `owner/admin` 以外はイベント作成/編集系の書込に失敗する（`permission-denied`）

#### admin 権限（`role: "admin"`, `gymIds: ["*"]`）
- `/system-admin` が開ける
- ジムCRUDが実行できる
- 代表的イベントを編集できる

#### owner 権限（`role: "owner"`）
- 担当ジムのみ編集可能
- 非担当のイベント編集が弾かれる
- `/system-admin` の閲覧制御が仕様どおりであること

#### 非許可
- `users/{uid}` が未作成でも初回ログイン時に `role: "viewer"` で自動作成される
- `users/{uid}` が `role: "viewer"` の場合、`/dashboard` は閲覧できますが `Event` 作成は行えないこと
- `owner` / `admin` 以外の権限での保存・更新が拒否されること

### 1-5. エラー表示

1. ポップアップ拒否（意図的に拒否）
2. ドメイン不一致（意図的に許可ドメインを外した状態で試行）
3. ネットワーク不調（可能なら）
4. 期待値: `Login.jsx` のエラーメッセージが分岐表示されること

### 1-6. ログアウト

- ヘッダー/ユーザーメニューからログアウト
- 再ログインまで保護画面が戻るように保護されること

---

## 2) GitHub上（公開環境）確認

### 2-1. デプロイ前チェック

- ステージング/本番ごとに Firebase 設定をデプロイ環境の `.env.*` へ反映
- GitHub Actions / デプロイパイプラインに `VITE_FIREBASE_*` が反映されるか確認

### 2-2. GitHub Pages 手順

1. ビルドと配信を完了
2. デプロイURLを開く（例: `https://vestige.github.io/FlashComp/`）
3. `/login` で Google Sign-In を実行
4. 期待値
   - 管理導線が Google のみ
   - リダイレクト・権限チェックがローカル同等
   - `Unauthorized`（権限不足時）が表示されるなら、`users/{uid}` 側の設定差分を疑う

### 2-3. 重要な確認ポイント

- Firebase Console 上で確認した「Authorized domains」が、GitHub Pages ドメイン（と必要ならカスタムドメイン）を含む
- OAuth のリダイレクト許可がフロントURLに一致する
- `users/{uid}` の設定が環境別に混在していない（本番とステージングUIDを取り違えない）

---

## 3) 失敗時の切り分けフロー

### ログインできない
1. `VITE_FIREBASE_*` が対象環境の値か
2. Firebase Auth の `authorized domain` があるか
3. Google Provider が有効か

### ログイン後に管理画面が使えない
1. `users/{uid}` が存在するか
2. `role`/`gymIds` が意図どおりか
3. Firestore ルールの反映（最後のデプロイ時刻）を確認

### 画面復帰しない
1. 直接保護ルートに `from` 付きで遷移しているか
2. `?from=` 付きパスが想定どおり保存されているか
3. ブラウザキャッシュ/Service Worker の影響を疑う
