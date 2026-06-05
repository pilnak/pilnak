# Dashboard Communication Quick Reference

## Real-time Communication Map

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
│  (PostgreSQL with Realtime enabled)                          │
│                                                              │
│  Tables: drivers, delivery_requests, assignments,            │
│          messages, notifications, locations                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   ADMIN      │ │   DRIVER     │ │   CUSTOMER   │
│  Dashboard   │ │  Dashboard   │ │  Dashboard   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       │                │                │
       └────────────────┼────────────────┘
                        │
            Real-time Updates via
            Supabase Realtime Channels
```

## Communication Channels

### Admin Dashboard Subscriptions
```javascript
Channel: 'admin-updates'
Subscribes to:
  - drivers (all events)
  - delivery_requests (all events)
  
Updates:
  - Driver list when drivers go online/offline
  - Delivery requests when status changes
  - Stats (active drivers, today's deliveries)
```

### Driver Dashboard Subscriptions
```javascript
Channel: 'driver-assignments'
Subscribes to:
  - assignments (INSERT events where driver_id matches)
  
Updates:
  - Shows notification when admin assigns new job
  - Updates assignments list in real-time
```

### Customer Dashboard Subscriptions
```javascript
Channel: 'drivers-updates'
Subscribes to:
  - drivers (all events)
  
Updates:
  - Nearby drivers list when drivers go online/offline
  - Driver locations on map
```

## Data Flow Examples

### Example 1: Driver Goes Online
```
1. Driver clicks "Go Online" button
   ↓
2. Updates: drivers.is_online = true
   ↓
3. Supabase Realtime broadcasts change
   ↓
4. Admin Dashboard receives update
   → Updates "Active Drivers" count
   → Adds driver to Live Map
   ↓
5. Customer Dashboard receives update
   → Adds driver to "Nearby Drivers" list
   → Shows driver on map
```

### Example 2: Admin Assigns Job to Driver
```
1. Admin selects driver for delivery request
   ↓
2. Creates: assignments record
   ↓
3. Updates: delivery_requests.status = 'driver_assigned'
   ↓
4. Supabase Realtime broadcasts assignment INSERT
   ↓
5. Driver Dashboard receives notification
   → Shows "New job assignment!" toast
   → Displays job in "Pending Jobs" section
   ↓
6. Admin Dashboard receives update
   → Updates delivery status in table
   ↓
7. Customer Dashboard receives update (if subscribed)
   → Updates delivery status
```

### Example 3: Driver Updates Location
```
1. Driver is online and location changes
   ↓
2. Updates: drivers.current_latitude, current_longitude
   ↓
3. Supabase Realtime broadcasts change
   ↓
4. Customer Dashboard receives update
   → Updates driver marker position on map
   → Refreshes nearby drivers list
   ↓
5. Admin Dashboard receives update
   → Updates driver position on Live Map
```

## Status Transitions

### Delivery Request Status Flow
```
pending
  ↓ (Admin sets price)
price_set
  ↓ (Admin assigns driver)
driver_assigned
  ↓ (Driver accepts)
driver_accepted
  ↓ (Customer confirms)
customer_confirmed
  ↓ (Driver starts)
in_progress
  ↓ (Driver completes)
completed
```

### Driver Status Flow
```
pending_verification
  ↓ (Admin approves)
approved
  ↓ (Driver goes online)
is_online = true
  ↓ (Driver goes offline)
is_online = false
```

## Key Database Updates

### When Driver Goes Online:
```sql
UPDATE drivers SET 
  is_online = true,
  current_latitude = ?,
  current_longitude = ?,
  last_location_update = NOW()
WHERE id = ?
```

### When Admin Assigns Driver:
```sql
INSERT INTO assignments (request_id, driver_id, assigned_by)
VALUES (?, ?, ?);

UPDATE delivery_requests 
SET status = 'driver_assigned'
WHERE id = ?;
```

### When Driver Accepts Job:
```sql
UPDATE assignments SET 
  driver_accepted = true,
  accepted_at = NOW()
WHERE id = ?;
```

## Real-time Event Types

| Event | Table | Description |
|-------|-------|-------------|
| `INSERT` | `assignments` | New job assigned to driver |
| `UPDATE` | `drivers` | Driver status/location changed |
| `UPDATE` | `delivery_requests` | Delivery status changed |
| `UPDATE` | `assignments` | Driver accepted/declined job |

## Testing Real-time Communication

### Test Driver Location Update:
1. Open Driver Dashboard
2. Go online
3. Open Customer Dashboard in another tab
4. Verify driver appears on map
5. Move driver location (simulate)
6. Verify map updates in Customer Dashboard

### Test Job Assignment:
1. Open Admin Dashboard
2. Create delivery request (or use existing)
3. Assign driver
4. Open Driver Dashboard
5. Verify notification appears
6. Verify job shows in pending jobs

### Test Driver Status:
1. Driver goes online
2. Admin Dashboard should show driver in stats
3. Customer Dashboard should show driver in nearby list
4. Driver goes offline
5. Both dashboards should update

## Troubleshooting

### Real-time not working?
1. Check Supabase Dashboard → Database → Realtime
2. Verify tables are enabled for realtime
3. Check browser console for WebSocket errors
4. Verify channel subscriptions are active

### Updates not appearing?
1. Check RLS policies allow access
2. Verify user has correct role
3. Check network tab for WebSocket connection
4. Verify channel names match

### Location not updating?
1. Check location permissions granted
2. Verify `useGeolocation` hook is watching
3. Check `is_online` is true
4. Verify database update is successful
