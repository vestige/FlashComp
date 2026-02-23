# FlashComp Data Spec

最終更新: 2026-02-23

## 概要
現行実装では、イベント配下に以下の構造を持ちます。

- イベント共通: `categories`, `participants`
- シーズン共通課題マスタ: `seasons/{seasonId}/tasks`
- カテゴリごとの課題採用: `seasons/{seasonId}/categoryTaskMap/{categoryId}/assignments`
- 互換レイヤー（既存採点・集計用）: `seasons/{seasonId}/categories/{categoryId}/routes`
- スコア: `seasons/{seasonId}/categories/{categoryId}/participants/{participantId}`

## 用語（呼び名）
- `participants` = `climbers`（参加者）
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
イベント共通参加者。

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
シーズン x カテゴリ x 参加者のスコア。

主なフィールド（例）:
- `scores`: `{ [taskNameOrTaskId]: boolean }`
- `updatedAt`
- `participated`（seed由来）
- `seasonStatus`（seed由来）

## Seasons配下の見方
- `tasks`: そのシーズンの「全課題」30-40件
- `categoryTaskMap/{categoryId}/assignments`: そのカテゴリで使う課題IDの集合
- `categories/{categoryId}/routes`: 旧採点ロジック互換のために同期している複製
- `categories/{categoryId}/participants`: 参加者の採点結果（scores）

## 現在の運用上の注意
- 課題の正規データは `tasks` + `categoryTaskMap` 側。
- ただし既存画面互換のため、`routes` へ同期書き込みを行っている。
- いずれ採点・ランキング側を `tasks` + `assignments` 直接参照へ移行できれば、`routes` は廃止可能。
