Flash用のコンペ登録サイトを作ってみる
https://vestige.github.io/FlashComp/

## Firestore test data scripts

The following commands are available:

- `npm run db:purge`
  - Safety mode. Does not delete anything unless `--yes` is provided.
- `npm run db:purge:yes`
  - Destructive. Deletes test data from Firestore (`events`, `gyms`, and known subcollections).
- `npm run db:seed`
  - Seeds realistic sample data for local testing (events, seasons, categories, routes, participants, scores).
  - Includes one ongoing event (`event-live-now`) and participants who join from mid seasons (`entrySeasonId`).
  - Participant docs include `participatingSeasonIds`, and season score docs include:
    - `participated: true/false`
    - `seasonStatus: active/absent`
    - `scores` (absent seasons are recorded as all `false`, i.e. 0 points)

Mid-season / skipped-season sample participants:
- `event-spring-2026`
  - `p004` Ren Kato: `["season-02","season-03"]`
  - `p103` Nagi Watanabe: `["season-02","season-03"]`
  - `p204` Rin Nakajima: `["season-03"]`
  - `p002` Riku Tanaka: `["season-01","season-03"]` (skips season 2)
- `event-live-now`
  - `p003` Mio Yamamoto: `["season-02","season-03"]`
  - `p104` Daichi Mori: `["season-02","season-03"]`
  - `p203` Sei Kobayashi: `["season-01","season-03"]` (skips phase 2)

Owner profile samples (`users` collection):
- `owner-shibuya` (`owner.shibuya@example.com`) -> `gymIds: ["gym-shibuya"]`
- `owner-yokohama` (`owner.yokohama@example.com`) -> `gymIds: ["gym-yokohama"]`
- `owner-multi` (`owner.multi@example.com`) -> `gymIds: ["gym-shibuya","gym-yokohama"]`

Owner access control fields used by app:
- `users/{uid}` (or fallback by matching `email`)
- `role` (currently expected: `owner`)
- `gymIds` (array of gyms the owner can manage/view)
- `npm run db:reset`
  - Runs purge + seed in sequence.

If you need to target another Firebase project, set these env vars before running:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

## USE
### local
- `npm install`
- `npm run db:reset`
- `npm run dev`

### test
- `npm run test:run`
