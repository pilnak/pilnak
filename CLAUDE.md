# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## UI Quality Standard

Every UI designed or implemented in this project must be built to a **professional, production-ready standard with exceptional attention to detail, usability, responsiveness, and visual polish**. This is a non-negotiable requirement that applies to all screens, components, and interactions.

- **Visual polish:** Clean layouts, strong visual hierarchy, proper spacing and padding, consistent typography, and purposeful use of color. No placeholder-looking elements, no raw unstyled states, no rough edges. Every pixel should feel intentional.
- **Responsiveness:** Every screen must work correctly and look great across mobile, tablet, and desktop breakpoints. Use the mobile-first Tailwind approach and test all breakpoints.
- **Interactivity & feedback:** Buttons, inputs, and interactive elements must have clear hover, focus, active, and disabled states. Loading states, skeleton screens, and error states must be implemented — never leave the user staring at a blank or broken UI. Interactions must feel smooth and responsive.
- **Usability:** Navigation must be intuitive. Actions must be discoverable. Forms must validate clearly. Empty states must be informative and helpful, not blank voids. Every user flow must be obvious and friction-free.
- **Consistency:** Components, colors, spacing, and patterns must stay consistent with the rest of the application. Reuse existing shadcn/ui components and Tailwind utilities rather than introducing one-off styles.
- **Modern feel:** Interfaces should feel current — smooth transitions, subtle animations where appropriate, and a design language that matches what users expect from a top-tier delivery platform in 2025. The app should feel as polished as Uber, Bolt, or DHL.
- **Sizing & density:** Text sizes, padding, and component dimensions must follow industry-standard UI patterns. Nothing should feel oversized, bloated, or prototype-like. Prefer refined density over excessive whitespace.
- **Overflow & edge cases:** Every text element that could receive long or dynamic content must have proper overflow handling (`truncate`, `break-words`, `min-w-0`, `overflow-hidden`) as appropriate. Modals, cards, and containers must never let content escape their boundaries.

Every screen delivered should feel like it belongs in a shipped, well-funded product — not a prototype or internal tool. All interfaces must be modern, intuitive, highly interactive, and engaging while maintaining full consistency across the application.

## Mobile & PWA Layout Standards

All mobile screens and PWA interfaces must meet the following requirements without exception:

- **Safe area insets:** Always apply `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for spacing on fixed headers, bottom navigation bars, chat input bars, and action bars. Devices with notches, Dynamic Islands, and home indicators must never have UI obscured by system chrome.
- **Chat & fixed action bars:** Chat input bars, bottom nav bars, and fixed action bars must be anchored to the bottom of the viewport and always respect safe area insets. They must never be obscured by or overlap with device UI elements.
- **Keyboard behavior:** Fix chat input bars to the bottom of the viewport. The on-screen keyboard must not push, break, or overlap the message layout. Use `dvh` viewport units and/or the `visualViewport` API as needed to correctly handle keyboard appearance across iOS and Android.
- **Stable layouts:** Avoid layout shifts when the keyboard opens or closes. Message lists must scroll independently while headers and input bars remain fixed in place.
- **Touch scrolling:** Apply `touch-action` and `-webkit-overflow-scrolling: touch` where appropriate to ensure smooth, native-feeling scroll behavior on mobile.
- **PWA testing:** All mobile screens must be tested and optimized for PWA usage — keyboard interactions, safe areas, scrolling behavior, and orientation changes must all work correctly.
- **Fixed UI elements:** Fixed headers, floating action buttons, bottom sheets, and chat interfaces must maintain proper positioning across all supported mobile devices and orientations.
- **Native feel:** Prioritize a native app-like experience on mobile — smooth interactions, stable layouts, and zero visual glitches caused by viewport resizing or keyboard transitions.

## Commands

```bash
npm run dev          # Dev server at http://localhost:8080
npm run build        # Production build
npm run build:dev    # Dev-mode build
npm run lint         # ESLint
npm run test         # Run tests once (Vitest + jsdom)
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

