# CafeFlow

A full-stack, single-cafe operations application built directly in this folder. The cafe brand in the seed data is **The Daily Grind**. All orders, payments, customers, stock changes, and settings are backed by MongoDB; localStorage is not used as a substitute for the backend.

## Start the local demo

Requirements: Node.js **22.12 or newer**, npm, and internet access for the first dependency/MongoDB binary download. Google Chrome is used by the optional browser verification script.

```sh
npm install
node scripts/setup-env.js
npm run demo
```

Open **http://localhost:5173**. `setup-env.js` creates `.env` with a randomly generated JWT secret and seed password; it preserves an existing `.env`.

| Role    | Email                    | Password                  |
| ------- | ------------------------ | ------------------------- |
| Owner   | `owner@cafeflow.local`   | `SEED_PASSWORD` in `.env` |
| Manager | `manager@cafeflow.local` | Same seeded password      |
| Cashier | `cashier@cafeflow.local` | Same seeded password      |
| Kitchen | `kitchen@cafeflow.local` | Same seeded password      |

The demo command runs a **real MongoDB 7 replica set**, Express on port 4000, and Vite on port 5173. Data persists under `.data/mongo`; seeding happens only when there are no user accounts. Stop with Ctrl+C. This local database binds to loopback and is intended for development. Use your own MongoDB deployment for production. Changing `SEED_PASSWORD` after the first seed does not change existing account passwords; an owner can change them in Staff.

## Use your own MongoDB

Transactions require a replica set. MongoDB Atlas works, or use the included local Docker Compose service:

```sh
docker compose up -d
node scripts/setup-env.js
```

Set `MONGODB_URI` in `.env`, then:

```sh
npm run seed
npm run dev
```

The seed command refuses to seed a database that already contains users. It creates four staff accounts, seven categories, eleven products, eight tables, ingredients, recipes, customers, an offer, expenses, and paid/open orders. It never deletes existing data.

Separate terminals can run the two application processes:

```sh
npm run dev:server
npm run dev:client
```

`npm run demo` is an alternative to these commands, not an additional process to run alongside them.

## Environment variables

See `.env.example`. Actual credentials belong in the ignored `.env` file.

| Variable              | Purpose                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `MONGODB_URI`         | MongoDB connection string with replica set support; demo sets its own process-local URI |
| `JWT_SECRET`          | Random secret of at least 32 characters; required to start Express                      |
| `PORT`                | Express port, default 4000                                                              |
| `FRONTEND_URL`        | Exact trusted browser origin, default `http://localhost:5173`                           |
| `VITE_API_URL`        | Client API base URL, default `/api`; Vite proxies this to Express                       |
| `NODE_ENV`            | `development` locally; `production` enables Secure cookies                              |
| `SEED_PASSWORD`       | Password of at least 10 characters, used only when creating seed accounts               |
| `RESET_EMAIL_WEBHOOK` | Optional HTTPS endpoint for delivering password reset email                             |
| `RESET_EMAIL_TOKEN`   | Optional bearer token for the email webhook                                             |
| `PLAYWRIGHT_CHANNEL`  | Browser channel for the browser-check script, default `chrome`                          |

Password-reset webhook requests contain `{ "email": "...", "resetUrl": "..." }`. Reset links are single-use and expire after 30 minutes. Without an email webhook, Forgot Password explains that the owner must reset the password through Staff. Reset tokens are hashed in the database and never returned by the API.

For a phone on the same Wi-Fi, set `FRONTEND_URL` to your computer’s LAN origin, for example `http://192.168.0.101:5173`, restart, and open that same origin on the admin computer before generating QR codes. The phone must be able to reach the Vite port. A QR containing `localhost` only works on the computer that generated it. Use HTTPS and a stable public hostname for real customers.

## What works

