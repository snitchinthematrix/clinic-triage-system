# Deployment (free tier)

1. Create a Supabase project, run `npx supabase db push` to apply migrations from `supabase/migrations/`.
2. Copy the Supabase project URL and anon key into `apps/web/.env` (see `.env.example`).
3. Deploy `apps/web` to Vercel: import the repo, set root directory to `apps/web`, add the env vars from `.env.example` in the Vercel dashboard.
4. Deploy `apps/ai-backend` to Render using `render.yaml`: connect the repo, set root directory to `apps/ai-backend`, add `GEMINI_API_KEY` and `RESEND_API_KEY` as secret env vars in the Render dashboard.
5. Set `VITE_AI_BACKEND_URL` in Vercel to the Render service's public URL.
6. Verify: sign up a patient, submit a triage form, confirm booking, and check the doctor/front-desk views on the deployed URLs.
