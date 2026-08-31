# GwenSick

A minimal, mobile-first AI chatbot built with Next.js, TypeScript, and the OpenAI Responses API.

## Local setup

1. Install Node.js 20+.
2. Install dependencies with `npm install`.
3. Create `.env.local` with:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5-mini
```

4. Start development with `npm run dev`.
5. Open `http://localhost:3000`.

Never commit `.env.local` or an API key. The OpenAI key is used only by the server route.
