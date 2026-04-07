# Twilio SMS Integration - Quick Start

## What's Implemented

✅ **SMS Service** (`utils/twilioService.js`)
- Singleton service for sending SMS via Twilio
- Automatic phone number formatting to E.164 format
- Pre-built message templates for common notifications

✅ **Edge Function** (`supabase/functions/send-sms/index.ts`)
- Serverless function to securely send SMS via Twilio API
- Handles authentication and error logging
- Stores SMS logs in database

✅ **Database Migration** (`supabase/migrations/20260210_create_sms_logs_table.sql`)
- Creates `sms_logs` table for tracking sent messages
- Indexes for efficient querying

✅ **Claim Integration** (`pages/ClaimFoodForm.jsx`)
- Sends confirmation SMS to claimer
- Sends notification SMS to donor
- Graceful fallback if SMS fails

## Quick Setup (3 Steps)

### 1. Get Twilio Account
Sign up at [twilio.com](https://www.twilio.com/try-twilio) and get:
- Account SID
- Auth Token  
- Phone Number

### 2. Set Environment Variables

Add to `.env.local`:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

Set in Supabase:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxx...
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Deploy & Migrate

```bash
# Deploy Edge Function
supabase functions deploy send-sms

# Apply database migration
supabase db push
```

## Usage Examples

```javascript
import twilioService from './utils/twilioService';

// Send claim confirmation
await twilioService.sendClaimConfirmation({
    claimerPhone: '+1234567890',
    claimerName: 'John',
    foodTitle: 'Fresh Apples',
    pickupLocation: 'Ruby Bridges Elementary',
    pickupDeadline: 'February 15'
});

// Send custom SMS
await twilioService.sendSMS({
    to: '+1234567890',
    message: 'Your custom message here',
    type: 'notification'
});
```

## Message Types

1. **Claim Confirmation** - Sent to user when they claim food
2. **Donor Notification** - Sent to donor when food is claimed
3. **Pickup Reminder** - Sent before pickup deadline
4. **Verification Code** - For phone verification (optional)

## What Happens When Food is Claimed?

1. User clicks "Confirm Claim" button
2. Claim record created in database
3. Food listing status updated to "claimed"
4. **SMS sent to claimer** (if phone number provided)
5. **SMS sent to donor** (if phone number provided)
6. User redirected to dashboard
7. Toast notification shows success

## SMS Not Sending? Check:

- [ ] Twilio credentials set in Supabase secrets
- [ ] Edge function deployed: `supabase functions list`
- [ ] User has phone number in profile
- [ ] Phone number in E.164 format (+1234567890)
- [ ] Twilio account has credits
- [ ] Check logs: `SELECT * FROM sms_logs ORDER BY sent_at DESC;`

## Cost

- **Twilio SMS**: ~$0.0075 per message (US)
- **100 claims/day**: ~$22.50/month
- **Trial Account**: Free credits for testing

## Full Documentation

See [TWILIO_SETUP.md](TWILIO_SETUP.md) for complete setup guide, troubleshooting, and advanced features.

## Testing

Test SMS without claiming food:

```javascript
// In browser console
import twilioService from './utils/twilioService';

twilioService.sendSMS({
    to: '+1YOUR_PHONE',
    message: 'Test from DoGoods!',
    type: 'notification'
}).then(r => console.log('Sent!', r));
```

## Files Modified/Created

**New Files:**
- `utils/twilioService.js` - SMS service
- `supabase/functions/send-sms/index.ts` - Edge function
- `supabase/migrations/20260210_create_sms_logs_table.sql` - Database schema
- `TWILIO_SETUP.md` - Full documentation
- `TWILIO_README.md` - This quick start

**Modified Files:**
- `pages/ClaimFoodForm.jsx` - Added SMS notifications on claim
- `config/env.example` - Added Twilio env vars

## Next Steps

1. **Add Phone Number to Signup** - Collect user phone during registration
2. **Phone Verification** - Verify phone numbers with SMS codes
3. **Scheduled Reminders** - Send pickup reminders day before deadline
4. **Admin SMS** - Allow admins to send broadcasts to users
5. **Opt-in/Opt-out** - Let users control SMS preferences

## Support

- **Twilio Docs**: https://www.twilio.com/docs/sms
- **Supabase Functions**: https://supabase.com/docs/guides/functions
- **DoGoods Project**: Check project README for contact info
