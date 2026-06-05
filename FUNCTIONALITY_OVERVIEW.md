# Pilnak - Complete Functionality Overview

## Table of Contents
1. [Application Architecture](#application-architecture)
2. [Core Functionality](#core-functionality)
3. [Dashboard Communication Flow](#dashboard-communication-flow)
4. [Database Schema & Relationships](#database-schema--relationships)
5. [Real-time Updates System](#real-time-updates-system)
6. [Authentication & Authorization](#authentication--authorization)
7. [Deployment Requirements](#deployment-requirements)
8. [Missing/Incomplete Features](#missingincomplete-features)

---

## Application Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Library**: shadcn/ui (Radix UI components)
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **Backend**: Supabase (PostgreSQL + Realtime + Storage + Auth)
- **Maps**: React Leaflet (Leaflet.js)
- **Styling**: Tailwind CSS

### Project Structure
```
src/
├── pages/              # Main application pages
│   ├── Landing.tsx     # Public landing page
│   ├── Auth.tsx        # Authentication (login/register)
│   ├── CustomerDashboard.tsx
│   ├── DriverDashboard.tsx
│   ├── AdminDashboard.tsx
│   ├── DriverRegistration.tsx
│   └── NotFound.tsx
├── components/         # Reusable components
│   ├── landing/        # Landing page components
│   ├── map/            # Map-related components
│   ├── camera/         # Camera capture component
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   ├── useGeolocation.ts
│   └── ...
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client & types
└── types/              # TypeScript type definitions
```

---

## Core Functionality

### 1. User Roles & Authentication

#### Three User Roles:
1. **Customer** - Creates delivery requests
2. **Driver** - Accepts and completes deliveries
3. **Admin** - Manages platform, approves drivers, assigns deliveries

#### Authentication Flow:
1. **Registration** (`/auth?role=customer` or `/auth?role=driver`)
   - User selects role (customer or driver)
   - Creates account with email/password
   - Creates profile in `profiles` table
   - Creates role in `user_roles` table
   - Creates customer/driver record in respective table
   - Drivers redirected to `/driver-registration` to complete profile

2. **Login** (`/auth`)
   - Authenticates via Supabase Auth
   - Fetches role from `user_roles` table
   - Redirects to appropriate dashboard:
     - Customer → `/customer`
     - Driver → `/driver`
     - Admin → `/admin`

3. **Driver Registration** (`/driver-registration`)
   - Multi-step form (5 steps):
     1. Personal Info (name, DOB, gender, phone)
     2. Address (home address, city, state, country)
     3. Government ID (type, number, expiry)
     4. Vehicle Info (type, brand, model, plate number)
     5. Photos (selfie + vehicle front/side/back)
   - Uploads images to Supabase Storage
   - Creates driver record with `status: 'pending_verification'`
   - Admin must approve before driver can go online

---

### 2. Customer Dashboard (`/customer`)

#### Features:
- **Home Tab**:
  - Map view showing nearby online drivers
  - Delivery request form (pickup/dropoff locations)
  - Nearby drivers list
  - Recent deliveries history
  - Quick actions (New, Schedule, Track, Support)

- **Deliveries Tab**:
  - View all delivery requests
  - Filter by status (All, Active, Pending, Completed, Cancelled)
  - Track delivery status

- **Messages Tab**:
  - Chat with drivers (NOT YET IMPLEMENTED)
  - Placeholder UI only

- **Profile Tab**:
  - View/edit profile information
  - Update personal details
  - Delete account

#### Location Tracking:
- Requests location permission on first visit
- Saves location to `locations` table
- Uses location to find nearby drivers (within ~10km radius)

#### Real-time Updates:
- Subscribes to `drivers` table changes
- Updates nearby drivers list when drivers go online/offline
- Updates driver locations on map

---

### 3. Driver Dashboard (`/driver`)

#### Features:
- **Home Tab**:
  - Map showing driver's current location
  - Online/Offline toggle button
  - Stats (Today's Earnings, Total Deliveries, Online Time)
  - Pending job requests (new assignments)
  - Active delivery (if any)
  - "Looking for deliveries" status when online

- **Jobs Tab**:
  - View all assignments
  - Filter by status (All, Active, Completed, Cancelled)
  - See delivery details (pickup/dropoff addresses)

- **Earnings Tab**:
  - Total earnings display
  - Weekly earnings breakdown
  - Completed deliveries count
  - Request withdrawal button (NOT YET IMPLEMENTED)

- **Profile Tab**:
  - View driver profile
  - See vehicle information
  - Support link

#### Location Tracking:
- **Critical for going online**:
  - Must grant location permission
  - Updates `drivers.current_latitude` and `drivers.current_longitude` every 5 seconds when online
  - Updates `drivers.last_location_update` timestamp
  - Stops tracking when going offline

#### Job Assignment Flow:
1. Admin assigns driver to delivery request
2. Assignment created in `assignments` table
3. Driver receives real-time notification via Supabase Realtime
4. Driver can accept or decline
5. If accepted, `driver_accepted = true` and `accepted_at` timestamp set
6. Delivery status updates to `driver_accepted`

#### Status Requirements:
- Driver must have `status = 'approved'` to go online
- Pending verification drivers cannot go online
- Suspended drivers cannot go online

---

### 4. Admin Dashboard (`/admin`)

#### Features:
- **Dashboard Tab**:
  - Stats cards (Total Users, Active Drivers, Today's Deliveries, Revenue)
  - Quick actions (Pending Drivers, Active Requests, Online Drivers, Completed Today)
  - Recent requests list
  - Pending driver verifications list

- **Users Tab**:
  - View all user profiles
  - Search users
  - See user roles
  - View user details

- **Drivers Tab**:
  - View all drivers
  - **Pending Verification Section** (highlighted)
  - Approve/Reject drivers
  - Suspend approved drivers
  - View driver details (profile, vehicle, images)
  - See driver ratings and delivery counts

- **Deliveries Tab**:
  - View all delivery requests
  - Filter by status
  - See customer and assigned driver
  - **Set price** for pending requests
  - **Assign driver** to requests
  - View request details

- **Live Map Tab**:
  - Real-time map showing all online drivers
  - Click driver markers to see details
  - Shows driver locations

- **Messages Tab**:
  - Placeholder (NOT YET IMPLEMENTED)

- **Settings Tab**:
  - Placeholder (NOT YET IMPLEMENTED)

#### Admin Actions:
1. **Approve Driver**:
   - Updates `drivers.status = 'approved'`
   - Driver can now go online

2. **Reject Driver**:
   - Updates `drivers.status = 'rejected'`
   - Driver cannot use platform

3. **Suspend Driver**:
   - Updates `drivers.status = 'suspended'`
   - Sets `is_online = false`
   - Driver cannot go online

4. **Set Price**:
   - Updates `delivery_requests.estimated_price`
   - Sets `status = 'price_set'`

5. **Assign Driver**:
   - Creates record in `assignments` table
   - Sets `assigned_by` to admin user_id
   - Updates `delivery_requests.status = 'driver_assigned'`
   - Driver receives real-time notification

#### Real-time Updates:
- Subscribes to `drivers` table changes
- Subscribes to `delivery_requests` table changes
- Auto-refreshes data when changes occur

---

## Dashboard Communication Flow

### Real-time Communication Architecture

All dashboards communicate through **Supabase Realtime** using PostgreSQL change events:

```
┌─────────────────┐
│   Supabase DB   │
│  (PostgreSQL)   │
└────────┬────────┘
         │
         │ Realtime Subscriptions
         │
    ┌────┴────┬──────────┬──────────┐
    │        │          │          │
┌───▼───┐ ┌──▼───┐ ┌───▼───┐ ┌───▼───┐
│Admin  │ │Driver│ │Customer│ │Driver│
│Dash   │ │Dash  │ │  Dash  │ │Dash  │
└───┬───┘ └──┬───┘ └───┬───┘ └───┬───┘
    │        │          │        │
    └────────┴──────────┴────────┘
         │
    Updates via
    Supabase Client
```

### Communication Patterns

#### 1. Driver Location Updates
**Flow**: Driver Dashboard → Database → Customer Dashboard

1. Driver goes online in Driver Dashboard
2. `useGeolocation` hook tracks location every 5 seconds
3. Updates `drivers` table:
   ```sql
   UPDATE drivers SET 
     current_latitude = ?,
     current_longitude = ?,
     last_location_update = NOW()
   WHERE id = ?
   ```
4. Customer Dashboard subscribes to `drivers` table changes
5. Customer sees updated driver locations on map

**Realtime Channel**: `drivers-updates` (Customer Dashboard)

---

#### 2. Job Assignment Flow
**Flow**: Admin Dashboard → Database → Driver Dashboard

1. Admin assigns driver to delivery request
2. Creates `assignments` record:
   ```sql
   INSERT INTO assignments (request_id, driver_id, assigned_by)
   VALUES (?, ?, ?)
   ```
3. Updates `delivery_requests.status = 'driver_assigned'`
4. Driver Dashboard subscribes to `assignments` table:
   ```javascript
   supabase
     .channel('driver-assignments')
     .on('postgres_changes', {
       event: 'INSERT',
       table: 'assignments',
       filter: `driver_id=eq.${driver.id}`
     }, (payload) => {
       // Show notification
       toast.info('New job assignment!');
     })
   ```
5. Driver receives notification and can accept/decline

**Realtime Channel**: `driver-assignments` (Driver Dashboard)

---

#### 3. Driver Status Updates
**Flow**: Driver Dashboard → Database → Admin Dashboard + Customer Dashboard

1. Driver toggles online/offline
2. Updates `drivers.is_online`:
   ```sql
   UPDATE drivers SET is_online = ?
   ```
3. Admin Dashboard subscribes to `drivers` changes:
   ```javascript
   .on('postgres_changes', { 
     event: '*', 
     table: 'drivers' 
   }, fetchData)
   ```
4. Customer Dashboard subscribes to `drivers` changes
5. Both dashboards update their views:
   - Admin: Updates online drivers count and map
   - Customer: Updates nearby drivers list

**Realtime Channels**: 
- `admin-updates` (Admin Dashboard)
- `drivers-updates` (Customer Dashboard)

---

#### 4. Delivery Request Status Updates
**Flow**: Customer/Admin/Driver → Database → All Dashboards

1. Status changes (e.g., `pending` → `driver_assigned` → `in_progress` → `completed`)
2. Updates `delivery_requests.status`
3. All dashboards that subscribe to `delivery_requests` receive updates:
   - Admin: Sees status in deliveries table
   - Customer: Sees status in deliveries tab
   - Driver: Sees status in jobs tab

**Realtime Channel**: `admin-updates` (Admin Dashboard)

---

### Real-time Subscriptions Summary

| Dashboard | Subscribed Tables | Channel Name | Purpose |
|-----------|------------------|--------------|---------|
| **Admin** | `drivers`, `delivery_requests` | `admin-updates` | Monitor all platform activity |
| **Customer** | `drivers` | `drivers-updates` | See nearby driver locations |
| **Driver** | `assignments` | `driver-assignments` | Receive new job notifications |

---

## Database Schema & Relationships

### Core Tables

#### 1. `profiles` (All Users)
- Stores basic user information
- Linked to `auth.users` via `user_id`
- Used by all roles

#### 2. `user_roles` (Role Management)
- **CRITICAL**: Determines user access
- One user can have one role (admin, customer, driver)
- Used for RLS (Row Level Security) policies

#### 3. `customers`
- Extended customer data
- `wallet_balance`, `total_deliveries`, `saved_addresses`
- Linked to `profiles.user_id`

#### 4. `drivers`
- Extended driver data
- `status`: `pending_verification` | `approved` | `suspended` | `rejected`
- `is_online`: Boolean for online/offline status
- `current_latitude`, `current_longitude`: Real-time location
- `total_earnings`, `total_deliveries`, `average_rating`
- Linked to `profiles.user_id`

#### 5. `vehicles`
- Vehicle information for drivers
- Linked to `drivers.id`

#### 6. `delivery_requests`
- Customer creates delivery request
- Status flow: `pending` → `admin_review` → `driver_assigned` → `driver_accepted` → `price_set` → `customer_confirmed` → `in_progress` → `completed`
- Linked to `customers.id`

#### 7. `assignments`
- Links drivers to delivery requests
- Created by admin when assigning driver
- `driver_accepted`: Boolean (null = pending, true = accepted, false = declined)
- Linked to `delivery_requests.id` and `drivers.id`

### Relationships Diagram

```
auth.users
    │
    ├── profiles (1:1)
    │
    ├── user_roles (1:1)
    │
    ├── customers (1:1) ──┐
    │                     │
    │                     ├── delivery_requests (1:many)
    │                     │       │
    │                     │       └── assignments (1:many)
    │                     │               │
    └── drivers (1:1) ───┴───────────────┘
            │
            ├── vehicles (1:many)
            │
            └── driver_images (1:many)
```

---

## Real-time Updates System

### Enabled Realtime Tables

The following tables have realtime enabled (from migration):
- `drivers` - Driver status and location updates
- `delivery_requests` - Request status changes
- `assignments` - New job assignments
- `messages` - Chat messages (not yet implemented)
- `notifications` - User notifications (not yet implemented)
- `locations` - Location tracking history

### How Realtime Works

1. **Supabase Realtime** uses PostgreSQL's logical replication
2. Changes to tables are captured and broadcast via WebSocket
3. Clients subscribe to specific tables/events
4. Updates are pushed to subscribed clients instantly

### Example: Driver Location Update

```javascript
// Driver Dashboard - Updates location
await supabase
  .from('drivers')
  .update({ 
    current_latitude: lat,
    current_longitude: lng 
  })
  .eq('id', driverId);

// Customer Dashboard - Receives update
const channel = supabase
  .channel('drivers-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'drivers'
  }, () => {
    // Refetch nearby drivers
    fetchNearbyDrivers();
  })
  .subscribe();
```

---

## Authentication & Authorization

### Authentication Flow

1. **Sign Up**:
   - User creates account via Supabase Auth
   - Profile created in `profiles` table
   - Role created in `user_roles` table
   - Customer/Driver record created

2. **Sign In**:
   - Supabase Auth validates credentials
   - Session stored in localStorage
   - Role fetched from `user_roles` table
   - Redirected to appropriate dashboard

3. **Session Management**:
   - Auto-refresh tokens enabled
   - Session persists across page reloads
   - `onAuthStateChange` listener updates UI

### Row Level Security (RLS)

All tables have RLS enabled with policies:

- **Users can only access their own data**
- **Admins can access all data**
- **Drivers can see approved online drivers** (for customer matching)
- **Assigned drivers can view their delivery requests**

### Role-Based Access

- **Admin**: Full access to all tables
- **Customer**: Own profile, own delivery requests, view approved drivers
- **Driver**: Own profile, own assignments, update own location

---

## Deployment Requirements

### Environment Variables

Create `.env` file with:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Supabase Setup

1. **Run Migrations**:
   ```bash
   # Apply database migrations
   supabase db push
   ```

2. **Storage Buckets** (from migration):
   - `driver-images` (public)
   - `vehicle-images` (public)
   - `documents` (private)
   - `item-photos` (public)

3. **Enable Realtime**:
   - Already enabled in migration for key tables
   - Verify in Supabase Dashboard → Database → Replication

4. **RLS Policies**:
   - All policies created in migration
   - Verify in Supabase Dashboard → Authentication → Policies

### Build & Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview build
npm run preview

# Deploy dist/ folder to hosting (Vercel, Netlify, etc.)
```

### Required Supabase Features

- ✅ PostgreSQL Database
- ✅ Authentication (Email/Password)
- ✅ Realtime Subscriptions
- ✅ Storage (for images)
- ✅ Row Level Security

---

## Missing/Incomplete Features

### 1. Delivery Request Creation
**Status**: UI exists, backend not connected
- Customer Dashboard has form but no submit handler
- Need to implement:
  - Create `delivery_requests` record
  - Geocode addresses to get lat/lng
  - Set initial status to `pending`

### 2. Messaging System
**Status**: Database tables exist, UI not implemented
- `chats` and `messages` tables created
- Need to implement:
  - Chat creation when assignment accepted
  - Message sending/receiving
  - Real-time message updates

### 3. Payment System
**Status**: Database tables exist, not implemented
- `payments` and `wallets` tables created
- Need to implement:
  - Payment processing
  - Wallet balance management
  - Escrow system

### 4. Notifications
**Status**: Database table exists, not implemented
- `notifications` table created
- Need to implement:
  - Notification creation triggers
  - Notification display in dashboards
  - Real-time notification updates

### 5. Reviews & Ratings
**Status**: Database table exists, not implemented
- `reviews` table created
- Need to implement:
  - Review submission after delivery
  - Rating calculation for drivers
  - Review display

### 6. Price Calculation
**Status**: Not implemented
- Need to implement:
  - Distance-based pricing
  - Vehicle type pricing
  - Admin price override

### 7. Delivery Status Workflow
**Status**: Partially implemented
- Status transitions exist in database
- Need to implement:
  - Status update handlers
  - Customer confirmation flow
  - Completion flow

---

## How Dashboards Communicate (Summary)

### Current Real-time Communication:

1. **Driver → Customer**:
   - Driver location updates → Customer sees on map
   - Driver goes online → Customer sees in nearby drivers

2. **Admin → Driver**:
   - Admin assigns job → Driver receives notification
   - Admin approves driver → Driver can go online

3. **Driver → Admin**:
   - Driver goes online → Admin sees in stats and map
   - Driver accepts job → Admin sees status update

4. **All → All**:
   - Delivery request status changes → All dashboards update
   - Driver status changes → Admin and Customer update

### Communication Channels:

- **Supabase Realtime**: Primary communication method
- **PostgreSQL Change Events**: Trigger updates
- **WebSocket Connections**: Maintained by Supabase client

### Data Flow Example: Complete Delivery Flow

1. **Customer** creates delivery request → `delivery_requests` table
2. **Admin** sees request in dashboard (realtime update)
3. **Admin** sets price → Updates `delivery_requests.estimated_price`
4. **Admin** assigns driver → Creates `assignments` record
5. **Driver** receives notification (realtime subscription)
6. **Driver** accepts → Updates `assignments.driver_accepted = true`
7. **Customer** sees driver assigned (realtime update)
8. **Driver** completes delivery → Updates `delivery_requests.status = 'completed'`
9. **All dashboards** update (realtime subscriptions)

---

## Next Steps for Deployment

1. ✅ Database schema complete
2. ✅ Authentication working
3. ✅ Real-time subscriptions working
4. ⚠️ Implement delivery request creation
5. ⚠️ Complete delivery workflow
6. ⚠️ Add payment processing
7. ⚠️ Implement messaging
8. ⚠️ Add notifications
9. ⚠️ Test all real-time flows
10. ⚠️ Set up production Supabase project
11. ⚠️ Configure environment variables
12. ⚠️ Deploy frontend to hosting service

---

## Key Files Reference

- **Routing**: `src/App.tsx`
- **Auth**: `src/pages/Auth.tsx`
- **Customer Dashboard**: `src/pages/CustomerDashboard.tsx`
- **Driver Dashboard**: `src/pages/DriverDashboard.tsx`
- **Admin Dashboard**: `src/pages/AdminDashboard.tsx`
- **Supabase Client**: `src/integrations/supabase/client.ts`
- **Database Types**: `src/integrations/supabase/types.ts`
- **Migrations**: `supabase/migrations/`

---

*Last Updated: Based on current codebase analysis*