Run a single test file: `npx vitest run src/test/example.test.ts`

Tests live in `src/test/`. Setup file is `src/test/setup.ts` (testing-library matchers).

## Architecture

**Stack:** React 18 + TypeScript + Vite (SWC) + Tailwind CSS + shadcn/ui + Firebase

**Backend:** Firebase (Auth, Firestore, Storage). The `supabase/` folder and documentation reference Supabase, but the active backend is Firebase — see [src/integrations/firebase/client.ts](src/integrations/firebase/client.ts) and [src/services/firebase.ts](src/services/firebase.ts).

### User Roles & Routing

Four roles, each with a dedicated dashboard — role is stored on the Firestore `users/{uid}` doc and read by `useAuth`:

- **Customer** → `CustomerDashboard` — books deliveries, tracks in real-time
- **Driver** → `DriverDashboard` — receives jobs, updates location, views earnings
- **Admin** → `AdminDashboard` — approves drivers, assigns deliveries
- **Company** → `CompanyDashboard` — manages fleet drivers

All role dashboards are behind `ProtectedRoute` (redirects unauthenticated users). `PublicRoute` redirects already-authenticated users away from login/register. Email verification is required: unverified users are redirected to `/verify-email`; `useAuth` calls `auth.currentUser.reload()` to sync Firebase's verified flag. Companies awaiting approval land on `/company-pending`.

### Booking Flow

Booking state lives in `BookingContext` ([src/contexts/BookingContext.tsx](src/contexts/BookingContext.tsx)) and is persisted to **localStorage** (not sessionStorage). The flow progresses through `RideStatus` states (idle → vehicle_selected → searching → driver_found → …) defined in [src/types/booking.ts](src/types/booking.ts).

Key design choices in `BookingContext`:
- `isPanelOpen` is kept **outside** the persisted data object to avoid unnecessary re-renders.
- State saves are **debounced 150 ms** to limit localStorage writes.
- Callbacks (`startBooking`, `cancelRide`, etc.) use a `useRef` + `dataRef` pattern so they have empty dependency arrays.
- Distance between pickup/dropoff is computed inline via haversine (`src/lib/haversine.ts`, 6371 km radius).
- `RideStatus` is UI-only; `deliveryStatusToRideStatus()` maps the Firestore `DeliveryStatus` enum to it.

UI renders as a bottom sheet on mobile and side sheet on desktop, both driven by the same context.

### Pricing & Transport

Pricing in [src/lib/pricing.ts](src/lib/pricing.ts): `(base + distance × perKm) × vehicleMultiplier`. Base = 500 NGN, per-km = 150 NGN.

Five transport types in [src/lib/transportOptions.ts](src/lib/transportOptions.ts):

| Type | Multiplier | Notes |
|------|-----------|-------|
| economy | 1.0× | |
| premium | 1.5× | |
| xl | 2.0× | |
| self_driver | 1.0× | `driverMode: true` — customer drives themselves |
| company_driver | 1.2× | `driverMode: true` — fulfilled by company fleet |

ETA estimation uses Lagos traffic speeds: peak 15 km/h, off-peak 30 km/h, night 45 km/h.

### Location & Maps

- **Rendering:** Leaflet + OpenStreetMap (no Google Maps tiles).
- **Geocoding/search:** Google Maps API via `useLocationSearch` hook — address autocomplete and reverse geocoding only.
- **Device location:** `useGeolocation` hook requests browser permission, then `watchPosition`. Permission grant is session-persisted so it doesn't re-prompt on re-render. Optional database writes are throttled via `updateInterval`.

### Delivery Status State Machine

The authoritative delivery lifecycle lives in Firestore as `DeliveryStatus` (defined in [src/services/firebase.ts](src/services/firebase.ts)):

