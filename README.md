Flash用のコンペ登録サイトを作ってみる
https://vestige.github.io/FlashComp/

## Spec
- データ構造と関連図: `SPEC.md`

## Firestore test data scripts

The following commands are available:

- `npm run db:purge`
  - Safety mode. Does not delete anything unless `--yes` is provided.
- `npm run db:purge:yes`
  - Destructive. Deletes test data from Firestore for events the signed-in owner can manage.
- `npm run db:purge:yes:system`
  - Tries to delete top-level `events`, `gyms`, `users` as well. Use only with privileged account/rules.
- `npm run db:seed`
  - Seeds realistic sample data for local testing (events, seasons, categories, routes, participants, scores) within owner gym scope.
- `npm run db:seed:system`
  - Also tries to write `gyms` and sample `users` docs.
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
- `owner-multi` (`owner.multi@example.com`) -> `role: "admin", gymIds: ["*"]` (all gyms)


Owner access control fields used by app:
- `users/{uid}` (or fallback by matching `email`)
- `role` (`owner` or `admin`)
- `gymIds` (array of gyms the owner can manage/view, `["*"]` means all gyms)
- If `users/{uid}` is missing but matching `email` doc exists, app migrates profile to `users/{uid}` on login.

## System admin screen

- Route: `/system-admin`
- Access: authenticated user with `users/{uid}.role == "admin"`
- Capabilities:
  - Gym CRUD (`gyms` collection)
  - Owner/admin profile CRUD (`users` collection, `role` + `gymIds` assignment)
  - `owner` requires explicit `gymIds`
  - `admin` is saved as full access (`gymIds: ["*"]`)

## CSV data IO (owner operation)

- Route: `/events/:eventId/data-io`
- Access: event writable owner/admin
- Available operations:
  - Participant CSV export/import
    - Required import columns: `name,memberNo,age,gender,categoryId`
  - Ranking CSV export (all seasons or single season)
  - Gender ratio CSV export (overall + category breakdown)

## Firestore security rules

- Rule file: `firestore.rules`
- Current policy:
  - Climber pages: public read (`events`, event subcollections, `gyms`)
  - Owner write: if `users/{uid}.role` is `owner`/`admin` and target `gymId` is allowed
  - `admin` or `gymIds` including `*` can manage all gyms/events
  - Event subcollections (`seasons/categories/routes/participants/...`) writes are restricted by parent event's `gymId`
  - `gyms` write is allowed for `admin` only
  - `users` write is allowed for self or `admin`

Important:
- For production auth users, create `users/{uid}` docs keyed by Firebase Auth `uid`.
- Required fields: `role`, `gymIds`.
- If `users/{uid}` is missing, owner writes will be denied by rules.
- For full access test accounts, use `role: "admin"` and `gymIds: ["*"]`.

Deploy rules:
- `npx firebase-tools login`
- `npx firebase-tools deploy --only firestore:rules --project flashcompauth`

Owner access verification (after login + rules deploy):
- Set env vars and run:
  - `$env:OWNER_EMAIL='owner.shibuya@example.com'`
  - `$env:OWNER_PASSWORD='YOUR_PASSWORD'`
  - `npm run verify:owner-access`

Reset/seed/purge auth:
- Set script auth env vars before running db scripts:
  - `$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'`
  - `$env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'`
- Then run:
  - `npm run db:reset`
  - (`db:reset` runs purge + seed with current owner's gym scope)

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
- `$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'`
- `$env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'`
- `npm run db:reset`
- `npm run dev`

### test
- `npm run test:run`