- Cookie-based JWT login, logout, password-reset flow, hashed passwords, role-protected routes and APIs, active/disabled staff accounts, and session invalidation on password/role changes.
- Responsive sidebar, page search, cafe profile menu, live order notifications, low-stock notifications, loading/error states, and confirmation dialogs.
- Product/category CRUD; prices, tax rates, images by URL, SKUs, preparation time, dietary marker, availability, sizes, add-ons, and modifiers.
- Table CRUD and available/occupied/reserved/cleaning states, active order reference, QR preview, PNG download, and printing.
- POS with item customization, quantity changes, notes, dine-in/takeaway/delivery, customer attachment, discounts, loyalty redemption, held orders, and duplicate-submission protection.
- Cash, UPI, card, and split **payment recording**, with an optional transaction reference.
- Central order detail/status management, cancellation of unpaid orders, and browser-printable 58 mm / 80 mm receipts and kitchen tickets.
- KDS with new/accepted/preparing/ready columns, elapsed times, overdue highlighting, quantities, notes, and live updates.
- Separate mobile guest menu, table QR ordering, customization, cart, order confirmation, and private-token order tracking.
- Ingredient inventory, positive/negative adjustments, wastage reasons, history, thresholds, low-stock filters, and recipe cost/margin calculation.
- Customer history, total spend/order counts, earned/redeemed/current loyalty points, staff CRUD/disable, expenses, and dated/validated offers.
- Dashboard date filters, sales and order trends, product/category breakdowns, payment methods, recent orders, stock alerts, and CSV reports.
- Cafe profile, business, order, receipt, QR, and loyalty settings.

## Important behavior

### Permissions

| Role    | Access                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Owner   | Everything, including staff and settings                                                                |
| Manager | Dashboard, POS, orders, kitchen, menu, tables, inventory, recipes, customers, expenses, offers, reports |
| Cashier | POS, orders, customer records, payment recording                                                        |
| Kitchen | Kitchen only; accept, start preparing, and mark ready                                                   |

Only owners/managers can apply an arbitrary manual discount. Cashiers can apply validated promo codes. Product-specific offers provide item-level discounts. Staff records and authentication accounts share the User collection; variants, add-ons, and order items are embedded snapshots/subdocuments rather than separately fetched UI records.

### Order, inventory, and loyalty lifecycle

1. Prices, variants, add-ons, tax, and discounts are recalculated on the server. Client totals are not trusted.
2. Creating an order assigns a transactionally incremented order number, occupies its table, records the recipe snapshot, and reserves redeemed loyalty points.
3. Kitchen status follows `new → accepted → preparing → ready → served → completed`. Unpaid orders can be cancelled with a reason. Cancelled redemptions return the customer’s points.
4. Recording payment atomically inserts payment records, deducts the recipe ingredients, and updates customer totals/earned points. Insufficient stock rolls back the entire payment unless negative stock is explicitly enabled.
5. Payment retries cannot charge inventory twice. Completion requires payment. A table goes to cleaning only after its last active order ends; staff can mark it available in Tables.

Payment is allowed before or after kitchen preparation. Paying a POS order does not skip the kitchen workflow. Reports recognize recorded payments, including paid orders still being prepared. Product/category revenue is the gross item subtotal; the main sales figure includes tax and service charge after discounts. Profit estimates exclude tax and subtract recorded ingredient cost plus expenses. Avoid double-counting ingredient purchases as both expenses and consumed recipe cost.

Ingredient quantities use the units stored on the inventory item. A recipe using an ingredient stored in grams must specify grams. A large size or add-on changes price but currently uses the same base product recipe; see limitations below.

### Live updates

Socket.IO broadcasts refresh events to authenticated staff and status updates to a guest’s unguessable tracking-token room. Orders/KDS and tracking also poll as a reconnect fallback. The notification center retains event notifications for the current browser session and loads current low-stock alerts from MongoDB.

### Printing

Receipts are available after recorded payment. Kitchen tickets can be printed immediately. The app opens the browser print dialog using an isolated print document. Choose the appropriate 58/80 mm paper size and disable browser headers/footers in the printer dialog. Direct USB/network ESC/POS printing is not configured.

## Folder structure

```text
CafeFlow/
  public/menu-art/ # original bundled food and drink illustrations
  src/
    components/   # reusable controls, dialogs, forms, products, tickets, payments
    constants/    # management module field definitions
    hooks/        # API loading, refresh and pagination hooks
    layouts/      # protected admin shell
    pages/        # auth, POS, KDS/orders, guest menu, dashboard, management, settings
    services/     # Axios client and error handling
    store/        # Redux authentication and cart state
    utils/        # formatting, CSV, browser printing and IDs
  server/
    config/       # MongoDB connection
    controllers/  # authentication
    middleware/   # JWT verification and role authorization
    models/       # Mongoose models and embedded schemas
    routes/       # validated CRUD, settings, stock and held orders
    services/     # transactional orders/payments and reports
    utils/        # validation schemas and errors
    app.js        # Express API and production static routing
    index.js      # HTTP/Socket.IO server
    seed.js       # non-destructive initial demo seed
  tests/          # integration tests against an isolated MongoDB replica set
  scripts/        # environment setup, persistent local demo and browser checks
  docker-compose.yml
  .env.example
```

