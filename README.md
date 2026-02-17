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
