# Scenic

A full-stack MERN image-sharing app: register an account, upload your favourite scenes, and
browse what the community has shared.

**Live:** https://scenic-app.vercel.app
**API:** https://scenic-api.vercel.app

## Stack

- React (`ScenicFront/`) — CRA client
- Node.js / Express (`ScenicBack/`) — REST API with JWT auth
- MongoDB Atlas — images stored base64-in-document (serverless-safe uploads)
- Location geocoding with keyless fallbacks (Nominatim → Photon, Google when keyed)
- Both deployed serverless on Vercel, with edge caching on read endpoints

## Local development

```bash
# API
cd ScenicBack && npm install
DB_URL=<mongodb-connection-string> JWT_KEY=<secret> npm start

# Client
cd ScenicFront && npm install
REACT_APP_BACKEND_URL=http://localhost:5000/api npm start
```

Without `DB_URL` the API serves a read-only demo dataset.
