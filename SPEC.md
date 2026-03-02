# FlashComp Data Spec

最終更新: 2026-03-02

## 概要
現行実装では、イベント配下に以下の構造を持ちます。

- イベント共通: `categories`, `participants`
- シーズン共通課題マスタ: `seasons/{seasonId}/tasks`
- カテゴリごとの課題採用: `seasons/{seasonId}/categoryTaskMap/{categoryId}/assignments`
- 互換レイヤー（既存採点・集計用）: `seasons/{seasonId}/categories/{categoryId}/routes`
- スコア: `seasons/{seasonId}/categories/{categoryId}/participants/{participantId}`

## 用語（呼び名）
- `participants` = `climbers`（クライマー）
- `users` = `gymOwners`（運営ユーザー。role が `owner` または `admin`）
- `tasks` = シーズン共通の課題マスタ
- `categoryTaskMap/.../assignments` = カテゴリごとの課題セット（採用リスト）
- `routes` = 旧構造の互換データ（将来廃止予定）

## Firestore構造図
```mermaid
graph TD
  ROOT["Firestore"] --> EVENTS["events/{eventId}"]
  ROOT --> GYMS["gyms/{gymId}"]
  ROOT --> USERS["users/{uid}"]

  EVENTS --> ECAT["categories/{categoryId}"]
  EVENTS --> EPART["participants/{participantId}"]
  EVENTS --> SEASON["seasons/{seasonId}"]

  SEASON --> TASKS["tasks/{taskId}"]
  SEASON --> CTM["categoryTaskMap/{categoryId}"]
  CTM --> ASSIGN["assignments/{taskId}"]

  %% backward compatibility
  SEASON --> SCAT["categories/{categoryId}"]
  SCAT --> ROUTES["routes/{taskId}"]
  SCAT --> SCORES["participants/{participantId}"]
```

## ドキュメント定義

### 1) `events/{eventId}`
イベント本体。

主なフィールド（例）:
- `name`
- `gymId`
- `startDate`
- `endDate`

### 2) `events/{eventId}/categories/{categoryId}`
イベント共通カテゴリ。

主なフィールド（例）:
- `name`

### 3) `events/{eventId}/participants/{participantId}`
イベント共通クライマー。

主なフィールド（例）:
- `name`
- `memberNo`
- `age`
- `gender`
- `grade`
- `categoryId`
- `entrySeasonId`（seed由来）
- `participatingSeasonIds`（seed由来）

### 4) `events/{eventId}/seasons/{seasonId}`
シーズン本体。

主なフィールド（例）:
- `name`
- `startDate`
- `endDate`

### 5) `events/{eventId}/seasons/{seasonId}/tasks/{taskId}`
シーズン共通課題マスタ（30〜40件想定）。

主なフィールド（例）:
- `taskNo`
- `name`（例: `No.01`）
- `grade`
- `points`
- `isBonus`
- `isActive`

### 6) `events/{eventId}/seasons/{seasonId}/categoryTaskMap/{categoryId}/assignments/{taskId}`
カテゴリごとの課題採用定義（選択集合）。

主なフィールド（例）:
- `enabled`
- `taskNo`

### 7) `events/{eventId}/seasons/{seasonId}/categories/{categoryId}/routes/{taskId}`
互換レイヤー。旧実装の読み取り先。

主なフィールド（例）:
- `name`
- `taskNo`
- `grade`
- `points`
- `isBonus`

### 8) `events/{eventId}/seasons/{seasonId}/categories/{categoryId}/participants/{participantId}`
シーズン x カテゴリ x クライマーのスコア。

主なフィールド（例）:
- `scores`: `{ [taskNameOrTaskId]: boolean }`
- `updatedAt`
- `participated`（seed由来）
- `seasonStatus`（seed由来）

## Seasons配下の見方
- `tasks`: そのシーズンの「全課題」30-40件
- `categoryTaskMap/{categoryId}/assignments`: そのカテゴリで使う課題IDの集合
- `categories/{categoryId}/routes`: 旧採点ロジック互換のために同期している複製
- `categories/{categoryId}/participants`: クライマーの採点結果（scores）

## 現在の運用上の注意
- 課題の正規データは `tasks` + `categoryTaskMap` 側。
- 採点・ランキング・CSV は `tasks` + `assignments` を直接参照する。
- `routes` は旧データ互換レイヤーとして残っているが、新規同期は行っていない。

## Firestore読み取り最適化（第1弾: 2026-02-24）
### 対象
- `ScoreManager`（採点入口）
- `EventSummary`（公開ランキング）

### 実装内容
- `ScoreManager`
  - 変更前: `participants` を全件取得してクライアント側で `categoryId` フィルタ
  - 変更後: `where("categoryId", "==", selectedCategory)` でカテゴリ単位に取得
