Flash用のコンペ登録サイトを作ってみる
https://vestige.github.io/FlashComp/
同一Firebase運用のデモは、以下で確認
https://vestige.github.io/FlashComp/demo/
※ステージングが必要な場合は `https://vestige.github.io/FlashComp/stg/` を利用

## Google認証（最小権限アカウント運用）

1. Firebase Console の管理画面で `Authentication > Sign-in method` の Google を有効化し、Email/Password を無効化する
2. `Login` は Google Sign-In のみであることを確認する
3. Firebase Console の `users` で検証アカウントを準備する
   - `admin` 用: `role: "admin", gymIds: ["*"]`
   - `owner` 用: `role: "owner", gymIds: ["gym-shibuya"]`（担当ジム1つ以上）
   - `viewer` 用: `role: "viewer", gymIds: []`
4. `VITE_FIREBASE_*` を確認し、ステージング（または本番）環境で起動
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
  - `stg`: `https://vestige.github.io/FlashComp/stg/`
  - `demo`: `https://vestige.github.io/FlashComp/demo/`
