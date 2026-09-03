# 06 — Store SDD

> Owner: Merwin S. (B4) · App: `apps/store` · Port 3005 · Neon project `sodales-store`
> (`fragrant-voice-63435569`) · Status: built and visually refreshed 2026-09-03. Implementation contract:
> `docs/patterns/neon-app-setup.md`. Guest-cart decision: D-007.

## 1. Purpose

Sodales Store — a tactile, editorial commerce storefront selling Sodales-branded goods
(art prints, apparel, stationery, home, tech accessories, gifts). Visitors browse a curated
catalog, guests keep a cookie cart, customers check out, and admins manage products and
orders. The MVP captures **order requests only** — no payments (see §14 boundary).

## 2. Goals and non-goals

Goals: flagship-quality browsing and cart experience; honest order-request checkout;
server-enforced authorization; guest cart that survives login (merge); admin CRUD for
products and order fulfilment with a full audit trail.

Non-goals (deferred, need a new SDD): payment capture, refunds, inventory counts,
shipping-rate APIs, taxes, discounts/coupon codes, customer accounts area beyond order
viewing, notifications. Order confirmation UI must not imply that an email has been sent.

## 3. Roles

| Role | Who | How it is granted |
| --- | --- | --- |
| visitor | Anyone not signed in | default |
| customer | Signed-in shopper | `user_profile.role = 'customer'` (self sign-up) |
| admin | Sodales team | `user_profile.role = 'admin'` (seed bootstrap via `ADMIN_EMAIL`) |

Roles live in the app-owned `user_profile` table keyed by the Neon Auth user id (no
cross-schema FK; enforced in code). All checks run server-side.

## 4. Authorization matrix

| Action | visitor | customer | admin |
| --- | --- | --- | --- |
| Browse catalog / product pages | ✅ | ✅ | ✅ |
| Guest cookie cart (add / edit / view) | ✅ | ✅ (migrates to DB cart) | ✅ |
| Checkout (`/checkout`) | ❌ → /login | ✅ | ✅ |
| View order `/order/[orderNumber]` | ❌ | own orders only | all orders |
| Admin area `/admin/**` | ❌ | ❌ | ✅ |
| Create / edit / publish products | ❌ | ❌ | ✅ |
| View all orders + update status | ❌ | ❌ | ✅ (history written) |

Enforcement: middleware guards `/checkout`, `/order/:path*`, `/admin/:path*`,
`/api/auth/:path*` (redirect to `/login`); page-level `requireUser()` / `requireRole("admin")`
re-check server-side; order pages resolve ownership in the query layer (non-owner or
non-admin gets 404 — existence is never leaked); every mutation action re-validates the
session and role. Draft products are excluded from every public query at the SQL level;
unavailable products are rejected by the add-to-cart action server-side.

## 5. Feature list

Storefront: home (split-image editorial hero, indexed category ledger, featured products,
value props), catalog
(`/products`: category filter, text search, sort by newest/price asc/desc/name), product
detail (`/products/[slug]`: disclosed 4:5 concept image, price, availability badge, quantity + add to
cart, related products), cart (`/cart` for guests and users: line items, quantity steppers,
remove, totals, checkout CTA), checkout (`/checkout`: name, email, shipping address, notes →
order request), order confirmation/tracking (`/order/[orderNumber]`: summary, snapshot items,
status timeline), auth (`/login`, `/sign-up`).

Admin: overview dashboard (counts + recent orders), products table (status/availability
badges, DropdownMenu row actions: edit, publish/unpublish, available/unavailable, delete),
product create/edit form (zod-validated), orders table (status badges), order detail with
status-update select writing `order_status_history` rows.

## 6. User flows

1. **Guest browse → order**: browse → add to cart (cookie cart) → review `/cart` →
   "Log in to check out" → sign in (cookie cart merges into DB cart) → `/checkout` →
   submit → order created from cart with snapshot prices → redirect to
   `/order/[orderNumber]` ("Order received — we'll confirm shortly").
2. **Customer reorder**: sign in → cart persists in DB → checkout → order page.
3. **Admin adds a product**: /admin/products → New product → form (name auto-suggests slug,
   price in ₱) → toast → appears in table as Draft → Publish action → visible publicly.
