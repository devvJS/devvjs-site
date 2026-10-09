# devvjs.dev

Personal portfolio of **Dakota Coppage** — Software Engineer II at JPMorgan Chase, building production web applications, internal tools, and developer-facing CLIs. Off-hours: indie projects across web, mobile, and CLI tooling.

Live at **[devvjs.dev](https://www.devvjs.dev)**.

```
$ whoami
→ full-stack developer · AI engineer · problem solver · ui tinkerer · systems thinker
```

## Running on Railway

One Node server (`server.js`, Node 22+) serves the built UI from `dist/`, runs `api/*.js` behind a
10-minute in-memory cache, and proxies `/job-tracker` and `/job-tracker/*` to the tracker service.

```sh
npm ci
npm run build   # produces dist/
npm start       # node server.js
```

Environment:

- `PORT`: the port to listen on (Railway sets it; default `3000`).
- `GITHUB_TOKEN`: GitHub token used by `/api/github-stats` (required there) and `/api/projects`.
- `TRACKER_URL`: origin of the job tracker service (default
  `http://job-tracker.railway.internal:8080`).

`GET /healthz` returns `{"ok":true}` for Railway's health check. `npm test` runs the server tests.

Paths outside the site's routes (`src/routes.js`: `/`, `/resume`, `/terminal-chaos`, each with or
without a trailing slash) get `index.html` with a real `404` status, and the app shows its 404 page.
Missing files (a dot in the last segment) still get `404 {"error":"not_found"}`.

The proxy sets `X-Forwarded-For`, `-Proto` and `-Host`, appending to any values that came in, and
`X-Forwarded-Host` is the incoming `Host`. Only the entries added by the hops in front of the
tracker are real (this server's entry is the last one); everything earlier is whatever the client
sent. The tracker must never trust X-Forwarded-* beyond the hops it actually sits behind. Leave
Express `trust proxy` off, or set it to the exact hop count, and don't key rate limits or audit
records on earlier entries. Upstream requests time out after 30 s without response headers
(504 `{"error":"tracker_timeout"}`).

## License

This repository is source-visible but **not open source**. All rights reserved. See [LICENSE](./LICENSE).
