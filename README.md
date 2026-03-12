Flash用のコンペ登録サイトを作ってみる
https://vestige.github.io/FlashComp/

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
