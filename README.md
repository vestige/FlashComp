Flash用のコンペ登録サイトを作ってみる  
https://vestige.github.io/FlashComp/  
デモ運用は、以下で確認  
https://vestige.github.io/FlashComp/demo/

## 環境と配信先

- 本番: `https://vestige.github.io/FlashComp/`
- デモ: `https://vestige.github.io/FlashComp/demo/`
- データは環境別 Firebase を使う前提で運用します（本番データとデモデータを混在させない）

## ローカル起動

- 本番想定: `npm run dev -- --mode prod`（`.env.prod.local` を使用）
- デモ想定: `npm run dev -- --mode demo`（`.env.demo.local` を使用）
- `npm run build:prod / build:demo` で配信時振る舞いを事前確認

### Firebase 環境変数（GitHub Secrets）

- 本番（prod）: `VITE_FIREBASE_API_KEY_PROD`, `VITE_FIREBASE_AUTH_DOMAIN_PROD`, `VITE_FIREBASE_PROJECT_ID_PROD`, `VITE_FIREBASE_STORAGE_BUCKET_PROD`, `VITE_FIREBASE_MESSAGING_SENDER_ID_PROD`, `VITE_FIREBASE_APP_ID_PROD`
- デモ（demo）: `VITE_FIREBASE_API_KEY_DEMO`, `VITE_FIREBASE_AUTH_DOMAIN_DEMO`, `VITE_FIREBASE_PROJECT_ID_DEMO`, `VITE_FIREBASE_STORAGE_BUCKET_DEMO`, `VITE_FIREBASE_MESSAGING_SENDER_ID_DEMO`, `VITE_FIREBASE_APP_ID_DEMO`
- 値はダブルクォートなしで登録してください（末尾の改行や空白も含めない）
- 本番は旧名 `VITE_FIREBASE_*` のフォールバックもありますが、運用としては `*_PROD` 系を推奨します。

### 補足（GitHub Secret Scanning）

本番・デモの Firebase クライアントキーは、ブラウザ配信バンドルに含まれるため、GitHub Secret Scanning で
`Publicly leaked secret` と誤検知（false positive）されることがあります。  
対処は以下を実施してください。

- Google API コンソールでキー制限（必要ならリファラー制限）を必ず入れる  
- サービスアカウントキーや秘密度の高いトークンをこのファイルに入れない  
- 警告対象キーの用途（公開クライアントキーか）と GitHub Secrets の突合を確認  
- GitHub の secret scan 通知を確認し、用途確認後に「False Positive」として close できるか判定する

## Google認証（最小権限アカウント運用）

1. Firebase Console の管理画面で `Authentication > Sign-in method` の Google を有効化し、Email/Password は運用上無効化する
2. `Login` は Google Sign-In のみであることを確認する
3. Firebase Console の `users` で検証アカウントを準備する
   - `admin` 用: `role: "admin", gymIds: ["*"]`
   - `owner` 用: `role: "owner", gymIds: ["gym-shibuya"]`（担当ジム1つ以上）
   - `viewer` 用: `role: "viewer", gymIds: []`
4. `VITE_FIREBASE_*` を確認し、デモ/本番環境で起動
5. `admin` / `owner` / `viewer` の3パターンで
   - `/system-admin`、`/dashboard`、`/events/:id/scores` の挙動
   - 管理操作と公開表示（`/score-summary`）を手早く確認

## Spec
- データ構造と関連図: `SPEC.md`

## テスト手順と運用
- 認証・権限・DB seed の実行手順は `TEST.md` を参照
- `spec` ベースの仕様は `SPEC.md`

## デプロイ運用（GitHub Pages）

- `main` への push: 本番デプロイ（`/FlashComp/`）
- GitHub Actions の `workflow_dispatch` から `target_env` を選択して配信先を切替
  - `prod`: 本番（`/FlashComp/`）
  - `demo`: `https://vestige.github.io/FlashComp/demo/`
- `build:prod` と `build:demo` は `vite.config.js` の `base` と連動して、GitHub Pages の配下ルーティングを自動的に合わせる
- `main` push デプロイが成功した場合、`/FlashComp/` が上書きされる想定です。

※CI/ローカルとも `VITE_FIREBASE_*` は必須です。未設定なら起動時に明示エラーで停止します。  
ローカルは `.env.prod.local` / `.env.demo.local` へ、GitHub Actions は上記 Secrets に環境別値を登録してください。
