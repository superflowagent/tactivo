pb-credit-worker

A small worker that manages sign/unsign/create/update/delete for events and adjusts users.class_credits.

Environment variables (required):
- PB_BASE_URL
- PB_SERVICE_EMAIL
- PB_SERVICE_PASSWORD
- PORT (optional, default 4001)

Build:
- docker build -t pb-credit-worker:latest .

Run (example):
- docker run -e PB_BASE_URL=... -e PB_SERVICE_EMAIL=... -e PB_SERVICE_PASSWORD=... -p 4001:4001 pb-credit-worker:latest

Health endpoint: GET /health

API endpoints:
- POST /api/events/:id/sign
- POST /api/events/:id/unsign
- POST /api/events
- PUT /api/events/:id
- DELETE /api/events/:id

All endpoints expect the client to forward the caller's session token via Authorization: Bearer <token>
and include callerId in the request body.
