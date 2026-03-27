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
- [x] Event Settings画面、シーズン作成のポップアップ画面にイベント全体の日付を表示する
- [x] Event Settings画面、シーズン作成のポップアップ画面の日付の初期値を設定する
  - [x] 初回は Event 日付の開始〜終了を初期値にする
  - [x] 2つ目以降は直近シーズン終了日の次の日〜イベント最終日を初期値にする
  - [x] すでにイベント最終日まで埋まっている場合は Event 日付の開始〜終了を初期値に戻す

## P0（最優先：運用基盤）
### In Progress

### Done

### Ready

### Backlog

## P1（次点：デモ支援）
### Done

### Backlog
- [ ] `KAN-012` CI: GitHub Actions の Node24移行警告を抑えるため、公式デプロイ方式検討（将来対応）
- [ ] `KAN-009` `Result` サマリーのデータ出力は要件再定義後に再開（いったん保留）
  - [ ] 出力して嬉しい情報（対象指標・粒度・形式）を合意
  - [ ] 合意後にUI導線と出力フォーマットを実装
- [ ] `KAN-010` デモ用コマンドを追加
  - [ ] `npm run demo:prepare`（backup→purge→seed）を実装
  - [ ] `npm run demo:reset`（必要ならテストデータ再構成）を追加

## FB
- [ ] データの保存、復元、削除についてのスクリプトからUserは外すべきか？検討する
