# Quizzy deployment

## 1. Backend — Render (Free)

Create a new Blueprint/Web Service from this repository. `render.yaml` is already configured for the `backend` folder and the free plan.

Set these Render environment variables:

- `GROQ_API_KEY` = your Groq API key
- `FRONTEND_URL` = your final Vercel URL, for example `https://quizzy.vercel.app`
- `GROQ_MODEL` is already set by the blueprint and can be changed if needed.

After deployment, copy the Render backend URL, for example `https://quizzy.onrender.com`.

## 2. Frontend — Vercel (Hobby/Free)

Import the same repository into Vercel. Keep the project root as the repository root and name the project `quizzy` if the name is available.

Add these Vercel environment variables before deploying:

- `NEXT_PUBLIC_API_URL` = your Render URL, e.g. `https://quizzy.onrender.com`
- `NEXT_PUBLIC_WS_URL` = the same Render host using secure WebSockets, e.g. `wss://quizzy.onrender.com`

Deploy, then copy the final Vercel URL and set it as `FRONTEND_URL` in Render. Redeploy/restart the Render service once after setting it.

## 3. Test

Create a new game from the deployed Vercel site and join it from a second device. Test lobby, start, answers, elimination, next question, leaderboard, podium, and AI quiz generation.

## Local development

If the public environment variables are absent, the frontend falls back to `http://127.0.0.1:8000` and `ws://127.0.0.1:8000`, so local development still works.

Never commit a real Groq API key. `backend/.env` is blank in this package and `.env*` is ignored by Git.
