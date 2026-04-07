# ⚠️ URGENT: Supabase Email Template Must Be Updated

## Current Issue

You're not receiving the 6-digit code in password reset emails because the Supabase email template hasn't been updated yet.

## How to Fix (Step-by-Step with Screenshots)

### Step 1: Login to Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/ifzbpqyuhnxbhdcnmvfs
2. Login with your Supabase credentials

### Step 2: Navigate to Email Templates
1. In the left sidebar, click **"Authentication"**
2. Scroll down and click **"Email Templates"** 
3. You'll see a list of email templates

### Step 3: Edit the Reset Password Template
1. Find and click on **"Reset Password"** template
2. You'll see the current template content (probably has `{{ .ConfirmationURL }}`)

### Step 4: Replace the Template Content

**DELETE the existing template and PASTE this new version:**

```html
<h2>Reset Your Password</h2>

<p>Hello,</p>

<p>You requested to reset your password for your DoGoods account.</p>

<p><strong>Your password reset code is:</strong></p>

<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
    <h1 style="font-size: 48px; letter-spacing: 8px; font-family: 'Courier New', monospace; color: #059669; margin: 0;">{{ .Token }}</h1>
</div>

<p>Enter this <strong>6-digit code</strong> on the password reset page within the next hour.</p>

<p><strong>Important:</strong> This code expires in 1 hour. If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>

<p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
If you're having trouble, contact us at support@dogoods.store
</p>

<p style="color: #6b7280; font-size: 14px;">
Thanks,<br>
The DoGoods Team
</p>
```

### Step 5: Save the Template
1. Scroll to the bottom of the template editor
2. Click the **"Save"** button (usually green/blue button)
3. Wait for the confirmation message "Template saved successfully"

### Step 6: Test the Fix
1. Go to https://dogoods.store/forgot-password
2. Enter your email address
3. Check your email - you should now see a **6-digit code** like: `123456`
4. Enter that code on the website
5. Set your new password

## What Changed?

**Before (broken):**
- Template had: `{{ .ConfirmationURL }}` (magic link)
- Email scanners clicked the link before you could
- Result: `otp_expired` error

**After (fixed):**
- Template now has: `{{ .Token }}` (6-digit code)  
- Email scanners can't use a code (needs manual entry)
- Result: Works reliably ✅

## If You Don't Have Dashboard Access

If you don't have access to the Supabase Dashboard, you need to:

1. Ask the project owner/admin to make this change
2. Or get admin access to the Supabase project
3. Share this file with them: `EMAIL_TEMPLATE_UPDATE_REQUIRED.md`

## Verification

After updating the template:
- Request a password reset
- You should receive an email with a **large 6-digit code**
- The code should be clearly displayed (not a clickable link)
- Enter the code on the website to proceed

## The Critical Line

The most important part of the template is:

```html
<h1>{{ .Token }}</h1>
```

This displays the 6-digit OTP code. Without this line, you won't receive the code in the email.

## Need Help?

If you're still not receiving codes after updating the template:
1. Check your spam/junk folder
2. Verify the template was saved (refresh and check it's still there)
3. Try a different email address
4. Check Supabase Dashboard → Authentication → Logs for any errors
