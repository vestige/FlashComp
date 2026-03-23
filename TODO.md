# TODO（作業カンバン）

## カラム
- Backlog: 未着手
- Ready: 着手可能
- In Progress: 着手中
- Blocked: 依存待ち・外部要因待ち
- Done: 完了

## P0（最優先：認証基盤）
### Backlog

### Done
- [x] 運用: データのバックアップ、リストア
- [x] 運用: テストデータの消去、復元
- [x] `KAN-001` [P0] 認証方式変更の目的（Googleアカウント固定運用 / テスト用途削減 / 切替工数削減）を合意し、`SPEC.md` に方針明文化
- [x] `KAN-002` [P0] `admin` / `owner` / `viewer` の許可範囲（画面・API・公開領域）をマッピングして承認
- [x] `KAN-003` [P0] 未登録Googleアカウントの扱い（即時拒否 / 申請導線）を仕様確定

## P0（最優先：運用基盤）
### In Progress

### Done
- [x] `KAN-011` 運用向けテスト追加
  - [x] `scripts/lib/purgeUtils.test.js` を追加（引数検証・scope解析）
  - [x] `dry-run` / ログ出力ペイロードの検証を追加
  - [x] `restore` / `backup` 系にも同観点のテストを横展開（`backupUtils.test.js` / `restoreUtils.test.js`）
  - [x] `npm run test:run` で回帰確認
- [x] `KAN-007` `db:purge` 系スクリプトの安全化
  - [x] `--dry-run` と `--scope=`（イベントID/ gym）を追加
  - [x] テストデータ削除とシステムデータ削除を明示分離
  - [x] 破壊系操作の実行履歴を保存
  - [x] `TEST.md` 手順に沿って `demo` で dry-run / apply を各1回確認
- [x] `KAN-005` `db:backup` 系スクリプトの運用化
  - [x] `--out` 形式の命名規則を環境別（demo/prod）に統一
  - [x] backup manifest（`exportedAt`,`sourceUser`,`docCount`,`eventCount`）を標準化
  - [x] `db:backup:demo` / `db:backup:prod` / `db:backup:system` を運用確定
  - [x] `db:clear`（`--all` 相当）と `db:format:demo` をデモ整形の標準手順化

### Ready

### Backlog
- [ ] `KAN-008` テストデータバリエーションを運用向けに拡充
  - [ ] `seed` の複数イベント/カテゴリ/季節構成を追加
  - [ ] 未配列/混在データなど復元復旧のエッジケースを追加

## P1（次点：デモ支援）
### Done
- [x] `KAN-013` GitHub Pages の `demo` / `prod` 同時運用を維持するため、`prod` デプロイでも `keep_files: true` を適用

### Backlog
- [ ] `KAN-012` CI: GitHub Actions の Node24移行警告を抑えるため、公式デプロイ方式検討（将来対応）
- [ ] `KAN-009` `EventDataIO` をUIから復活し、実運用の「CSVエクスポート/取り込み・バックアップ導線」を明示
  - [ ] 「イベントごとの運用作業入口」として説明文を追加
  - [ ] データ入出力の可否（成功/失敗）を明確に表示
- [ ] `KAN-010` デモ用コマンドを追加
  - [ ] `npm run demo:prepare`（backup→purge→seed）を実装
  - [ ] `npm run demo:reset`（必要ならテストデータ再構成）を追加

## FB
- [ ] Event Settings画面、シーズン作成のポップアップ画面にイベント全体の日付を表示する
- [ ] データの保存、復元、削除についてのスクリプトからUserは外すべきか？検討する
- [x] DemoモードとProdモード、両方一緒に動かすことはできるの？demoをためしてもらうときに、prodがとまるのやだな