4. **Admin fulfils an order**: /admin/orders → open order → set status
   (pending → confirmed → processing → shipped → delivered, or cancelled) → history row
   recorded → customer sees timeline update.

## 7. Data model

```
user_profile        id, user_id (UNIQUE, neon_auth user), name, role enum(customer|admin), ts
product_category    id, slug UNIQUE, name, description, ts
product             id, slug UNIQUE, name, description, price_cents int, currency 'PHP',
                    is_available bool, category_id → product_category, palette_seed int,
                    status enum(draft|published), ts
product_image       legacy-only: id, product_id → product (cascade), position int,
                    deprecated gradient text, ts; ignored by the storefront
cart                id, user_id uuid UNIQUE (nullable by design; guests never get rows), ts
cart_item           id, cart_id → cart (cascade), product_id → product (cascade),
                    quantity int, UNIQUE (cart_id, product_id)
guest_cart_merge_receipt id, user_id uuid, merge_nonce text, created_at,
                    UNIQUE (user_id, merge_nonce)
order               id, order_number UNIQUE, user_id (neon_auth user),
                    checkout_token uuid nullable, UNIQUE(user_id, checkout_token), status enum(
                    pending|confirmed|processing|shipped|delivered|cancelled),
                    subtotal_cents, shipping_cents, total_cents, customer_name,
                    customer_email, shipping_address, notes, ts
order_item          id, order_id → order (cascade), product_id → product (restrict),
                    product_name, product_slug, category_name, unit_price_cents (snapshots),
                    quantity
order_status_history id, order_id → order (cascade), from_status (nullable),
                    to_status, changed_by_user_id (nullable), created_at
```

UUID PKs, snake_case, `created_at`/`updated_at` on mutable tables, pgEnums for status
vocabularies. Money is always integer centavos. Order lines snapshot `product_name`,
`product_slug`, `category_name`, and `unit_price_cents` at purchase time so later edits
never rewrite commerce history or change the concept image attached to an order line.

`checkout_token` is generated per rendered checkout form and is nullable only so existing
pre-migration orders remain valid. New orders always set it. The per-user unique index is
the database idempotency guard: a retried submission resolves to the original order rather
than consuming the cart twice. Migration `0001_glorious_old_lace.sql` adds the checkout
column/index. Migration `0002_useful_dust.sql` safely backfills immutable order-item
art/category keys, then aligns the Studio Stitch Tee and protected-mark seed copy.
Migration `0003_fair_moon_knight.sql` adds the durable guest-cart merge receipt and its
unique replay key. All three migrations are applied to the linked Neon **dev** branch as
of 2026-09-03 and must be applied to each target branch before that revision receives
traffic.

**Order state machine**: `pending → confirmed → processing → shipped → delivered`;
`pending|confirmed|processing → cancelled`; shipped orders proceed only to delivered.
Transitions are admin-only and every
change appends an `order_status_history` row. Illegal transitions are rejected
(delivered/cancelled are terminal; moving backwards is rejected). The order row is locked
inside a transaction and the update also compares the previously read status; history is
inserted only when that compare-and-set update succeeds.

**Cart strategy (D-007)**: guests keep an http-only cookie `sodales_cart` containing
base64url(JSON `{n:mergeNonce,items:[{p:productId,q:quantity}]}`) + `.` + HMAC-SHA256 signature
(`NEON_AUTH_COOKIE_SECRET`). On every read the signature is verified, quantities are
clamped to 1–99, unknown/deleted/draft products are dropped, and the list is capped at 30
distinct items — the cookie is never trusted. Header count and totals use only current
public IDs. The cart explains stale saved lines and offers one-click cookie cleanup; the
next guest mutation also normalizes them so stale IDs cannot consume the cap. A 31st
distinct product returns an explicit error instead of a false add-to-bag success. Every
cookie rewrite creates a fresh cryptographic merge nonce; valid pre-nonce cookies derive a
stable compatibility nonce from their signed body.
Signed-in users get a DB cart (`cart.user_id` UNIQUE,
created lazily). On sign-in, the transaction first claims `(user_id, merge_nonce)` in
`guest_cart_merge_receipt`, then runs catalogue validation, cart creation, and every
cookie-line upsert with union quantities (capped at 99 per line). Concurrent or retried
requests for the same user and cookie revision observe the committed receipt and skip the
quantity updates. Any failure rolls back both claim and cart changes; the caller preserves
the cookie until a new merge commits or a prior committed receipt is confirmed. Guests see
the full cart page with a "Log in to check out" CTA.