## API

JSON responses use `{ data, meta? }` and `{ error }`. List APIs accept `page`, `limit`, and `search`; product lists also accept `category`, inventory accepts `low=true`, and orders accept `status` or `active=true`. Public requests and login/reset requests are rate-limited.

| Endpoint                                                  | Main operations                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `/api/auth`                                               | `login`, `logout`, `me`, `forgot-password`, `reset-password`        |
| `/api/products`, `/api/categories`, `/api/tables`         | GET, POST, PUT/:id, DELETE/:id                                      |
| `/api/customers`, `/api/inventory`, `/api/recipes`        | GET, POST, PUT/:id, DELETE/:id                                      |
| `/api/staff`, `/api/expenses`, `/api/discounts`           | GET, POST, PUT/:id; expenses/offers also DELETE/:id                 |
| `/api/orders`                                             | GET list/details, POST create/quote, PATCH/:id/status, POST/:id/pay |
| `/api/inventory/:id/adjust`, `/api/inventory/:id/history` | POST adjustment, GET stock ledger                                   |
| `/api/customers/:id/orders`                               | GET customer history                                                |
| `/api/held-orders`                                        | GET, POST, DELETE/:id; scoped to current staff member               |
| `/api/dashboard`, `/api/reports`                          | GET with ISO `from`/`to` date filters                               |
| `/api/settings`                                           | GET; owner-only PUT                                                 |
| `/api/public/menu/:token`                                 | GET table menu; POST `/orders`                                      |
| `/api/public/orders/:token`                               | GET private-token guest tracking                                    |
| `/api/health`                                             | GET process health                                                  |

## Build and verification

```sh
npm run build
npm test
```

The integration suite runs on an isolated temporary MongoDB replica set and does not modify the demo database. It exercises the requested A–F journeys, authorization, invalid status transitions, duplicate submissions, payment totals, concurrent payments/redemptions, stock rollback, and CRUD validation.

With the local demo running and Chrome installed:

```sh
node scripts/browser-check.js
node scripts/forms-check.js
```

These check the real browser UI, perform test orders/payments in the **demo database**, verify responsive screens, printing, guest tracking, management forms, and role restrictions, and write screenshots under `.artifacts/`. The workflow check leaves its test orders in the demo for inspection. Set `PLAYWRIGHT_CHANNEL` if using another installed supported browser.

For production, run `npm run build`, configure a durable MongoDB replica set/Atlas connection, set `NODE_ENV=production` and `FRONTEND_URL` to the HTTPS application origin, then `npm start`. Express serves the compiled frontend and API from one origin. Preserve Socket.IO upgrade forwarding in your reverse proxy, provision database backups, and use individual staff credentials.

## External configuration and current limitations

- Payment recording is implemented. No payment gateway, settlement verification, refunds, or payment webhooks are connected. Paid orders cannot be cancelled in-app; reconcile refunds externally.
- Password reset delivery requires your configured email webhook. No email provider credentials are included.
- The demo includes eleven original, bundled SVG food/drink illustrations in `public/menu-art/`. Products also accept your own hosted image URLs. No upload/storage service is configured.
- This is a single-cafe application; multi-branch tenancy, online delivery dispatch, accounting integrations, and direct printer hardware integration are not implemented.
- Recipes currently track the base product. Size/add-on-specific ingredient recipes and unit conversion are not implemented. Ingredient cost is an estimate captured on the order.
- Reports are calculated in application memory for a single cafe. Very large datasets should migrate to database aggregation and streamed exports. Filters use device-local date boundaries; daily buckets use the configured cafe timezone.
- Table QR tokens permit anyone holding the URL to order at that table. There is no per-seating rotating PIN or customer payment verification.
- Order carts remain in memory until explicitly held on the server. Refreshing a page clears an unheld cart.
- Thermal layouts use the browser print system; final paper margins depend on the printer driver.
