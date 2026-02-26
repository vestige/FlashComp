# list
- [x] データ入出力・運用: スケール面の見積もりと改善（Firestore読み取り最適化 第1弾）
- [x] デザイン変更。tailwindcssを利用する（全画面の既存inline styleをTailwind classへ移行）
- [x] 仕様書を起こす（SPEC.md）
- [x] ユーザーシナリオを作る（システム管理者、ジムオーナー、クライマー）
- [] ビルド警告の大きいチャンク対策（ルート単位の lazy 分割）
- [] Firestore最適化第2弾（EventDataIO/ParticipantScoreDetail の読み取り削減）
- [] デザインをもっと洗練したい

## 明日の実装計画（別マシン再開用）

- [ ] upcomingイベントが一目で分かるように表示を改善（配色・バッジ・カード強調を見直し）
- [x] ジム管理系ページの共通レイアウト適用確認（`ManagementLayout` のヘッダー/フッター）
- [x] `Dashboard` を `DB2.html` ベースで再構成（Page Header / Settings / Registered Events）
- [x] `Registered Events` をカードUI化（日付ブロック・ジム名・操作ボタン）
- [x] イベント状態表示を追加（`LIVE` / `Completed` を日付から判定）
- [x] フィルタUIを追加（`ALL` / `ACTIVE` の切り替え）
- [x] `New Registrations` / `Score Completion` / `Active Judges` は実装しない
- [ ] Dashboard改修後に `CreateEvent` 以降の管理画面へ同じデザイン言語を横展開（`CreateEvent` は対応済み）