## 8. API surface (server actions + queries)

Queries in `features/catalog/queries.ts`, `features/cart/service.ts`,
`features/orders/queries.ts`; mutations in matching `actions.ts` files ("use server").
Actions: `addToCartAction(productId, quantity)`, `updateCartItemAction(productId, quantity)`
(0 removes), `removeCartItemAction(productId)`, `cleanGuestCartAction()`,
`placeOrderAction(prev, formData)`,
`createProductAction`, `updateProductAction`, `deleteProductAction`,
`setProductStatusAction`, `setProductAvailabilityAction`, `updateOrderStatusAction`,
plus auth `signUpAction` / `signInAction` (with cart merge) / `signOutAction`.
All mutations re-validate input with zod and the session/role server-side.
Checkout additionally locks the user's cart and its current cart-item/product rows,
re-reads availability/status/prices in the transaction, recomputes totals from server
prices, and creates the order/items/initial history plus clears the cart in that same
transaction.

## 9. Routes

| Route | Access | Notes |
| --- | --- | --- |
| `/` | public | hero, category tiles, featured products |
| `/products` | public | `?category=&q=&sort=` searchParams |
| `/products/[slug]` | public | 404 for drafts; related products |
| `/cart` | public | guest cookie cart or user DB cart |
| `/checkout` | signed-in | middleware + `requireUser()` |
| `/order/[orderNumber]` | owner or admin | middleware + ownership query |
| `/login`, `/sign-up` | public | redirect to `/` if already signed in |
| `/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit`, `/admin/orders`, `/admin/orders/[id]` | admin | sidebar layout per patterns doc |
| `/api/auth/[...path]` | public | Neon Auth handler |

Route groups: `(site)` with header/footer, `(auth)` centered card, `(admin)` sidebar.
`loading.tsx` skeletons on every data page; root `error.tsx` + `not-found.tsx`.

## 10. Validation

zod v4 schemas in `lib/validation.ts`, parsed client-side (inline, `aria-describedby`-
linked field errors; submit prevented) and re-parsed in every server action, including
both auth forms. `checkoutSchema`: checkout token UUID, name 2–120, email,
shipping_address 10–600, notes ≤ 500 optional. `productInputSchema`: name 3–140, slug
pattern `^[a-z0-9]+(-[a-z0-9]+)*$`, description 20–2000, price string `₱` decimal
transformed to positive centavos ≤ 10,000,000, category uuid, status/availability enums,
palette_seed 0–11 (legacy compatibility only). Cart quantity clamped 1–99
(0 = remove) at every boundary. Catalogue sort parsing uses an explicit string switch;
prototype keys such as `constructor`, `toString`, and `__proto__` fall back to `newest`.
Admin UUID route parameters and product-row mutation IDs are rejected before any UUID SQL
comparison; malformed detail routes render 404 and malformed actions return typed errors.

## 11. UI and design system

The Store adapts the approved Direction 1 visual system into **tactile editorial commerce**.
Corporate chrome retains Obsidian `#111111`, Soft Ivory `#F4F2ED`, Graphite `#35373B`, and
Electric Violet `#5E4FB3`; the Store adds derived Lavender Paper `#E5E1F5`, Editorial Ink
`#27213D`, and Studio Stone `#D3CFC6`. Violet is reserved for actions, focus, and small
edition signals. Public, auth, and admin shells use the text-only `BrandWordmark` lockup
from `@sodales/ui` with the Store division name.

Typography uses **Newsreader** for headlines, prices, and editorial moments and **Inter**
for navigation, forms, commerce data, and admin UI, both loaded through `next/font`.
Headings are optical-size-aware and tightly composed; operational labels are uppercase,
11px–12px, and widely tracked. Layouts favor rules, square or two-pixel corners, 4:5
product rhythm, indexed rows, and deliberate 4/8 or 5/7 asymmetry. There are no ornamental
drop shadows or generic floating-card grids.

