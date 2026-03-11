Flash用のコンペ登録サイトを作ってみる
https://vestige.github.io/FlashComp/

## Spec
- データ構造と関連図: `SPEC.md`

## Firestore test data scripts

The following commands are available:

- `npm run db:purge`
  - Safety mode. Does not delete anything unless `--yes` is provided.
- `npm run db:purge:yes`
  - Destructive. Deletes test data from Firestore for events the signed-in gymOwner can manage.
- `npm run db:purge:yes:system`
  - Tries to delete top-level `events`, `gyms`, `users` (gymOwners collection) as well. Use only with privileged account/rules.
- `npm run db:seed`
  - Seeds realistic sample data for local testing (events, seasons, categories, routes, participants(climbers), scores) within gymOwner gym scope.
  - Includes `ended`, `live`, `upcoming`, and `single-category` patterns for UI verification.
- `npm run db:seed:system`
  - Also tries to write `gyms` and sample `users` docs for gymOwners.
  - Includes one ongoing event (`event-live-now`) and climbers who join from mid seasons (`entrySeasonId`).
  - Participant docs include `participatingSeasonIds`, and season score docs include:
    - `participated: true/false`
    - `seasonStatus: active/absent`
    - `scores` (absent seasons are recorded as all `false`, i.e. 0 points)
- `npm run db:backup`
  - Exports manageable `events` subtree docs to `backups/firestore-backup-<timestamp>.json`.
  - Optional: `npm run db:backup -- --out backups/my-backup.json`
- `npm run db:backup:system`
  - Same as backup, plus `gyms` and `users` collections.
- `npm run db:restore -- --yes --file <backup-json>`
  - Restores docs from backup JSON into Firestore.
  - Scope-safe: when not admin/all-gym, docs outside your gym scope are skipped.
  - Optional `--include-system` to restore `gyms/users` docs too.

Mid-season / skipped-season sample climbers:
- `event-spring-2026`
  - `p004` Ren Kato: `["season-02","season-03"]`
  - `p103` Nagi Watanabe: `["season-02","season-03"]`
  - `p204` Rin Nakajima: `["season-03"]`
  - `p002` Riku Tanaka: `["season-01","season-03"]` (skips season 2)
- `event-live-now`
  - `p003` Mio Yamamoto: `["season-02","season-03"]`
  - `p104` Daichi Mori: `["season-02","season-03"]`
  - `p203` Sei Kobayashi: `["season-01","season-03"]` (skips phase 2)

Additional event patterns for validation:
- `event-upcoming-2026`: upcoming event (future start/end dates)
- `event-rookie-cup-2026`: single season + single category (small dataset)

GymOwner profile samples (`users` collection):
- `owner-shibuya` (`owner.shibuya@example.com`) -> `gymIds: ["gym-shibuya"]`
- `owner-yokohama` (`owner.yokohama@example.com`) -> `gymIds: ["gym-yokohama"]`
- `owner-multi` (`owner.multi@example.com`) -> `role: "admin", gymIds: ["*"]` (all gyms)
- `viewer-sample` -> `role: "viewer", gymIds: []`


GymOwner access control fields used by app:
- `users/{uid}` (gymOwners profile)
- `role` (`viewer` / `owner` / `admin`)
- `gymIds` (array of gyms the gymOwner can manage/view, `["*"]` means all gyms)

## Google login onboarding (gymOwner/admin)

- Login method for management pages: Google Sign-In
- Email/Password authentication should be disabled in Firebase Auth for management access.
- First login can succeed in Firebase Auth even if profile is missing.
- First-time login automatically creates `users/{uid}` as:
  - `role: "viewer"`
  - `gymIds: []`
- Full management access is enabled when system admin updates `users/{uid}`:
  - `owner`: `role` + `gymIds`（担当ジムを1つ以上）
  - `admin`: `role: "admin", gymIds: ["*"]`

## System admin screen

- Route: `/system-admin`
- Access: authenticated user with `users/{uid}.role == "admin"`
- Capabilities:
  - Gym CRUD (`gyms` collection)
  - GymOwner/admin profile CRUD (`users` collection, `role` + `gymIds` assignment)
  - `owner` requires explicit `gymIds`
  - `admin` is saved as full access (`gymIds: ["*"]`)

## CSV data IO (gymOwner operation)

- Access: event writable gymOwner/admin
- Available operations:
  - Climber management (`/events/:eventId/climbers`)
    - Climber CSV export/import
    - Required import columns: `name,memberNo,age,gender,categoryId`
    - Gender ratio CSV export (overall + category breakdown)
  - Score management (`/events/:eventId/scores`)
    - Ranking CSV export (all seasons or single season)

## Firestore security rules

- Rule file: `firestore.rules`
- Current policy:
  - Climber pages: public read (`events`, event subcollections, `gyms`)
  - GymOwner write: if `users/{uid}.role` is `owner`/`admin` and target `gymId` is allowed
  - `admin` or `gymIds` including `*` can manage all gyms/events
  - Event subcollections (`seasons/categories/routes/participants/...`) writes are restricted by parent event's `gymId`
  - `gyms` write is allowed for `admin` only
  - `users` write is allowed for `admin` only

Important:
- For production auth users, create `users/{uid}` docs keyed by Firebase Auth `uid` (admin operation).
- Required fields: `role`, `gymIds`.
- If `users/{uid}` is missing, gymOwner writes will be denied by rules.
- For full access test accounts, use `role: "admin"` and `gymIds: ["*"]`.

Deploy rules:
- `npx firebase-tools login`
- `npx firebase-tools deploy --only firestore:rules --project flashcompauth`

GymOwner access verification (after login + rules deploy):
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
  - (`db:reset` runs purge + seed with current gymOwner's gym scope)

Suggested pre-operation workflow:
1. `npm run db:backup -- --out backups/pre-op.json`
2. `npm run db:purge:yes`
3. `npm run db:seed` (for staging checks) or continue with clean state
4. If rollback needed: `npm run db:restore -- --yes --file backups/pre-op.json`

If you need to target another Firebase project, set these env vars before running:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

For frontend execution (Vite), create `.env.staging` and `.env.production` from `.env.example` and fill:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Build mode tips:

- `npm run dev -- --mode staging` -> loads `.env.staging`
- `npm run build -- --mode production` -> loads `.env.production`

After changing values, verify Google sign-in:

- Firebase Authentication > Sign-in method: Google is enabled
- Authentication > Settings > Authorized domains includes each deploy domain
- Google OAuth redirect/callback settings match your frontend domain

## USE
### local
- `npm install`
- `$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'`
- `$env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'`
- `npm run db:reset`
- `npm run dev`

### test
- `npm run test:run`
