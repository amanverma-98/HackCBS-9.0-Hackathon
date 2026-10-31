# Talk2 backend

Accounts API for Talk2: signup, login, logout and role-based volunteer onboarding.
Node.js, Express, MongoDB (Mongoose), bcrypt password hashing and JWT auth. No OTP.

## Run

```sh
cd backend
npm install
cp .env.example .env      # then set JWT_SECRET and MONGODB_URI
npm run dev               # nodemon, restarts on changes
npm start                 # production
npm test                  # API tests against an in-memory MongoDB
```

Tokens last `JWT_EXPIRES_IN` (default `3650d`, about ten years) so volunteers stay
signed in. `POST /api/auth/logout` revokes that one token on the server.

## Roles

`citizen` (default), `volunteer`, `medical_support`, `emergency_staff`, matching
the app's onboarding. Roles are self-declared at signup.

## API

Send `Authorization: Bearer <token>` where marked.

| Method | Path | Auth | Body / query |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | | `{ name, email, password, role? }` → `{ token, user }` |
| POST | `/api/auth/login` | | `{ email, password }` → `{ token, user }` |
| POST | `/api/auth/logout` | Bearer | revokes the token |
| GET | `/api/auth/me` | Bearer | → `{ user }` |
| POST | `/api/volunteers/onboarding` | volunteer, medical_support, emergency_staff | `{ phone, city, skills[], languages[], availability }` |
| GET | `/api/volunteers?city=&skill=` | emergency_staff | onboarded responders |
| GET | `/api/health` | | `{ ok: true }` |

`availability` is one of `anytime`, `weekdays`, `weekends`, `on_call`. Errors are
returned as `{ error: "message" }` with a matching HTTP status.