The home and auth surfaces use the locally generated, production-owned
`public/media/store-collection-hero.png`, with meaningful alt text, visible “studio
collection concept / final products may vary” disclosure, and responsive `next/image`
sizing. Each of the 14 seeded products has an original local 4:5 **concept product image**
selected by immutable slug through **ProductArt**. Catalogue/detail art carries a visible
“Sodales concept image · final product may vary” label; compact cart, checkout, and order
thumbnails have the same accessible label plus nearby visible disclosure. Order items
snapshot the slug and category so historical imagery does not drift. Unknown/future slugs
fall back to one of six original category photographs and are explicitly labelled as
representative, never exact product photography. Legacy
`palette_seed` and `product_image.gradient` fields remain only for schema compatibility;
the storefront ignores them and new seeds no longer create gradient rows.

Shared shadcn primitives come from `@sodales/ui` (Button incl. `asChild`, Card, Badge,
Table, Select, DropdownMenu, Dialog, Alert, Skeleton, Separator) and are styled with the
app's Tailwind v4 CSS-first tokens. Semantic order/product status colors remain functional.
The detail page keeps a sticky add-to-cart bar on mobile; cart, checkout, confirmation,
auth, admin, loading, empty, error, and not-found surfaces all share the editorial system.
Money renders as ₱ with thousands separators (`formatMoney`); Sonner provides action
feedback. Reduced-motion preferences disable nonessential transitions and pulse/spin
animation. Every loading boundary exposes `role="status"`, `aria-live="polite"`,
`aria-busy="true"`, and a screen-reader loading message.

## 12. Accessibility

Semantic landmarks (header/nav/main/footer), one h1 per page, labeled inputs (Label+Input,
htmlFor), `aria-label`s on icon-only buttons, visible focus rings from primitives,
keyboard-navigable menus/selects (Radix), `aria-hidden` on decorative art, role="alert"
error summaries, contrast ≥ 4.5:1 for text. Dark-surface ivory text uses at least 60%
opacity and lilac-surface ink uses at least 70%; long product/customer/address content
uses `overflow-wrap:anywhere`. Mobile public navigation keeps Catalogue, Sign in, and the
admin Manage entry discoverable.

## 13. SEO

Metadata template "%s | Sodales Store"; per-page titles/descriptions for catalog and
product pages (`generateMetadata` on `/products/[slug]` with title + description from the
product); noindex on admin/auth/checkout/order pages via robots metadata; clean canonical
slugs; semantic headings and link text. Root Open Graph metadata uses the locally owned
Store collection image (1536 × 1024), not an external dependency.

## 14. Payment boundary

**No payment capture.** There are no card fields, no payment provider calls, no "payment
succeeded" language anywhere. Checkout says "Pay on confirmation — our team will contact
you"; the confirmation page says "Order received — we'll confirm shortly." The order is an
order request awaiting admin confirmation. A separate payment SDD (webhooks, refunds,
failures, taxes, state machine extensions) is required before any provider integration.

## 15. Acceptance criteria

- [x] Schema migrations through `0003_fair_moon_knight.sql` applied on the dev branch;
      seed remains idempotent (safe to re-run)
- [x] Seed creates admin (ADMIN_EMAIL via Neon Auth API with `origin` header), demo
      customer, 6 categories, 14 products (12 published incl. 1 unavailable, 2 drafts),
      1 sample order with items + history for the demo customer
- [ ] Guest can add to cart, edit quantities, and see totals without an account
- [ ] Cookie cart merges into DB cart on sign-in; cookie cleared after merge
- [x] Each signed cookie revision has a stable merge nonce and the transactional unique
      `(user_id, merge_nonce)` receipt prevents concurrent/retried sign-ins from applying
      its quantities twice; legacy signed cookies receive a stable compatibility nonce
- [ ] Checkout requires sign-in; transactionally creates an idempotent order from locked
      cart/product rows with server-price snapshots and clears the cart;
      no payment fields or claims
- [ ] `/order/[orderNumber]` shows summary + status timeline; non-owners get 404
- [ ] Admin can CRUD products, publish/unpublish, mark available/unavailable
- [ ] Draft products never public; unavailable products can't be added to cart
- [ ] Admin can update order status atomically; history rows record only successful legal
      transitions
