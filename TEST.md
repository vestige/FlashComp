# 認証移行テスト手順メモ（Googleログイン運用）

このドキュメントは `TODO.md` の認証関連実装を検証するための実行手順です。  
`KAN-007` 以降、管理画面の認証は Google 1 通常の実行です。  
（メール/パスワード認証のローカル検証はこの方針では対象外）

---

## 0) 事前準備（共通）

- ## 0-0. ローカル最短フロー
  1. `npm install`
  2. `.env.prod.local` または `.env.demo.local` を作成し、`VITE_FIREBASE_*` を設定
  3. `npm run dev -- --mode demo`（デモ確認）または `npm run dev -- --mode prod`（本番相当確認）
  4. `http://localhost:5173/FlashComp/login` で Google サインイン

- `src/firebase.js` が以下を環境変数から読む構成になっていることを確認
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - Firebase Console で対象環境（デモ/prod）を確認
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

- ローカル専用の `.env.demo.local` / `.env.prod.local` を作成してから値を埋める（ファイルは Git 未追跡）

```bash
Copy-Item .env.example .env.demo.local   # Windows PowerShell
```

内容例（デモ環境）:
  - `VITE_FIREBASE_API_KEY=<demoのAPIキー>`
  - `VITE_FIREBASE_AUTH_DOMAIN=<demo auth domain>`
  - `VITE_FIREBASE_PROJECT_ID=<demo project id>`
  - `VITE_FIREBASE_STORAGE_BUCKET=<demo bucket>`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID=<demo sender id>`
  - `VITE_FIREBASE_APP_ID=<demo app id>`

```bash
Copy-Item .env.example .env.prod.local   # Windows PowerShell
```

```bash
npm run dev -- --mode demo
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

### 1-4. 役割別チェック

#### 前提
- `/score-summary` 系はログイン不要で閲覧できること
- `owner/admin` 以外は管理操作で `permission-denied` になること

#### admin（`role: "admin"`, `gymIds: ["*"]`）
- `Login` 後、`/system-admin` が開けること
- `gyms` の作成・更新・削除ができること
- `/events/:eventId/scores` など管理ページの書込が通ること
- `/dashboard` と `score-summary` が問題なく表示できること

#### owner（`role: "owner"`）
- `Login` 後、`/system-admin` が拒否されること
- `dashboard` は表示されること
- 担当ジムのイベントは編集できること
- 非担当ジムのイベント編集が `permission-denied` で拒否されること

#### viewer（`role: "viewer"`）
- `Login` 後、`/dashboard` は表示されること
- `/system-admin` が拒否されること
- イベント作成/更新の保存が `permission-denied` になること

#### 非許可（`users/{uid}` 未作成 / role未設定）
- 初回ログインで `users/{uid}` が `role: "viewer"` として作成されること
- `/system-admin` が開けないこと
- 管理画面での保存や更新が `permission-denied` になること

### 1-5. エラー表示 / メッセージ

1. Googleログインエラー（ポップアップ拒否、ドメイン不一致、ネットワーク）
2. 期待値: 管理向けに分かるメッセージ（rawエラーをそのまま表示しない）
3. 併せて管理画面の `permission-denied` が運用メッセージに置換されていることを確認

### 1-6. ログアウト

- ヘッダー/ユーザーメニューからログアウト
- 再ログインまで保護画面が戻るように保護されること

---

## 2) GitHub上（公開環境）確認

### 2-1. デプロイ前チェック

- デモ/prodごとに Firebase 設定をデプロイ環境の `.env.*` へ反映
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
- `users/{uid}` の設定が環境別に混在していない（本番とデモUIDを取り違えない）

### 2-4. デモ/本番配信確認（推奨フロー）

1. GitHub Actions → `Deploy to GitHub Pages` → `Run workflow`
2. `target_env` を以下で順番に実行
   - `demo`: `https://vestige.github.io/FlashComp/demo/`
   - `prod`: `https://vestige.github.io/FlashComp/`
3. 各URLで以下を確認
   - 表示が空白でなく、CSS/JS が読み込まれている
   - `/login` が Google Sign-In のみで開ける
   - `admin / owner / viewer / 未許可` それぞれの権限制御がローカル結果と一致
   - `No routes matched` がコンソールに出ない

補足:
- 短時間で検証する場合、ローカルは UI 変更多発確認、デモ/本番は毎回の運用リリース確認に使う。
- デモURLで動けば運用フローとしては「実環境通過」とみなせる。

--- 

## 4) Firestore test data scripts

- 一覧
  - `npm run db:purge`（安全モード）
  - `npm run db:purge:yes`（イベント関連データを破壊的に削除）
  - `npm run db:purge:yes:system`（`events`/`gyms`/`users` の上位削除も対象）
  - `npm run db:seed`
  - `npm run db:seed:system`
  - `npm run db:backup -- --out backups/pre-op.json`
  - `npm run db:backup:demo`（デモ用途）
  - `npm run db:backup:system`
  - `npm run db:restore:dry-run -- --file <backup-json>`（事前見積もり）
  - `npm run db:restore -- --yes --file <backup-json>`
  - `npm run db:restore -- --yes --file <backup-json> --scope-events event-spring-2026,event-live-now`
  - `npm run db:restore -- --yes --file <backup-json> --scope-gym gym-shibuya`
  - `npm run db:restore -- --yes --file <backup-json> --log backups/restore-logs/restore-session.jsonl`
- `db:seed` / `db:seed:system` はローカル検証前のイベント再現に使う
- `db:reset` を使う場合は `SCRIPT_AUTH_*` を設定してから実行する

実行例（ローカル）

```bash
$env:SCRIPT_AUTH_EMAIL='YOUR_ADMIN_ACCOUNT_EMAIL'
$env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'
npm run db:reset
```

### validation用サンプルイベント（参考）
- `event-spring-2026`
- `event-live-now`
- `event-upcoming-2026`
- `event-rookie-cup-2026`

### 5) KAN-006 検証（db:restore 安全化）

- **事前見積もり表示の確認（dry-run）**
  ```bash
  npm run db:restore:dry-run -- --file backups/demo/firestore-backup-demo-20260316-120000.json
  ```
  - `[target] docs to restore: ...` が表示される
  - `[scope skip] ...` が表示される
  - `Dry-run completed. No data written.` が表示される
  - `Dry-run` のログが `backups/restore-logs/restore-*.jsonl` に1行追加される

- **スコープ確認（実行前）**
  ```bash
  npm run db:restore:dry-run -- --file backups/<任意のbackup>.json --scope-events event-spring-2026 --scope-gym gym-shibuya
  ```
  - `[filter] events:`、`[filter] gyms:` が表示される
  - `target events=` と `target gyms=` の一覧がログ対象に反映される

- **実行ログ保存確認（適用）**
  ```bash
  npm run db:restore -- --yes --file backups/<任意のbackup>.json --scope-events event-spring-2026 --log backups/restore-logs/restore-session.jsonl
  ```
  - `Proceed with restore? (y/N):` が表示され、`y` で続行
  - `Restore completed.` が表示される
  - 指定 `--log` ファイルが追記される
  - JSONL 1行に `mode`, `actor`, `targetDocs`, `restoredCount`, `startedAt/completedAt`, `requestedScope` が含まれる

ログの想定キー（最終行1件）
```json
{"mode":"apply","actor":"...","targetDocs":123,"sourceDocs":130,"restoredCount":123,"startedAt":"...","completedAt":"...","requestedScope":{"events":["event-spring-2026"],"gyms":["gym-shibuya"]}}
```

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
