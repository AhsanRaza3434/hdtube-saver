# HDTube Saver

HDTube Saver is an Angular single-page application backed by an Express API. The API asks RapidAPI for YouTube video details and prepared download files; video downloads are MP4 and audio downloads are M4A.

## Architecture

- `src/`: Angular frontend and routes.
- `server.js`: Express API, RapidAPI integration, conversion progress tracking, and temporary download files.
- `worker.js` and `wrangler.jsonc`: Cloudflare Worker entry point, static asset serving, and `/api/*` proxy to Render.
- `netlify.toml`: production frontend build, SPA fallback, and `/api/*` proxy to Render.
- `render.yaml`: Render web-service configuration.

Conversion jobs and temporary files are kept in the Render process's memory and local filesystem. They can be lost when the service restarts or redeploys; this setup is not a durable job or file store.

## Requirements

- Node.js 20 for the configured builds. The Angular 11 build currently uses the legacy OpenSSL provider on newer Node versions.
- A RapidAPI key for the configured YouTube downloader API.

## Local development

1. Install dependencies with `npm ci` (if the lockfile is current) or `npm install`.
2. Set `RAPIDAPI_KEY` in your shell. The backend intentionally exits if this key is missing.
3. Run the API with `npm start` (defaults to port 10000).
4. In another terminal, run `npx ng serve`; the development environment points to `http://localhost:3000/api`, so set `PORT=3000` for the API when using this setup.

The API's `PORT` can be configured through the environment.

## Build and tests

- `npm run build` builds the production frontend.
- `npm test -- --watch=false --browsers=ChromeHeadless` runs frontend unit tests.
- `npm run lint` runs the configured Angular lint task.

## Deployment

Netlify builds and serves `dist/hdtube-saver`; its `/api/*` rewrite proxies to the Render service. Render runs `node server.js` and must have `RAPIDAPI_KEY` configured as a secret environment variable. Keep that key out of source control and rotate it if it has ever been committed.

For Cloudflare Workers, connect the `cloudflare-frontend` branch, use `/` as the root directory, set the build command to `npm install --legacy-peer-deps && NODE_OPTIONS=--openssl-legacy-provider npm run build`, and keep the deploy command as `npx wrangler deploy`. The Worker serves the Angular build from `dist/hdtube-saver` and proxies `/api/*` to Render; it does not replace the Express API.

The API applies per-process rate limits. For sustained traffic, multiple instances, or reliable downloads, use shared job state and durable object storage rather than the current in-memory map and ephemeral local files.
