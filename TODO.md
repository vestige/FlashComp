# TODO（作業カンバン）

## カラム
- Backlog: 未着手
- Ready: 着手可能
- In Progress: 着手中
- Blocked: 依存待ち・外部要因待ち
- Done: 完了

## P0（最優先：認証基盤）
### Backlog
- [ ] 運用: データのバックアップ、リストア
- [ ] 運用: テストデータの消去、復元
- [ ] テストデータのバリエーションを増やす
- [ ] `KAN-001` [P0] 認証方式変更の目的（Googleアカウント固定運用 / テスト用途削減 / 切替工数削減）を合意し、`SPEC.md` に方針明文化
- [ ] `KAN-002` [P0] `admin` / `owner` / `viewer` の許可範囲（画面・API・公開領域）をマッピングして承認
- [ ] `KAN-003` [P0] 未登録Googleアカウントの扱い（即時拒否 / 申請導線）を仕様確定

## P0（最優先：運用基盤）
### In Progress
- [ ] `KAN-013` デモ Firebase 環境の構築（別プロジェクト化）
  - [x] 本番側 Firebase 設定を確定
  - [ ] デモ用 Firebase プロジェクトの確認（既存データなし・新規作成）
  - [ ] デモ用 Firebase 構成値（`VITE_FIREBASE_*_DEMO`）を GitHub Secrets 登録
  - [ ] デモプロジェクトで Firestore を作成し、`firestore.rules` を適用
  - [ ] デモ Authentication の Google 有効化、`vestige.github.io` を承認済みドメイン追加
  - [ ] デモユーザーの `users/{uid}` を事前登録（viewer/admin/owner）
  - [ ] `workflow_dispatch` から `target_env=demo` デプロイして表示/ログイン/権限を確認

- [ ] `KAN-005` `db:backup` 系スクリプトの運用化
  - [x] `--out` 形式の命名規則を環境別（demo/stg/prod）に統一
  - [x] backup manifest（`exportedAt`,`sourceUser`,`docCount`,`eventCount`）を標準化
  - [ ] `db:backup:demo` / `db:backup:system` コマンドの仕様確定

### Done
- [x] `KAN-006` `db:restore` 系スクリプトの安全化
  - [x] `--dry-run` を追加して事前見積もり表示
  - [x] 実行前の対象スコープ（gym/event）を表示し確認を強制
  - [x] `db:restore` 実行ログを保存（実行者、件数、実行時刻）

### Ready
- [ ] `KAN-004` デモ用運用フローを `TEST.md` と `SPEC.md` で確定
  - [ ] GitHub Pagesデモ起動手順（ログイン〜権限別操作確認）を明文化
  - [ ] デモ後ロールバック手順（復元・再起動・最終確認）を追加
  - [ ] 実施結果の受け入れチェックリストを追加
  - [ ] Unitテストと実環境検証を分離して記載
    - [ ] Unitテスト: `npm run test:run`（`package.json` の scripts）
    - [ ] Unit結果の基準: 既知失敗0件（許容条件のみ）
    - [ ] 実機スモーク: `npm run dev -- --mode demo`（ローカルでのログイン/権限確認）
    - [ ] 実運用確認: workflow_dispatch `target_env=demo` で GitHub Pages `/demo/` を検証
    - [ ] `dashboard`, `/system-admin`, `/score-summary` の表示系・権限制御・エラー時の文言を確認

### Backlog
- [ ] `KAN-007` `db:purge` 系スクリプトの安全化
  - [ ] `--dry-run` と `--scope=`（イベントID/ gym）を追加
  - [ ] テストデータ削除とシステムデータ削除を明示分離
  - [ ] 破壊系操作の実行履歴を保存
- [ ] `KAN-008` テストデータバリエーションを運用向けに拡充
  - [ ] `seed` の複数イベント/カテゴリ/季節構成を追加
  - [ ] 未配列/混在データなど復元復旧のエッジケースを追加

## P1（次点：デモ支援）
### Backlog
- [ ] `KAN-012` CI: GitHub Actions の Node24移行警告を抑えるため、公式デプロイ方式検討（将来対応）
- [ ] `KAN-009` `EventDataIO` をUIから復活し、実運用の「CSVエクスポート/取り込み・バックアップ導線」を明示
  - [ ] 「イベントごとの運用作業入口」として説明文を追加
  - [ ] データ入出力の可否（成功/失敗）を明確に表示
- [ ] `KAN-010` デモ用コマンドを追加
  - [ ] `npm run demo:prepare`（backup→purge→seed）を実装
  - [ ] `npm run demo:reset`（必要ならテストデータ再構成）を追加
- [ ] `KAN-011` 運用向けテスト追加
  - [ ] `scripts` の引数検証・dry-run・ログ出力を検証するテスト導線を追加
