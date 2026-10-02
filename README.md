# DZ Product Intelligence — Real Analysis V1

This version adds a Vercel Function at `/api/analyze` that calls the OpenAI Responses API with web search.

## Required Vercel environment variable
`OPENAI_API_KEY`

Never put the key inside `index.html` or client-side JavaScript.

After deploying, add the variable in:
Project → Settings → Environment Variables

Then redeploy.

The analysis is evidence-first: it does not invent prices when sources are missing. Algerian market prices should include source URL and observation date.
real v1
GitHub deployment test - Real V1
