# Prime Hospitality — Guest Client

Guest-facing UI. Talks to the Express API in `../Server`.

## Run (from repo root)

```bash
npm run install:all
npm run dev
```

Or client only (API must already be on :5080):

```bash
npm run dev
```

Vite proxies `/api` → `http://localhost:5080`.