- [ ] Loading skeletons, designed empty states, error.tsx on all data pages
- [x] Public header/footer, auth, and admin shells use `BrandWordmark` product lockups
- [x] Corporate chrome uses Obsidian, Soft Ivory, Graphite, and Electric Violet; legacy
      sky-blue chrome and shared serif typography are removed
- [x] Display hierarchy uses Newsreader; UI labels use Inter, uppercase, 11px–12px, and
      wide tracking; source-level focus, reflow, long-content, and touch-target fixes are
      implemented
- [x] Restrained, brand-derived colour treatments are confined to product artwork;
      semantic status colors remain functional and the no-payment/order-request boundary
      copy is unchanged
- [x] Disclosed Store concept media is used in public/auth heroes and all 14 seeded SKU
      cards; unknown products use an honest category-image fallback, with no CSS art or
      blurred rainbow placeholders
- [x] Public, product, cart, checkout, order, auth, admin, loading, empty, error, and 404
      surfaces use the same square, rule-led editorial language
- [x] Guest stale IDs are excluded from header/totals, can be cleaned explicitly, and do
      not consume the 30-line cap on the next mutation; cap rejection is truthful
- [ ] Owner browser-confirm responsive/touch/contrast behavior during the chosen manual review
      (source and HTTP review are complete; `apps/store/design-qa.md` records the pending gate)
- [x] `db:generate/migrate/seed`, `db-smoke`, `typecheck`, `lint`, `test`, and `build` all green

## 16. Test plan

- Unit invariants: `pnpm --filter @sodales/store test` covers signed guest-cookie
  round-trip/tamper/clamping/caps, stable nonce reuse and rewrite rotation, deterministic
  compatibility nonces for legacy cookies, stale-catalog filtering and distinct-line
  admission, prototype-key sort and artwork-map rejection, production secret behavior,
  malformed UUID route/action boundaries, safe same-origin auth redirects, server-priced
  checkout totals and the order transition state machine.
- Build gates: `pnpm --filter @sodales/store typecheck && lint && build` (all green).
- DB: `db:seed` twice (idempotency), `node scripts/db-smoke.mjs store`.
- Manual/E2E walk: guest add-to-cart → login → merge → checkout → order timeline;
  admin publish → public visibility; admin status update → history; ownership 404 check
  (customer A viewing customer B's order). Validation: submit empty/oversized forms and
  malformed slugs — inline errors, no partial writes.
- Visual QA: desktop/mobile screenshots of `/`, `/products`, one product, `/cart`, auth,
  and admin must be compared against the Direction 1 brief. Source/build review is not a
  substitute for browser capture; see `apps/store/design-qa.md` for current status.

## 17. Deployment

One Vercel project `sodales-store`, root directory `apps/store`, region `sin1`.
Env: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`,
`NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET` (required and ≥32 chars in production),
`ADMIN_EMAIL`. Register
production/preview domains via `neon neon-auth domain add`. Migrations applied via
`pnpm --filter @sodales/store db:migrate` against the target branch before traffic.

## 18. Environments and secrets

`.env.local` (git-ignored, orchestrator-written) holds dev-branch values; `.env.example`
documents every variable and whether it is required. Secrets are read at runtime
server-side only and never printed, committed, or sent to the client. Production fails
closed when `NEON_AUTH_COOKIE_SECRET` is missing or shorter than 32 characters; the
explicit insecure fallback is available only outside production.

## 19. Risks

- Neon Auth SDK/beta drift — mitigated by copying the verified academy patterns verbatim.
- Cookie-cart growth — capped at 30 items / 99 qty; merge caps enforced.
- No inventory: overselling is possible — accepted MVP tradeoff (orders are requests,
  confirmed manually).
- Currency is display-only (single currency `PHP`); multi-currency deferred.

## 20. Open decisions

- Shipping: flat ₱150, free at ≥ ₱2,000 subtotal (assumption — confirm with owner).
- Order-number format `SO-<yymmdd>-<rand4>` (human-friendly; confirm).
- Product deletion is blocked when orders reference the product (use draft+unavailable
  instead) — confirm preferred policy.
