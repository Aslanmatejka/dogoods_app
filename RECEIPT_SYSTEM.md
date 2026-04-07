# Receipt System Documentation

## Overview

The Receipt System aggregates multiple food claims into a single receipt for easier pickup management. Users can claim multiple items throughout the day, and they will all be grouped into one receipt that must be picked up by Friday 5:00 PM Pacific time.

## System Architecture

### Database Tables

#### `receipts` Table

- **id**: UUID (primary key)
- **user_id**: UUID (references auth.users)
- **status**: VARCHAR (pending, completed, expired)
- **pickup_location**: VARCHAR (e.g., "Ruby Bridges Elementary School")
- **pickup_address**: TEXT (full address)
- **pickup_window**: TEXT (pickup time windows)
- **claimed_at**: TIMESTAMPTZ (when receipt was created)
- **pickup_by**: TIMESTAMPTZ (auto-calculated deadline - Friday 5PM Pacific)
- **picked_up_at**: TIMESTAMPTZ (when user clicked "Pick Up")
- **expired_at**: TIMESTAMPTZ (when receipt was auto-expired)

#### `food_claims` Table Updates

- **receipt_id**: UUID (references receipts table)

### Receipt States

1. **Pending** (Green "Pick Up" button)
   - Items are claimed but not picked up yet
   - Items are removed from available inventory
   - Deadline is shown: next Friday 5:00 PM Pacific

2. **Completed** (Grey "Complete" button)
   - User clicked "Pick Up" button
   - Items permanently removed from inventory
   - Receipt archived for records

3. **Expired** (Orange/Red "Reclaim" button)
   - Past Friday 5:00 PM deadline
   - Items automatically returned to inventory
   - User can reclaim available items

## User Flow

### Claiming Food

1. User browses available food on Find Food page
2. User clicks "Claim" on an item
3. System checks if user has a pending receipt for today:
   - **If YES**: Add item to existing receipt
   - **If NO**: Create new receipt, then add item
4. Item is removed from available inventory
5. User is redirected to dashboard with success message

### Viewing Receipts

1. User visits their dashboard
2. All receipts are displayed in grid format
3. Each receipt shows:
   - Date claimed
   - List of items (name + quantity)
   - Pickup location details
   - Pickup deadline
   - Action button (Pick Up / Complete / Reclaim)

### Picking Up Food

1. User goes to pickup location
2. Shows receipt to community staff
3. Staff confirms items and user clicks "Pick Up"
4. Receipt status → Completed
5. Items permanently removed from inventory

### Expired Receipts

1. System automatically expires receipts past Friday 5PM
2. Items return to inventory as "available"
3. Receipt shows orange warning message
4. User can click "Reclaim" to create new receipt
5. Only available items are reclaimed (some may be gone)

## Implementation Files

### Frontend Components

- **`components/common/Receipt.jsx`** - Receipt card component with three states
- **`pages/ClaimFoodForm.jsx`** - Updated to create/use receipts
- **`pages/UserDashboard.jsx`** - Displays user's receipts

### Backend Services

- **`utils/receiptService.js`** - Receipt operations and business logic
- **`supabase/migrations/20260220_create_receipts_system.sql`** - Database schema
- **`supabase/functions/expire-receipts/index.ts`** - Edge function for cron job

### Database Functions

- **`calculate_pickup_deadline(timestamp)`** - Calculates next Friday 5PM Pacific
- **`expire_unclaimed_receipts()`** - Expires old receipts and returns items to inventory

## Setup Instructions

### 1. Apply Database Migration

```bash
# Local Supabase
npm run supabase:start
npx supabase db reset  # Applies all migrations

# Or apply specific migration
psql -d your_database -f supabase/migrations/20260220_create_receipts_system.sql
```

### 2. Connect to Supabase (MCP Tool Method)

```bash
# Using the MCP tool in VS Code
# Tool: mcp_supabase_execute_sql
# SQL: Contents of 20260220_create_receipts_system.sql
```

### 3. Deploy Edge Function (Optional - for automatic expiry)

```bash
# Deploy the function
npx supabase functions deploy expire-receipts

# Set environment variables in Supabase Dashboard:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### 4. Set Up Cron Job

**Option A: Supabase pg_cron (Recommended)**

```sql
-- Run this in Supabase SQL Editor
SELECT cron.schedule(
  'expire-receipts-friday-5pm',
  '0 17 * * 5',  -- Every Friday at 5:00 PM
  $$
  SELECT expire_unclaimed_receipts();
  $$
);
```

**Option B: External Cron (GitHub Actions, Vercel Cron, etc.)**

```yaml
# .github/workflows/expire-receipts.yml
name: Expire Old Receipts
on:
  schedule:
    - cron: "0 17 * * 5" # Every Friday at 5:00 PM UTC
jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Function
        run: |
          curl -X POST \
            https://YOUR_PROJECT.supabase.co/functions/v1/expire-receipts \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

**Option C: Manual Trigger (Admin Panel)**

Add a button in admin panel that calls:

```javascript
import receiptService from "../utils/receiptService";

const expireOldReceipts = async () => {
  const result = await receiptService.expireOldReceipts();
  console.log(result);
};
```

### 5. Update Environment Variables

No new environment variables are required. The system uses existing Supabase configuration.

## Testing

### Manual Testing

1. **Create a Receipt**:

   ```javascript
   // Claim a food item as a user
   // Check dashboard to see receipt created
   ```

2. **Test Aggregation**:

   ```javascript
   // Claim multiple items on same day
   // Verify they all appear in one receipt
   ```

3. **Test Pickup**:

   ```javascript
   // Click "Pick Up" button on pending receipt
   // Verify status changes to "Completed"
   // Verify items removed from inventory
   ```

4. **Test Expiry**:

   ```sql
   -- Manually expire a receipt for testing
   UPDATE receipts
   SET pickup_by = NOW() - INTERVAL '1 day'
   WHERE status = 'pending';

   -- Run expiry function
   SELECT expire_unclaimed_receipts();

   -- Check receipt status changed to 'expired'
   -- Check items returned to 'available' status
   ```

5. **Test Reclaim**:
   ```javascript
   // Click "Reclaim" on expired receipt
   // Verify new receipt created
   // Verify only available items are reclaimed
   ```

### Automated Testing

```javascript
// tests/ReceiptSystem.test.js
describe("Receipt System", () => {
  test("creates receipt when claiming first item", async () => {
    // Test implementation
  });

  test("adds to existing receipt for same-day claims", async () => {
    // Test implementation
  });

  test("expires receipts past deadline", async () => {
    // Test implementation
  });

  test("returns items to inventory on expiry", async () => {
    // Test implementation
  });
});
```

## Cron Schedule Explanation

**`0 17 * * 5`** = Every Friday at 5:00 PM

- **0** = Minute (0)
- **17** = Hour (5 PM in 24-hour format)
- **\*** = Day of month (any)
- **\*** = Month (any)
- **5** = Day of week (5 = Friday, 0 = Sunday)

**Timezone Note**: The cron runs in UTC. Convert to Pacific Time:

- Pacific Daylight Time (PDT): UTC-7 → Cron should be `0 0 * * 6` (Saturday 00:00 UTC = Friday 5PM PDT)
- Pacific Standard Time (PST): UTC-8 → Cron should be `0 1 * * 6` (Saturday 01:00 UTC = Friday 5PM PST)

**Recommendation**: Use Supabase function `calculate_pickup_deadline()` which handles timezone conversion automatically.

## Troubleshooting

### Receipts Not Expiring

1. Check if cron job is running:

   ```sql
   SELECT * FROM cron.job WHERE jobname = 'expire-receipts-friday-5pm';
   ```

2. Manually trigger expiry:

   ```sql
   SELECT expire_unclaimed_receipts();
   ```

3. Check function logs in Supabase Dashboard

### Items Not Returning to Inventory

1. Check food_listings status:

   ```sql
   SELECT id, title, status FROM food_listings WHERE status = 'claimed';
   ```

2. Verify expiry function is updating listings:
   ```sql
   -- Check the function code
   SELECT prosrc FROM pg_proc WHERE proname = 'expire_unclaimed_receipts';
   ```

### Receipt Not Aggregating Multiple Claims

1. Verify claims are on same day:

   ```sql
   SELECT user_id, DATE(claimed_at), COUNT(*)
   FROM receipts
   WHERE status = 'pending'
   GROUP BY user_id, DATE(claimed_at);
   ```

2. Check ClaimFoodForm logic for existing receipt lookup

### "Reclaim" Button Not Working

1. Check if items are still available:

   ```sql
   SELECT fl.id, fl.title, fl.status
   FROM food_claims fc
   JOIN food_listings fl ON fc.food_id = fl.id
   WHERE fc.receipt_id = 'RECEIPT_ID';
   ```

2. Verify receiptService.reclaimExpiredItems() is called correctly

## Future Enhancements

1. **SMS Notifications**: Send reminders on Thursday before Friday deadline
2. **Email Receipts**: Email PDF receipt after claiming
3. **QR Codes**: Generate QR code for staff to scan on pickup
4. **Partial Pickup**: Allow marking individual items as picked up
5. **Pickup History**: Analytics dashboard for community managers
6. **Custom Deadlines**: Allow communities to set their own pickup windows

## Support

For issues or questions:

- Check Supabase Dashboard → Logs
- Review console errors in browser DevTools
- Check GitHub Issues for known problems
- Contact: support@dogoods.store
