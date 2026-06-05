# Pilnak — Transportation Booking Platform

## 1. Architecture Overview

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Radix UI (shadcn), React Router, TanStack Query.
- **Backend / Data**: Supabase (Auth, Postgres, Realtime, Storage).
- **Map**: Leaflet + react-leaflet (OpenStreetMap).
- **State**: React context for booking flow (`BookingContext`); Supabase for persistence and realtime.

### Key Directories

- `src/contexts/BookingContext.tsx` — Global booking state (pickup, dropoff, vehicle, ride status, driver).
- `src/components/booking/` — BookingBottomSheet, TransportOptions, DriverFoundCard.
- `src/components/landing/` — Header, HeroSection, LocationInput, Footer, etc.
- `src/components/map/` — MapView (markers, route polyline), LocationPermissionModal.
- `src/lib/` — pricing.ts, transportOptions.ts, utils.
- `src/types/` — database.ts, booking.ts.
- `src/hooks/` — useGeolocation, useLocationSearch, useReverseGeocode, useDistanceCalculation.

---

## 2. Booking Flow

1. **Landing** — User enters pickup and dropoff (with autocomplete and “Use my location”). Map shows markers and route line. Distance and ETA are shown.
2. **Get Instant Quote** — If not logged in: booking state is stored in `sessionStorage`, user is sent to `/auth?redirect=booking&role=customer`. After login, user is redirected to `/?redirect=booking` and the stored state is restored and the booking panel opens.
3. **Vehicle selection** — User chooses Economy, Premium, XL, Self Driver, or Company Driver. Each option shows price estimate and ETA.
4. **Confirm** — A `delivery_requests` row is created; `rideStatus` becomes `searching`.
5. **Driver match**  
   - **Self Driver**: Backend (or demo logic) assigns the first available online driver and creates an `assignments` row.  
   - **Company Driver**: Request stays in “pending” until an admin assigns a driver in the Admin dashboard.
6. **Driver found** — Realtime or polling sees the new assignment; driver details are loaded and shown in the bottom sheet (DriverFoundCard). User can Call (tel link), Message, or Cancel.
7. **Trip** — Status can move to `driver_arriving`, `trip_started`, then `completed` or `cancelled` (driven by backend or future realtime updates).

### Ride lifecycle (state machine)

- `idle` → `vehicle_selected` (user picked a ride type) → `searching` (request created) → `driver_found` → `driver_arriving` → `trip_started` → `completed` | `cancelled`.

---

## 3. Driver Matching Logic

- **Self Driver**  
  - Driver is independent; when a request is created with a “self” option, the app (or a Supabase function) finds an online, approved driver (e.g. nearest) and creates an `assignments` row with `driver_accepted: true` for the demo.  
  - In production, you’d use Realtime or Edge Functions to notify drivers and let the first to accept get the ride.

- **Company Driver**  
  - Request is created with status `pending` (or `admin_review`).  
  - Only admins assign a driver via the Admin dashboard (create an `assignments` row).  
  - Customer sees “driver found” when that assignment exists (realtime or polling).

---

## 4. Admin Assignment Process (Company Driver UI)

1. Admin logs in (e.g. via PIN or role) and opens the Admin dashboard.
2. **Deliveries** tab shows an “Unassigned requests” section at the top when there are requests with status `pending` or `admin_review` and no assignment. Admin can click “Assign driver” on any request.
3. Request detail modal opens: admin can set price (optional) and choose a driver from the list of **online, approved** drivers. “Assign driver” creates an `assignments` row with `request_id`, `driver_id`, `assigned_by` (admin user id), `assigned_at`.
4. `delivery_requests.status` is set to `driver_assigned`. Customer is notified in real time (Supabase Realtime on `assignments`); the booking bottom sheet updates to “Driver found” and shows driver details.
5. If no drivers are online, the modal shows an empty state: “No online drivers available. Ask drivers to go online.”
6. Admin dashboard subscribes to `assignments` INSERT so data refreshes when an assignment is created.

---

## 5. Pricing Logic

- **Base**: Stored in `src/lib/pricing.ts`: base fare (NGN) + per-km rate.
- **Distance**: Haversine distance between pickup and dropoff (same as in `useDistanceCalculation`).
- **Vehicle multiplier**: Economy 1x, Premium 1.5x, XL 2x (configurable in `pricing.ts` and in `transportOptions.ts` via `priceMultiplier`).
- **Formula**: `estimatedPrice = round((baseFare + distanceKm * perKmRate) * vehicleMultiplier)`.
- **Company / custom**: Can be extended with a fixed price per request or a company-specific multiplier (e.g. in `delivery_requests.estimated_price` or a company settings table).

---

## 6. Database (Supabase) Structure

