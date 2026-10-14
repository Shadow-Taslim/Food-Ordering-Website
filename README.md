# Food Ordering Website

A dynamic, single-merchant food ordering and delivery web application built with the **MERN stack** (MongoDB, Express, React, Node.js). Customers browse the menu, manage a persistent cart, and pay by card through **Stripe**; restaurant staff manage the menu and the order pipeline from a separate **Admin Panel**.

- **Repository:** https://github.com/Shadow-Taslim/Food-Ordering-Website
- **Author:** Taslim Mohammed (ID 232-115-110) — CSE 300 Project, Metropolitan University

![System Architecture](docs/architecture.png)

## Features

- User registration & login with **JWT** sessions and **bcrypt** password hashing
- Role-based access control (`user` vs `admin`) enforced server-side
- Menu browsing with category filtering (32 seeded dishes)
- Persistent server-side shopping cart
- **Stripe PaymentIntent** checkout (card form via Stripe Elements)
- **Stripe webhook** (`POST /api/order/webhook`, signature-verified) that marks orders paid
- Admin: add/delete menu items with image upload (**Multer**), list orders, update delivery status
- Automated end-to-end **smoke test** (in-memory MongoDB, signed webhook replay)
- **Docker Compose** deployment (mongo + backend + frontend + admin)

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, Vite, React Router, Axios, react-toastify | Customer app & admin panel |
| Backend | Node.js, Express | REST API server |
| Database | MongoDB, Mongoose | users / foods / orders collections |
| Auth | JSON Web Tokens, bcrypt | Sessions + password hashing |
| Payments | Stripe (PaymentIntent + Webhooks) | Card payments |
| Uploads | Multer | Menu item images |
| DevOps | Docker, docker-compose | One-command deployment |
| Testing | mongodb-memory-server, Stripe test header | `npm test` smoke suite |

## Project Structure

```
├── frontend/     # Customer-facing React app (Vite, port 5173)
├── admin/        # Admin dashboard React app (Vite, port 5174)
├── backend/      # Express API + Mongoose models (port 4000)
│   ├── controllers/  routes/  models/  middleware/  config/
│   ├── scripts/seed.js         # seed the 32-item menu
│   ├── scripts/smoke-test.js   # end-to-end API test suite
│   └── uploads/                # Multer image storage
├── docs/         # architecture diagram + screenshots
└── docker-compose.yml
```

## Run Locally

Prerequisites: Node.js 18+, MongoDB (local or Atlas).

```bash
git clone https://github.com/Shadow-Taslim/Food-Ordering-Website
cd Food-Ordering-Website

# Backend
cd backend
npm install
cp .env.example .env        # fill in MONGO_URL, JWT_SECRET, STRIPE keys
npm run seed                # optional: load the 32-item demo menu
npm run server              # http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env        # VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
npm run dev                 # http://localhost:5173

# Admin panel (new terminal)
cd admin
npm install
npm run dev                 # http://localhost:5174
```

### Environment variables

| File | Variable | Description |
|---|---|---|
| `backend/.env` | `MONGO_URL` | MongoDB connection string |
| `backend/.env` | `JWT_SECRET` | Secret for signing JWTs |
| `backend/.env` | `SALT` | bcrypt salt rounds (e.g. `10`) |
| `backend/.env` | `STRIPE_SECRET_KEY` | Stripe **test** secret key (`sk_test_...`) |
| `backend/.env` | `STRIPE_WEBHOOK_SECRET` | Signing secret from `stripe listen` or the Dashboard |
| `frontend/.env` | `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe **test** publishable key (`pk_test_...`) |

## Stripe Payment Flow

1. Customer submits delivery details → `POST /api/order/place` saves the order and creates a **PaymentIntent** server-side (`metadata.orderId` links them), returning the `clientSecret`.
2. The frontend mounts Stripe **PaymentElement** with that secret; `confirmPayment()` processes the card and redirects to `/verify`.
3. Stripe calls **`POST /api/order/webhook`** (mounted with `express.raw()` **before** `express.json()` so HMAC signature verification works). On `payment_intent.succeeded` the order's `payment` flag is set to `true`; on `payment_intent.payment_failed` the status becomes `Payment Failed`. Every event is logged.
4. `/api/order/verify` re-confirms with Stripe as a client-side fallback.

### Test the webhook locally (Stripe CLI)

```bash
stripe login
stripe listen --forward-to localhost:4000/api/order/webhook
# copy the printed whsec_... into backend/.env as STRIPE_WEBHOOK_SECRET

# then place an order in the UI with test card 4242 4242 4242 4242,
# or trigger a synthetic event:
stripe trigger payment_intent.succeeded
```

Expected server log:

```
[Stripe webhook] received event: payment_intent.succeeded
[Stripe webhook] payment_intent.succeeded pi_... -> order ... marked PAID
```

## Testing

```bash
cd backend
npm test
```

Boots an in-memory MongoDB and exercises the full MVP over HTTP (13 checks): register/login, bcrypt storage, JWT guards, food list, cart persistence, graceful failure without a Stripe key, **signature-verified webhook replay that marks an order paid**, webhook rejection of bad signatures, admin role restrictions, and order history.

## Deployment (Docker)

```bash
docker compose up --build
```

Starts four services: MongoDB (`:27017`), backend API (`:4000`), customer frontend (`:5173`), admin panel (`:5174`). Pass Stripe keys via the shell environment or a root `.env` file (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`, `JWT_SECRET`). Menu images persist in the `uploads-data` volume; database data in `mongo-data`.

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/user/register` | — | Register (bcrypt-hashed password) |
| POST | `/api/user/login` | — | Login, returns JWT + role |
| GET | `/api/food/list` | — | List all menu items |
| POST | `/api/food/add` | admin | Add item (Multer image upload) |
| POST | `/api/food/remove` | admin | Delete item |
| POST | `/api/cart/add` `/remove` `/get` | user | Persistent cart |
| POST | `/api/order/place` | user | Create order + Stripe PaymentIntent |
| POST | `/api/order/webhook` | Stripe | Signature-verified payment events |
| POST | `/api/order/verify` | — | Client-side payment confirmation fallback |
| POST | `/api/order/userorders` | user | Order history |
| GET | `/api/order/list` | admin | All orders |
| POST | `/api/order/status` | admin | Update delivery status |

## Screenshots

| Customer app | Admin panel |
|---|---|
| ![Home](docs/screenshots/01-home.png) | ![Menu management](docs/screenshots/08-admin-list.png) |
| ![Cart](docs/screenshots/04-cart.png) | ![Order pipeline](docs/screenshots/09-admin-orders.png) |
| ![Checkout](docs/screenshots/05-checkout.png) | ![My orders](docs/screenshots/10-my-orders.png) |
