# Misty99

Node.js + Express + MongoDB application prepared for GitHub and Fly.io.

## Local setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MONGO_URI` and a strong `JWT_SECRET` in `.env`.
5. Run `npm start`.
6. Open `http://localhost:8080`.

## Fly.io deployment

Do not upload `.env` or real secrets to GitHub.

Set these Fly secrets:

- `MONGO_URI` = your MongoDB Atlas connection string
- `JWT_SECRET` = a long random secret (32+ characters)

Then deploy with Fly.io using the included `fly.toml` and `Dockerfile`.

## Included files

- `backend/server.js` - API, authentication, MongoDB connection and game endpoint
- `frontend/index.html` - login/dashboard/game UI
- `frontend/register.html` - registration UI
- `frontend/style.css` - styles
- `Dockerfile` - Fly.io container build
- `fly.toml` - Fly.io configuration
- `.env.example` - safe environment variable template
- `.gitignore` - keeps secrets and dependencies out of Git
