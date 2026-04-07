# Supabase Production Configuration Required

## Password Reset Not Working - Fix (OTP_EXPIRED Error)

**Problem**: Email link scanners (antivirus/security software) consume password reset tokens before you can use them, causing `otp_expired` errors.

**Solution**: Switch from magic links to OTP (6-digit code) verification.

The password reset feature requires email template configuration in your Supabase Dashboard.

### Steps to Configure:

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/ifzbpqyuhnxbhdcnmvfs
   - Project ID: `ifzbpqyuhnxbhdcnmvfs`

2. **Navigate to Authentication Settings**
   - Click **Authentication** in the left sidebar
   - Click **URL Configuration**

3. **Configure URLs**

   **Site URL:** (this is where users start from)
   ```
   https://dogoods.store
   ```

   **Redirect URLs:** (add ALL of these to the list)
   ```
   https://dogoods.store
   https://dogoods.store/reset-password
   https://dogoods.store/login
   https://dogoods.store/email-confirmation
   ```

4. **Update Email Template for OTP (CRITICAL)**
   - Click **Authentication** → **Email Templates**
   - Select **"Reset Password"** template
   - **Replace** the template content with OTP-based version:

   ```html
   <h2>Reset Your Password</h2>
   <p>Hi there,</p>
   <p>You requested to reset your password for DoGoods.</p>
   <p>Your password reset code is:</p>
   <h1 style="font-size: 32px; letter-spacing: 5px; font-family: monospace;">{{ .Token }}</h1>
   <p>Enter this 6-digit code on the password reset page. The code expires in 1 hour.</p>
   <p>If you didn't request this, please ignore this email.</p>
   <p>Thanks,<br>DoGoods Team</p>
   ```

   **Important**: Use `{{ .Token }}` (the 6-digit code) instead of `{{ .ConfirmationURL }}` (magic link) to avoid link scanner issues.

5. **Save Email Template**
   - Click **Save** at the bottom of the email template editor

6. **Save URL Configuration Changes**
   - Go back to **URL Configuration**
   - Click the **Save** button
   - Wait for confirmation

### How to Test After Configuration:

1. Go to https://dogoods.store/forgot-password
2. Enter your email address
3. Click "Send reset link"
4. Check your email inbox (and spam folder) for the **6-digit code**
5. Enter the 6-digit code on the password reset page
6. After successful verification, you'll be taken to the password reset form
7. Enter your new password
8. You'll be redirected to /login with a success message

### If Emails Aren't Arriving:

1. Check spam/junk folder
2. In Supabase Dashboard → **Authentication** → **Email Templates**:
   - Verify the "Reset Password" template is active
   - **Must use** `{{ .Token }}` for the 6-digit code (NOT `{{ .ConfirmationURL }}`)
3. Check **Authentication** → **Settings** → **SMTP Settings**:
   - If using custom SMTP, verify credentials
   - If using Supabase's default, it should work automatically

### Why OTP Instead of Magic Links?

Magic links (`{{ .ConfirmationURL }}`) get consumed by email security scanners before you can click them, causing `otp_expired` errors. OTP codes (`{{ .Token }}`) can't be consumed by scanners and work reliably.

### Current Status:

- ✅ Code updated to support OTP (6-digit code) verification
- ✅ ForgotPasswordPage displays OTP input form after email sent
- ✅ ResetPasswordPage handles verified sessions from OTP flow
- ✅ Local development config (`supabase/config.toml`) includes correct URLs
- ⚠️ **PRODUCTION Dashboard email template needs updating** to use `{{ .Token }}` (see step 4 above)
- ⚠️ **PRODUCTION Dashboard redirect URLs need configuration** (see step 3 above)

### Related Files:

- `utils/authService.js` - Calls `resetPasswordForEmail()` 
- `pages/ForgotPasswordPage.jsx` - Request reset email, then display OTP verification form
- `pages/ResetPasswordPage.jsx` - Form to set new password after OTP verification
- `supabase/config.toml` - Local development only (doesn't affect production)

### Technical Details:

**Old flow (broken by link scanners)**:
1. User enters email → receives magic link
2. Email scanner clicks link → token consumed
3. User clicks link → gets `otp_expired` error

**New flow (scanner-proof)**:
1. User enters email → receives 6-digit code
2. Email scanner can't use the code (needs manual entry)
3. User enters code → gets verified session → resets password
