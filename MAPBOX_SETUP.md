# Mapbox Setup Guide

## Getting Your Mapbox Access Token

The food map feature requires a Mapbox access token. Follow these steps to get one:

### 1. Create a Mapbox Account

1. Go to [https://www.mapbox.com/](https://www.mapbox.com/)
2. Click "Sign up" and create a free account
3. Verify your email address

### 2. Get Your Access Token

1. After logging in, you'll be redirected to your account page
2. Your default public token will be displayed on the dashboard
3. Or navigate to: Account → Tokens
4. Copy your "Default public token" (starts with `pk.`)

### 3. Add Token to Your Project

#### For Local Development:

Add to your `.env.local` file:

```
VITE_MAPBOX_TOKEN=pk.your_actual_token_here
```

#### For Production:

Add the environment variable to your hosting platform:

- **Vercel**: Settings → Environment Variables
- **Netlify**: Site settings → Build & deploy → Environment
- **Other platforms**: Add `VITE_MAPBOX_TOKEN` to your environment variables

### 4. Token Security

- ✅ **Public tokens (pk.)** are safe to use in client-side code
- ✅ They are restricted by URL referrers you specify in Mapbox settings
- ✅ Free tier includes 50,000 map loads per month
- ⚠️ Never commit tokens to Git (use .env files)

### 5. Optional: Restrict Token Usage

1. In Mapbox dashboard, go to your token
2. Under "URL restrictions", add your domains:
   - `http://localhost:*` (for development)
   - `https://yourdomain.com` (for production)
3. Save changes

## Features Enabled

- Interactive map showing available food locations
- Real-time markers for active food listings
- Click markers to see food details
- Signup prompt for non-authenticated users
- Automatic user geolocation (with permission)

## Troubleshooting

### Map not loading?

1. Check browser console for errors
2. Verify token is correctly set in environment
3. Ensure token starts with `pk.`
4. Check URL restrictions in Mapbox dashboard

### No markers showing?

1. Ensure food listings have latitude/longitude data
2. Check that listings have status='available'
3. Verify Supabase connection is working

## Free Tier Limits

- 50,000 map loads/month
- 50,000 geocoding requests/month
- Plenty for most community food sharing apps!

For more information, visit [Mapbox Documentation](https://docs.mapbox.com/)
