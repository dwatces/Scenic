# Scenic

A full-stack MERN image-sharing app: create an account, post photos of places you love with their location, and browse what other members have shared.

- **Live app:** https://scenic-app.vercel.app
- **API:** https://scenic-api.vercel.app

![Scenic landing page: a misty forest valley behind the headline "What should I do with my landscape scenes" and a Sign up button](docs/screenshot.webp)

Scenic was first built in November 2021 as a learning project and reworked in June 2026 to run serverless on Vercel, with a demo mode, keyless geocoding and an OpenStreetMap viewer.

## Features

- **Accounts:** sign up with a name, email and password (6 or more characters); a profile photo is optional, and members without one are shown by their initial. Passwords are hashed with bcrypt and logins return a JSON Web Token that expires after one hour. The client keeps the session in `localStorage`. When a session ends (the token expires, or the API stops accepting it), the member is sent to log in with a note saying why, and comes back to the page they were on.
- **Browse:** the landing page shows the six newest scenes, Explore lists every member's scenes twelve at a time ("Load more scenes"), Members lists everyone, and each member has a page of their scenes.
- **Scene pages:** every scene has its own shareable page with the photo, the place, who posted it and when, and an OpenStreetMap embed with a link to the full map.
- **Posting:** signed-in members add a scene with a title, description, location and a JPEG, PNG or WebP photo. The browser prepares the photo before it is uploaded (see "How images are stored and served" below), so a large phone photo just works.
- **Edit and delete:** owners can edit a scene's title and description or delete it (after a confirmation that names the scene). The API checks ownership before any change.
- **Maps:** the location you type is turned into coordinates (Google Geocoding API when `GOOGLE_API_KEY` is set, otherwise Nominatim with Photon as a fallback).
- **Demo mode:** if no database is configured or it cannot be reached, read requests are answered from a built-in set of two demo members and three New Zealand scenes, through the same serialisers as database responses, and write requests return a 503 with an explanation.
- **Demo content is labelled:** sample accounts and scenes (in demo mode, and when seeded into a database) carry `isDemo: true`, show "Demo account" or "Demo scene" in the app, and use placeholder images that say "Demo image" on them. Lists that contain them say so in one line.
- **Edge caching:** GET responses send `Cache-Control: s-maxage=1, stale-while-revalidate=599`, so the CDN can answer reads from cache while it refreshes in the background, which hides serverless cold starts.

## Tech stack

- **Client (`ScenicFront/`):** React 19, React Router 7, Vite 8
- **API (`ScenicBack/`):** Node.js 24, Express 5, Mongoose 9, multer, express-validator, bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit
- **Tests:** Vitest, supertest and an in-memory MongoDB replica set (API); Vitest and Testing Library (client)
- **Database:** MongoDB (MongoDB Atlas in the live deployment)
- **Hosting:** both apps on Vercel; the API runs as a serverless function through `api/index.js` and the rewrite in `vercel.json`

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | | Health check: `mode` is `"db"` when MongoDB is connected, `"demo"` otherwise |
| GET | `/api/scenes` | | The feed, newest first: `?limit=` (1 to 24, default 12), `?before=<sceneId>` (the `nextCursor` of the previous page), `?creator=<userId>`. Returns `{ scenes, nextCursor }` |
| GET | `/api/scenes/:sceneId` | | One scene with its creator |
| GET | `/api/scenes/:sceneId/image` | | The scene's photo as an image |
| GET | `/api/users` | | Every member, by name |
| GET | `/api/users/:userId` | | One member's public profile |
| GET | `/api/users/:userId/image` | | The member's avatar as an image (404 when they have none) |
| POST | `/api/users/signup` | | Create an account (multipart: `name`, `email`, `password`, optional `image`) |
| POST | `/api/users/login` | | Log in with `email` and `password`, returns `userId` and `token` |
| POST | `/api/scenes` | Bearer token | Create a scene (multipart: `title`, `description`, `address`, `image`); returns the new scene |
| PATCH | `/api/scenes/:sceneId` | Bearer token | Update `title` and `description` (owner only); returns the scene |
| DELETE | `/api/scenes/:sceneId` | Bearer token | Delete a scene (owner only) |
| GET | `/api/users/users` | | Deprecated: members with inline avatars, kept for the deployed client |
| GET | `/api/scenes/user/:userId` | | Deprecated: a member's scenes with inline images, kept for the deployed client |

Scenes and members in responses never include an email address, a password hash or image bytes: images are referenced by `imageUrl` and `avatarUrl`, paths on the API such as `/api/scenes/<id>/image?v=<version>`. Errors are JSON with a `message`.

### How images are stored and served

