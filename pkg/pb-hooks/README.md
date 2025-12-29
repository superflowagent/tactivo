Credit plugin for PocketBase

What it does
- Registers server endpoints:
  - POST /api/events -> create event (deduct credits for class attendees)
  - PUT /api/events/:id -> update event (applies credit diffs)
  - DELETE /api/events/:id -> delete event (refunds credits)
  - POST /api/events/:id/sign -> sign a client into a class (supports force by professional)
  - POST /api/events/:id/unsign -> remove a client from class

Notes & TODOs
- Authentication: the helper `getUserFromToken` is a placeholder and must be implemented
  using your PocketBase version's proper API to resolve the session token -> user record.
- Time validation (class_block_mins / class_unenroll_mins) is left minimal in the plugin; 
  you can add precise time checks using the `company` record values if desired.
- Idempotency/concurrency: intentionally not implemented per current requirements.
- Deployment:
  - Build a pocketbase binary including this package, or compile on a machine and upload the
    resulting binary to the server. Example build steps (linux amd64):
      GOOS=linux GOARCH=amd64 go build -o pocketbase-custom ./cmd/pocketbase
  - Replace the running pocketbase binary (backup first) and restart the service.

Security
- Endpoints check the caller's role and only allow professional/admin to use forced sign.
- All endpoint handlers must validate the authenticated user; implement `getUserFromToken` accordingly.

Testing
- After deploy run smoke tests: client sign/unsign, professional forced sign, event create/update/delete
  and check `users.class_credits` are adjusted as expected.