- **users** — Supabase Auth.
- **profiles** — Extended user info (first_name, last_name, phone, avatar_url, etc.).
- **user_roles** — Links user_id to role: admin | customer | driver.
- **customers** — customer record per user (user_id, wallet_balance, saved_addresses, etc.).
- **drivers** — driver record (user_id, driver_type, status, is_online, current_lat/lon, etc.).
- **vehicles** — per driver (vehicle_type, brand, model, plate_number, etc.).
- **delivery_requests** — each ride request (customer_id, pickup/dropoff address and lat/lon, status, estimated_price, final_price, etc.).
- **assignments** — links a delivery_request to a driver (request_id, driver_id, assigned_by, driver_accepted, accepted_at, started_at, completed_at).
- **chats** — chat threads (e.g. participant_ids, request_id for ride chat).
- **messages** — chat messages (chat_id, sender_id, content, etc.).
- **driver_locations** / **locations** — optional for history; drivers also have `current_latitude`, `current_longitude` on `drivers`.

To support **self vs company** driver explicitly, you can add a column (e.g. `driver_mode` or `company_id`) to `drivers`: if `company_id` is null, treat as self driver; otherwise company driver.

---

## 7. Driver Dashboard Enhancements

- **Assignments**: Pending jobs (where `driver_accepted` is null) show Accept / Decline. Accepted jobs appear as “Active delivery” with a **Navigate to pickup** button that opens Google Maps (destination = pickup lat/lon or address).
- **Jobs tab**: Filter by All / Active / Completed. Each job shows pickup → dropoff, status, price (₦), and a Navigate button for active jobs.
- **Earnings tab**: Total earnings (₦), completed trips count, sum from completed assignments, and a per-trip earnings list. “Request Withdrawal” is a placeholder.
- **Realtime**: New assignments (INSERT on `assignments` with `driver_id` = current driver) trigger a toast and prepend to the jobs list.
- **Location**: Driver location is pushed to `drivers.current_latitude` / `current_longitude` while online and watching position.

---

## 8. Real-Time Features

- **Live driver location**: When a customer has a driver assigned, the app subscribes to `drivers` UPDATE for that driver’s id and updates the driver’s `current_latitude` / `current_longitude` in booking context so the map can show live position (e.g. in a future map view with driver marker).
- **Ride status**: Booking bottom sheet subscribes to `assignments` INSERT for the current `requestId`; when an assignment is created (self or company), the customer sees “Driver assigned!” toast and the driver card.
- **Admin**: Subscribes to `assignments` INSERT and refetches so the deliveries list stays in sync.

---

## 9. UX / UI Polish

- **Bottom sheet**: Mobile uses Drawer (vaul); desktop uses Sheet with `rounded-l-2xl`, `shadow-2xl`, and slide transition. Same content and state in both.
- **Searching state**: “Finding a driver” shows a spinner and animated dots; optional error message if no driver is found after a timeout.
- **Driver found**: DriverFoundCard shows photo, car, plate, rating, distance, ETA; **Call** (opens `tel:` link), **Message**, **Cancel**.
- **Admin assign**: Loading state (“Assigning…”) and empty state when no online drivers. Assign button disabled while request is being assigned.
- **Currency**: NGN (₦) used consistently in driver earnings and customer views.

---

## 10. Saved Addresses (Favorites)

- **Customer profile**: “Saved locations” section lists saved addresses (label + address). User can add via label + address inputs and “Add”, or remove with the X button.
- Data is stored in `customers.saved_addresses` (JSON array of `{ id, label, address }`). Can be extended to include lat/lon for one-tap fill on the booking form.

---

## 11. How to Extend the System

- **Real-time driver location on map**: Use the driver’s `current_latitude` / `current_longitude` from booking context to show a driver marker on the landing or customer map; the subscription in BookingBottomSheet already updates this.
- **Route API**: Replace the straight polyline with a routing API (e.g. OSRM, Google Directions) and pass the result to `MapView`’s `route` prop.
- **Payments**: Integrate Stripe/Paystack; store method in a `payment_methods` table and charge on `trip_started` or `completed`; update `customers.wallet_balance` or link to transactions table.
- **Saved locations**: Implemented in customer profile; can add lat/lon and suggest in booking form.
- **Notifications**: Use Supabase Realtime or a push service; write to a `notifications` table and show in-app and/or push.
- **Chat**: Create/fetch a `chats` row per request; use `messages` and Realtime. “Message” on DriverFoundCard is a placeholder.
- **Company drivers**: Add `companies` and `company_drivers`; restrict assignment in Admin to drivers belonging to the selected company.

---

## 12. Running the Project

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`

Set Supabase env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 13. UI / Responsiveness

- **Header**: Sticky; desktop nav + hamburger menu on mobile; “Become a Driver”, “Log in”, “Sign up”.
- **Booking panel**: On mobile, bottom sheet (Drawer); on desktop, side sheet (Sheet). Same booking state and flow.
- **Map**: Full support for touch/gestures and zoom; route polyline and markers for pickup, dropoff, and (when available) driver.

No deployment steps are included; the app is prepared for production use once environment and Supabase are configured.