- **Stored** as base64 inside the scene or user document in MongoDB, so an upload never touches the server's filesystem (Vercel's is read-only) and there is no separate file store to run.
- **Served** as real images from `/api/scenes/:id/image` and `/api/users/:id/image`, never inline in JSON. A list of scenes is a few kilobytes, and browsers can lazy-load, size and cache each photo. The type comes from the stored bytes (JPEG, PNG or WebP; anything else is not served), with a strong ETag, a year of browser caching (the URL carries a version) and a day at the CDN, so a deleted photo stops being served from the edge within a day.
- **Prepared in the browser** before upload: checked (JPEG, PNG or WebP), turned upright, scaled to at most 1600 px on the long edge and re-encoded as WebP (JPEG where the browser can't encode WebP), aiming for 600 KB. The API still caps uploads at 3 MB and checks the bytes.
- **No hidden location data:** every photo is re-encoded, even a small one, which drops its EXIF metadata, GPS position included. Where a scene is comes only from the Location the member types.

## Running it locally

### Environment variables

API (`ScenicBack/.env`, see `ScenicBack/.env.example`):

- `DB_URL`: MongoDB connection string. Without it the API runs in read-only demo mode.
- `JWT_KEY`: secret used to sign and verify tokens. Needed for sign-up, login and any write.
- `GOOGLE_API_KEY`: optional. When set, Google geocodes addresses; otherwise Nominatim and Photon are used. Leave it empty (as in `.env.example`) unless you have a real key.
- `PORT`: optional, defaults to `5000`.
- `CORS_ORIGIN`: optional comma-separated list of browser origins allowed to call the API. Unset allows any origin.
- `SEED_PASSWORD`: optional, only read by the seeding script below.

Sign-up and login are rate-limited to 10 attempts per IP address every 15 minutes. On Vercel each running instance keeps its own count, so the limit slows guessing rather than capping it exactly.

Client (`ScenicFront/.env.local`, see `ScenicFront/.env.example`):

- `REACT_APP_BACKEND_URL`: the API base URL including `/api`, for example `http://localhost:5000/api`. The name is kept from the Create React App days so existing deployments keep working. When it is unset, production builds use `https://scenic-api.vercel.app/api` and `npm run dev` uses `http://localhost:5000/api`.

### Database note

Creating and deleting scenes uses MongoDB transactions, which need a replica set. MongoDB Atlas works as is. A plain standalone local `mongod` will serve reads, sign-up, login and scene edits, but scene create and delete will fail unless it runs as a replica set.

### Start the API

```bash
cd ScenicBack
npm install
cp .env.example .env   # fill in DB_URL and JWT_KEY
npm start              # http://localhost:5000
```

To copy the demo users and scenes into a real database, run the seeding script from `ScenicBack`. It does not read `.env`, so pass the variables in the shell:

```bash
DB_URL=<connection-string> node util/seedAtlas.js
```

It skips users and scenes that already exist. If `SEED_PASSWORD` is not set, it generates a password for the seeded users and prints it.

### Start the client

```bash
cd ScenicFront
npm install
npm run dev       # http://localhost:5173, talks to http://localhost:5000/api
npm run build     # production build in build/ (hashed assets in build/static/)
npm run preview   # serve that build locally
```

### Tests

```bash
cd ScenicBack && npm test    # API: Vitest + supertest against an in-memory MongoDB replica set
cd ScenicFront && npm test   # client: Vitest + Testing Library
cd ScenicFront && npm run test:e2e   # end to end: Playwright against a local API and a production build
```

The end-to-end run starts its own API from `ScenicBack` (run `npm ci` there first) on an in-memory database seeded with the demo content, builds the client, serves it with `vite preview`, and blocks every request to a host other than this machine. Locally it uses the installed Google Chrome; in CI it uses the browser from `npx playwright install chromium`. Ports default to 7104 (client), 7105 (API) and 7108 (MongoDB) and can be changed with `PW_PREVIEW_PORT`, `PW_API_PORT` and `PW_DB_PORT`.

The API tests start MongoDB 8.2.6 through `mongodb-memory-server-core` on port 7107 and never reach the network: a guard fails any request to a host other than this machine. The first run downloads the MongoDB binary once if it isn't cached (set `MONGOMS_RUNTIME_DOWNLOAD=true`).

## Project structure

```
ScenicBack/
  app.js            createApp(): security headers, CORS, rate limits, cache headers, demo-mode gate, routes, errors
  api/index.js      Vercel serverless entry point
  Routes/           users, scenes and demo-mode routers
  controllers/      request handlers
  models/           Mongoose User and Scene schemas, HttpError
  middleware/       JWT check, MongoDB connection, uploads, validation, error responses
  util/             serialisers, image type detection and serving, email rules, geocoding, demo data, seeding script
  assets/demo/      the labelled demo placeholder images (drawn by scripts/make-demo-images.py)
  test/             API tests (Vitest + supertest + in-memory MongoDB)
ScenicFront/
  index.html        Vite entry
  vercel.json       build settings, SPA rewrite and asset caching for Vercel
  src/config.js     API base URL
  src/landing_page/ landing page: rotating hero images and the newest scenes
  src/user/         sign-up, login and the members list
  src/scenes/       Explore, scene page, member pages, add and edit forms, the feed hook
  src/shared/       HTTP client, route guards, form elements, modals, map, avatar, auth context and hooks
  e2e/              Playwright tests against a local API and an in-memory database
```

## Author

Built by Daniel Olliver. More of my work: [danielolliver.com/dev](https://danielolliver.com/dev/).

I also run [Olliver Web](https://olliverweb.co.nz), a web design and development studio in Auckland.
