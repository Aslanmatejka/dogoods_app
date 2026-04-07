# Twilio SMS Integration Setup Guide

This guide explains how to set up Twilio SMS notifications for the DoGoods app.

## Overview

The DoGoods app uses Twilio to send SMS notifications for:
- **Claim Confirmations**: Sent to users when they successfully claim food
- **Donor Notifications**: Sent to food donors when their items are claimed
- **Pickup Reminders**: Sent to remind users about upcoming pickups
- **Verification Codes**: For phone number verification (optional)

## Prerequisites

1. A Twilio account (sign up at [twilio.com](https://www.twilio.com))
2. A Twilio phone number capable of sending SMS
3. Supabase project with Edge Functions enabled

## Setup Steps

### 1. Get Twilio Credentials

1. Log in to your [Twilio Console](https://console.twilio.com)
2. From the dashboard, copy your:
   - **Account SID** (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (click "View" to reveal)
3. Navigate to **Phone Numbers** > **Manage** > **Active Numbers**
4. Copy your Twilio phone number (e.g., `+1234567890`)

### 2. Configure Environment Variables

#### For Local Development (.env.local)

Add these variables to your `.env.local` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

#### For Supabase Edge Functions

Set the environment variables in your Supabase project:

```bash
# Using Supabase CLI
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here
supabase secrets set TWILIO_PHONE_NUMBER=+1234567890
```

Or via Supabase Dashboard:
1. Go to **Project Settings** > **Edge Functions**
2. Add each secret in the **Secrets** section

### 3. Deploy Edge Function

Deploy the Twilio SMS function to Supabase:

```bash
# Navigate to your project root
cd dogoods-app-ready-version2-master

# Deploy the send-sms function
supabase functions deploy send-sms

# Verify deployment
supabase functions list
```

### 4. Apply Database Migration

Run the migration to create the SMS logs table:

```bash
# Using Supabase CLI
supabase db push

# Or apply specific migration
supabase migration up 20260210_create_sms_logs_table
```

### 5. Test SMS Functionality

Test the SMS service with a simple script:

```javascript
// test-sms.js
import twilioService from './utils/twilioService.js';

async function testSMS() {
    try {
        const result = await twilioService.sendSMS({
            to: '+1234567890',  // Your test phone number
            message: 'Test message from DoGoods app!',
            type: 'notification'
        });
        console.log('SMS sent successfully:', result);
    } catch (error) {
        console.error('SMS test failed:', error);
    }
}

testSMS();
```

Run the test:
```bash
node test-sms.js
```

## Phone Number Requirements

### User Phone Numbers

Users must provide phone numbers in the following format:
- **US Numbers**: `+1234567890` or `(123) 456-7890` or `123-456-7890`
- **International**: Include country code (e.g., `+44 20 1234 5678`)

The system automatically formats phone numbers to E.164 format (`+1234567890`).

### Updating User Schema

Ensure users table has phone number field:

```sql
-- Add phone column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
```

## Usage in the App

### Sending Claim Confirmation

```javascript
import twilioService from './utils/twilioService';

await twilioService.sendClaimConfirmation({
    claimerPhone: user.phone,
    claimerName: user.name,
    foodTitle: 'Fresh Apples',
    pickupLocation: 'Ruby Bridges Elementary',
    pickupDeadline: 'February 15'
});
```

### Sending Donor Notification

```javascript
await twilioService.sendClaimNotification({
    donorPhone: donor.phone,
    donorName: donor.name,
    claimerName: claimer.name,
    foodTitle: 'Fresh Apples',
    pickupLocation: 'Ruby Bridges Elementary'
});
```

### Sending Pickup Reminder

```javascript
await twilioService.sendPickupReminder({
    claimerPhone: user.phone,
    claimerName: user.name,
    foodTitle: 'Fresh Apples',
    pickupLocation: 'Ruby Bridges Elementary',
    pickupTime: 'Friday, 3:30 PM'
});
```

## SMS Message Templates

### Claim Confirmation
```
Hi [Name], you've successfully claimed "[Food Title]"! Pick up at [Location] by [Deadline]. See you soon! - DoGoods
```

### Donor Notification
```
Hi [Donor], great news! [Claimer] has claimed your "[Food Title]". Pickup location: [Location]. Thank you for sharing! - DoGoods
```

### Pickup Reminder
```
Hi [Name], reminder: Pick up "[Food Title]" at [Location] by [Time]. Questions? Contact the community location. - DoGoods
```

## Cost Considerations

- **Twilio Pricing**: ~$0.0075 per SMS in the US (check current rates)
- **Free Trial**: Twilio provides trial credits for testing
- **Budget Planning**: Estimate based on expected usage
  - 100 claims/day = ~$0.75/day = ~$22.50/month

## Monitoring and Logs

### View SMS Logs in Database

```sql
-- Recent SMS messages
SELECT * FROM sms_logs 
ORDER BY sent_at DESC 
LIMIT 50;

-- SMS by type
SELECT type, COUNT(*), 
       COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM sms_logs 
GROUP BY type;

-- Failed messages
SELECT * FROM sms_logs 
WHERE status = 'failed' 
ORDER BY sent_at DESC;
```

### View Logs in Twilio Dashboard

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to **Monitor** > **Logs** > **Messaging**
3. View detailed delivery status for each SMS

## Troubleshooting

### SMS Not Sending

1. **Check credentials**: Verify environment variables are set correctly
2. **Check phone number**: Ensure Twilio number is active and SMS-enabled
3. **Check balance**: Ensure Twilio account has sufficient credits
4. **Check logs**: Review `sms_logs` table and Twilio console

### Invalid Phone Number Error

- Ensure phone numbers include country code
- Use E.164 format: `+1234567890`
- Check that numbers don't have invalid characters

### Edge Function Error

```bash
# View function logs
supabase functions logs send-sms

# Check function status
supabase functions list
```

## Security Best Practices

1. **Never commit credentials**: Keep Twilio credentials in environment variables
2. **Use secrets**: Store Auth Token in Supabase secrets, not in code
3. **Rate limiting**: Implement rate limits to prevent SMS abuse
4. **Validate inputs**: Always validate phone numbers before sending
5. **Log everything**: Track all SMS for debugging and compliance

## Additional Features

### Phone Number Verification

Add phone verification before allowing users to receive SMS:

```javascript
// Generate and send verification code
const code = Math.floor(100000 + Math.random() * 900000);
await twilioService.sendVerificationCode({
    phone: user.phone,
    code: code
});

// Store code in database with expiration
await supabase.from('verification_codes').insert({
    user_id: user.id,
    code: code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
});
```

### Scheduled Reminders

Set up scheduled reminders using Supabase cron jobs or external schedulers:

```sql
-- Find claims with pickups tomorrow
SELECT fc.*, u.phone, u.name, fl.title, c.name as community_name
FROM food_claims fc
JOIN users u ON fc.claimer_id = u.id
JOIN food_listings fl ON fc.food_listing_id = fl.id
JOIN communities c ON fl.community_id = c.id
WHERE fc.pickup_deadline::date = CURRENT_DATE + INTERVAL '1 day'
AND fc.status = 'pending'
AND u.phone IS NOT NULL;
```

## Support

For issues with Twilio integration:
1. Check Twilio documentation: https://www.twilio.com/docs
2. Review error messages in `sms_logs` table
3. Contact Twilio support if credentials/billing issues

For app-specific issues:
1. Check browser console for errors
2. Review Supabase function logs
3. Verify database schema is up to date
