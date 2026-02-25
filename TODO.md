# list
- [x] データ入出力・運用: スケール面の見積もりと改善（Firestore読み取り最適化 第1弾）
- [x] デザイン変更。tailwindcssを利用する（全画面の既存inline styleをTailwind classへ移行）
- [x] 仕様書を起こす（SPEC.md）
- [x] ユーザーシナリオを作る（システム管理者、ジムオーナー、クライマー）
- [] ビルド警告の大きいチャンク対策（ルート単位の lazy 分割）
- [] Firestore最適化第2弾（EventDataIO/ParticipantScoreDetail の読み取り削減）
- [] デザインをもっと洗練したい

## 明日の実装計画（別マシン再開用）

- [ ] ジム管理系ページの共通レイアウト適用確認（`ManagementLayout` のヘッダー/フッター）
- [ ] `Dashboard` を `DB2.html` ベースで再構成（Page Header / Settings / Registered Events）
- [ ] `Registered Events` をカードUI化（日付ブロック・ジム名・操作ボタン）
- [ ] イベント状態表示を追加（`LIVE` / `Completed` を日付から判定）
- [ ] フィルタUIを追加（`ALL` / `ACTIVE` の切り替え）
- [ ] `New Registrations` / `Score Completion` / `Active Judges` は実装しない
- [ ] Dashboard改修後に `CreateEvent` 以降の管理画面へ同じデザイン言語を横展開
