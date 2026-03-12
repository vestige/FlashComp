# TODO（作業カンバン）

## カラム
- Backlog: 未着手
- Ready: 着手可能
- In Progress: 着手中
- Blocked: 依存待ち・外部要因待ち
- Done: 完了

## P0（最優先：認証基盤）

### Backlog
- [ ] `KAN-001` [P0] 認証方式変更の目的（Googleアカウント固定運用 / テスト用途削減 / 切替工数削減）を合意し、`SPEC.md` に方針明文化
- [ ] `KAN-002` [P0] `admin` / `owner` / `viewer` の許可範囲（画面・API・公開領域）をマッピングして承認
- [ ] `KAN-003` [P0] 未登録Googleアカウントの扱い（即時拒否 / 申請導線）を仕様確定
- [x] `KAN-004` [P0] ステージング・本番で Google Provider 設定（ドメイン/リダイレクト）を反映
- [x] `KAN-005` [P0] メール/パスワード認証の継続可否を決定し、OAuth以外運用をルール化
- [x] `KAN-006` [P0] `src/pages/Login.jsx` を Google sign-in へ置換
- [x] `KAN-007` [P0] 既存メール/パスワードUIを削除または非表示化
- [x] `KAN-008` [P0] Googleログイン失敗時（ポップアップ拒否/ドメイン不一致/ネットワーク）メッセージ分岐を実装
- [x] `KAN-009` [P0] `users/{uid}` 参照・初期作成の共通ヘルパーを実装（`hooks/lib`）
- [x] `KAN-010` [P0] 初回ログイン時の `users/{uid}` 自動作成方針（`role` / `gymIds`）を確定して実装
- [x] `KAN-011` [P0] `firestore.rules` の `users/{uid}` 前提ルールを画面導線に合わせ再設計
- [x] `KAN-012` [P0] 管理画面/公開画面の読み取り・書き込み権限を明示分離しルール化
- [x] `KAN-013` [P0] `admin` 全ジム / `owner` 担当ジムのアクセス制限をルールと取得処理で担保

## P1（高優先：実装完成）

### Backlog
- [x] `KAN-101` [P1] `useOwnerProfile` / 権限制御系フックが常に最新 `users/{uid}.role` / `gymIds` を参照することを担保
- [x] `KAN-102` [P1] `owner` 切替後（`gymIds` 変更）UIと権限表示の即時再取得を実装
- [x] `KAN-103` [P1] `routes` と管理画面 (`/system-admin`, `/dashboard`, `/events/...`) の権限チェックを統一
- [x] `KAN-104` [P1] ログイン後リダイレクト先（`from` クエリ or デフォルト）を統一
- [x] `KAN-105` [P1] ログアウト / セッション切替時のヘッダー・戻る導線表示を確認
- [x] `KAN-106` [P1] `permission-denied` を捕捉し、管理用メッセージに変換する
- [x] `KAN-107` [P1] Climber Portal の見た目（タイトル/セクション）を既存UIへ揃える
- [x] `KAN-108` [P1] 仕様の「認証試験手順（Googleログイン）」を `admin` / `owner` / 非許可で再作成
- [x] `KAN-109` [P1] `SPEC.md` の運用メモを `users/{uid}` ロール編集前提に更新
- [x] `KAN-110` [P1] `README.md` に最小権限アカウント開始手順を追記
- [x] `KAN-111` [P1] リリース前チェックリストを `SPEC.md` に移植（ログイン・権限復旧・公開ページ）

## P2（中優先：UI/体裁改善）

### Backlog
- [x] `KAN-201` [P2] Climber Detail のUIを既存管理画面デザインに統一
  - [x] `KAN-201-01` [P2] `src/pages/ParticipantScoreDetail.jsx` の読み込み/エラー/メインの共通ラッパーを導入する
    - `pageBackgroundClass` / `pageContainerClass` を採用し、他管理ページと同一トーンの背景と余白を適用
    - ロード中・エラー時も同一ラッパー構造で表示を統一
  - [x] `KAN-201-02` [P2] ヘッダ領域を `ManagementHero` ベースに差し替える
    - タイトル・説明・戻り先を既存仕様準拠で再構成
    - `backLabel`（集計結果/ランキングに戻る）を維持し、`return` 遷移情報を壊さない
  - [x] `KAN-201-03` [P2] セクション構成を共通コンポーネント化
    - `sectionHeadingClass` + `sectionCardClass` へ置換
    - 表示シーズン、合計、近い順位のクライマーを統一見出し/カード構成に再レイアウト
    - `inputFieldClass` / `subtleButtonClass` を使って選択UIとリンクUIを整える
  - [x] `KAN-201-04` [P2] 総合/セクション集計の可読性を改善
    - 総合ポイント、完登数、順位をメトリクスカードで見やすく整理
    - `calculating` 表示をトースト/インフォカード化して視認性を上げる
  - [x] `KAN-201-05` [P2] シーズン別内訳のカード化とテーブルUI統一
    - `season -> category` をカード構造で階層化
    - テーブルヘッダの背景と行余白を整備、完登課題0件時の文言を明示
  - [x] `KAN-201-06` [P2] 既存挙動回帰テストを追加
    - `src/pages/ParticipantScoreDetail.test.jsx` で `backLink`、`return=ranking`、順位リンクのクエリ維持、トップ/下位境界メッセージを再確認
    - UI変更で文言を置換した場合はアサーション更新（ページタイトル/見出し/ローディング）
  - [x] `KAN-201-07` [P2] 回収タスク
    - 未使用CSSの整理（共通クラス利用後に不要な手書きクラス除去）
    - 再読込時の画面初期化と state リセット（selectedSeasonId）影響がないことを最終確認
- [x] `KAN-202` [P2] Ranking の Summary セクションを追加（イベント情報を表示）
- [ ] `KAN-203` [P2] Ranking のセクションごとのアイコン設計と反映
- [ ] `KAN-204` [P2] Ranking 一覧表示をデザイン改善（情報優先度・視認性・余白）
