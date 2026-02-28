# list
- [x] データ入出力・運用: スケール面の見積もりと改善（Firestore読み取り最適化 第1弾）
- [x] デザイン変更。tailwindcssを利用する（全画面の既存inline styleをTailwind classへ移行）
- [x] 仕様書を起こす（SPEC.md）
- [x] ユーザーシナリオを作る（システム管理者、ジムオーナー、クライマー）
- [] ビルド警告の大きいチャンク対策（ルート単位の lazy 分割）
- [] Firestore最適化第2弾（EventDataIO/ParticipantScoreDetail の読み取り削減）
- [] デザインをもっと洗練したい

## 動線改善計画（第2版）
- [x] 完了: Dashboardの設定ポップアップを廃止し、`Event Settings` への直接導線に統一
- [x] 完了: イベント削除を `EditEvent` 内へ移動（Confirm付き）

### 優先1: Dashboard起点の導線強化
- [x] Dashboardカードの主CTAを状態別に最適化（`upcoming`=`Event Settings` / `live`=`Scores` / `completed`=`公開ランキング`）
- [x] Create New Event画面をダッシュボード上のポップアップで開始できるようにする
- [x] Dashboard改修後に `CreateEvent` 以降の管理画面へ同じデザイン言語を横展開（`CreateEvent` / `EditEvent` / `EventClimbers` / `EventScores` / `EventDataIO`）

### 優先2: Event設定画面の操作集約
- [x] イベント編集画面でイベント自体を編集できるようにする（名前・期間）
- [ ] `EditEvent` の設定進捗を可視化（シーズン/カテゴリ/課題）
- [ ] `EditEvent` / `EventClimbers` / `EventScores` のクイックナビを共通化
- [ ] イベント編集画面でシーズン追加をポップアップで行えるようにする（Create Eventと同系UI）
- [ ] イベント編集画面でカテゴリ追加をポップアップで行えるようにする（Create Eventと同系UI）

### 優先3: シーズン単位の編集導線
- [ ] シーズン編集画面を作る
- [ ] 課題の追加はシーズン編集画面で行う

### 優先4: スコア画面の往復改善
- [ ] `Scores` 画面で season/category 選択状態を戻り遷移でも保持

### 仕上げ
- [ ] 削除Confirmを専用モーダルに変更（誤操作防止）
- [ ] 受け入れ確認: `npm run lint` / `npm run test:run` / `npm run build`
