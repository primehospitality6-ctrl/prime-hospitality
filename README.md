# Prime Hospitality

Client–server guest hospitality site.

```
Prime Hospitality/
  Client/   # Vite React guest UI (:5173)
  Server/   # Express guest API (:5080)
```

## Run both

```bash
npm run install:all
npm run dev
```

- Site: http://localhost:5173  
- API: http://localhost:5080/api/health  

Vite proxies `/api` → Server in development.

## API (guest)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/units` | List/filter stays |
| GET | `/api/units/:slug` | Stay detail |
| GET | `/api/compounds` | Destinations |
| GET | `/api/content/*` | Meta, FAQs, partners, trust |
| POST | `/api/bookings` | Booking request |
| POST | `/api/inquiries/contact` | Contact form |
| POST | `/api/inquiries/partner` | Partner inquiry |
| POST | `/api/auth/sign-in` | Guest sign-in |
| POST | `/api/auth/sign-up` | Guest sign-up |

Inventory is mock data on the server for now. Wire `PMS_API_URL` / `PMS_API_KEY` later.