- `EventSummary`
  - 変更前: ランキング計算時、選択カテゴリに関係なく全カテゴリ分のスコアを走査
  - 変更後: `selectedCategoryId !== "all"` の場合は選択カテゴリのみでランキング計算

### 読み取り見積もり（概算）
- 記号:
  - `S`: 対象シーズン数
  - `C`: カテゴリ数
  - `Pc`: 1カテゴリあたりの参加者数
  - `P`: イベント全体参加者数
- `ScoreManager`:
  - 変更前: `P`
  - 変更後: `Pc`
- `EventSummary`（カテゴリ1つ選択時）:
  - 変更前: `S * C` 回のカテゴリ走査
  - 変更後: `S` 回のカテゴリ走査

## 画面導線仕様（2026-02-28時点）
運営側の導線は「入口を絞る」方針で以下に整理する。

- ダッシュボード（`/dashboard`）のイベント別入口:
  - `Create New Event` はダッシュボード内モーダル（ポップアップ）で起動
  - `設定` -> `/events/{eventId}/edit`
  - `クライマー` -> `/events/{eventId}/climbers`
  - `スコア` -> `/events/{eventId}/scores`（`live` のときのみ表示）
  - 主CTA（状態別）:
    - `upcoming`: `Event Settings`（`/events/{eventId}/edit`）
    - `live`: `Scores`（`/events/{eventId}/scores`）
    - `completed`: `Public Ranking`（`/score-summary/{eventId}`）
- 管理ページ共通（`EventClimbers` / `EventScores`）:
  - ページ上部に共通クイックナビ（`イベント設定` / `クライマー管理` / `スコア管理`）
  - 現在ページのみアクティブスタイルで表示
- 設定画面（`/events/{eventId}/edit`）内のナビ:
  - イベント基本情報の編集（イベント名・開始日・終了日）
  - 設定進捗の可視化（シーズン / カテゴリ / 課題の3ステップ）
  - シーズンカードで、イベント期間外のシーズンを警告表示する
  - シーズン追加は `EditEvent` 内モーダルで実行（`＋ シーズン追加`）
  - シーズン期間はイベント期間内のみ登録可能
  - シーズンタブはカード一覧表示（期間・状態バッジ・編集/削除）
  - シーズンの `編集` は専用ページへ遷移（`/events/{eventId}/seasons/{seasonId}/edit`）
  - カテゴリ追加は `EditEvent` 内モーダルで実行（`＋ カテゴリ追加`）
  - `課題` タブはシーズン編集ページへの導線（直接編集は行わない）
  - `シーズン`
  - `カテゴリ`
  - `課題`
  - `戻る`（ダッシュボード）
- シーズン編集画面（`/events/{eventId}/seasons/{seasonId}/edit`）:
  - シーズン名・期間の更新
  - イベント開催期間を参照表示する
  - シーズン期間はイベント期間内のみ更新可能
  - シーズン課題の登録・編集・削除
  - カテゴリ採用課題の選択
  - シーズン削除（Confirmダイアログ）
- クライマー画面（`/events/{eventId}/climbers`）:
  - クライマー登録・編集・削除
  - クライマーCSV出力/取り込み
  - 男女比CSV出力
  - `戻る`（ダッシュボード）
- スコア画面（`/events/{eventId}/scores`）:
  - 採点対象の選択と採点画面遷移
  - 順位CSV出力（全シーズン or 単一シーズン）
  - `公開ランキング`（`/score-summary/{eventId}`）
  - `戻る`（ダッシュボード）

## ユーザーシナリオ（TODO反映）
### 目的
- 運営側の負担を減らす（点数設定、集計、公開）
- クライマーのモチベーションを上げる（すぐに結果が見られる）

### システム管理者
- ジムのオーナー登録
- ジムの登録・削除・編集
- すべてのジムのイベント編集や採点を実施

### 運営側（ジムオーナー）
#### イベント開催前
- イベントの登録・削除・編集（イベント名、シーズン数、カテゴリ）
- シーズンの登録・削除・編集（シーズン名）
- シーズンごとの課題の登録・削除・編集（番号、級、点数）
- カテゴリの登録・削除・編集（カテゴリ名）

#### イベント開催後
- クライマー登録（名前、会員番号、年齢、性別、参加カテゴリ）
- CSV形式でのデータ入出力（参加情報、男女比率、シーズン別順位など）
- クライマーごとの得点入力（完登課題をチェック）

### クライマー側
- スマートフォンで閲覧
- ログイン不要
- 自分のスコア確認
- カテゴリごとの集計結果確認
