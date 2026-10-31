# Optional Node.js backend

Node 22+ is sufficient; this service uses built-in modules and native fetch. Copy `.env.example` to `.env`, set `TALK2_ACCESS_TOKEN` to a long random value, set `OPENAI_API_KEY`, and select `OPENAI_MODEL` available in your account. From repository root, run `npm run server`.

| Route | Behavior |
|---|---|
| `GET /health` | Service health and whether GPT is configured; no secrets |
| `GET /api/models` | JSON file selected by server-side `MODEL_MANIFEST_PATH` |
| `POST /api/assist` | Bearer-token authenticated text assistance |

Request body: `{"text":"your question"}`. Response: `{"text":"answer"}`. Error responses use `{"error":"message"}` and an appropriate HTTP status. The service caps prompts at 2000 characters, request bodies at 12000 bytes, requests at ten per source IP per minute, and upstream requests at 35 seconds. It requests `store:false` from OpenAI. No phone GPS, radio messages or voice recordings are automatically submitted.

Bind to loopback behind an HTTPS reverse proxy for production. Docker binds to all interfaces intentionally for container ingress; expose it through HTTPS. Configure a trusted reverse proxy and production user authentication if deploying for multiple users. The simple shared bearer token is suited to a controlled prototype/team deployment; it is not a full account system. Rate limits use the direct socket IP and will aggregate users behind a reverse proxy; do not blindly trust client-supplied forwarding headers.

In Talk2 Settings enter `https://YOUR_SERVER`, then open Ask GPT and enter the server access token. The access token is kept in the current app UI state; the OpenAI API key belongs only on the Node server. This service is not needed to pair phones or run downloaded speech models.

The optional `/api/models` route can serve a generated manifest, but binary files still use the HTTPS URLs contained in that manifest. This package does not proxy GitHub/Drive model binaries.