```
pending → admin_review → negotiating_price → price_set → payment_pending
  → customer_confirmed → driver_assigned → driver_accepted
  → in_progress → arrived → awaiting_signature → completed
```

Any state can transition to `cancelled`. `RideStatus` (in [src/types/booking.ts](src/types/booking.ts)) is a simplified UI-only enum; `deliveryStatusToRideStatus()` maps between them.

### Delivery Workflows

Three distinct flows share the same `DeliveryStatus` machine:

- **Admin workflow** (default): Admin reviews the request, sets price, confirms payment, and assigns a driver. All transitions are manual via `AdminDashboard`.
- **Company workflow**: Company accounts claim open requests, submit competitive quotes, and assign their own fleet drivers. Uses `delivery_quotes` and `delivery_broadcasts` collections.
- **Self-driver / broadcast workflow**: Customer selects `self_driver` or `company_driver` transport. A broadcast is created; nearby drivers express interest; customer picks one for instant match. Uses `listenActiveBroadcasts()` and `respondToBroadcast()` in `firebase.ts`.

### Data Layer

All Firestore operations are in [src/services/firebase.ts](src/services/firebase.ts) (general) and [src/services/companyService.ts](src/services/companyService.ts) (company fleet operations). Real-time updates use Firestore `onSnapshot` — not polling. Atomic multi-doc changes use Firestore transactions.

**Active Firestore collections:**

| Collection | Purpose |
|---|---|
| `users` | User profiles + role (`admin`/`customer`/`driver`) |
| `drivers` | Driver profiles, approval status, live location |
| `delivery_requests` | Core delivery orders (source of truth for status) |
| `assignments` | Links a driver to a delivery request |
| `delivery_quotes` | Company-submitted price bids on requests |
| `delivery_broadcasts` | Instant-match broadcasts for self/company driver flow |
| `companies` | Company profiles, approval status, wallet |
| `vehicles` | Fleet vehicles owned by company drivers |
| `notifications` | User-facing notifications |
| `admin_notifications` | Admin-facing notifications |
| `chats` / `messages` | Support + delivery chat threads |

**Type note:** [src/types/database.ts](src/types/database.ts) is a leftover Supabase-era schema (snake_case, string IDs). Active Firestore document interfaces are defined inline in [src/services/firebase.ts](src/services/firebase.ts) (e.g. `UserDoc`, `DriverDoc`, `DeliveryRequestDoc`).

`companyService.ts` uses a `stripUndefined()` helper before writing to Firestore to avoid storing `undefined` fields.

### Key Conventions

- Path alias `@/` maps to `src/` — use it for all internal imports.
- `TypeScript strict: false` — type assertions are common throughout.
- All pages are lazy-loaded in [src/App.tsx](src/App.tsx) via dynamic imports.
- Vite manual chunk splitting: `vendor-react`, `vendor-firebase`, `vendor-query`, `vendor-ui`, `vendor-map`, `vendor-charts` — keep heavy imports in their respective bundles.
- Image uploads go to Cloudinary; file attachments to Firebase Storage.
- Vercel Analytics and Speed Insights are initialized in the root render.
- React Query defaults (`src/App.tsx`): `staleTime: 60s`, `gcTime: 10min`, `retry: 1`, `refetchOnWindowFocus: false`. Primary server state comes from Firestore `onSnapshot` listeners, not React Query.
- Test mocks use `vi.hoisted()` to hoist Firebase mock setup before imports. See `src/test/broadcast.service.test.ts` for the pattern.

## Environment Variables

Required in `.env`:
```
VITE_GOOGLE_MAPS_API_KEY
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

## Known Incomplete Features

These features have database schema or partial UI but no full implementation:
- Chat/messaging (Firestore collections exist, UI partial)
- Payment processing (no implementation beyond UI scaffolding)
- Push notifications
- Reviews and ratings
- Full delivery status transition workflow
