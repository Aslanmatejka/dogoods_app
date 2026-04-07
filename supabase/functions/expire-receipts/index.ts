// Supabase Edge Function to expire old receipts
// Deploy with: supabase functions deploy expire-receipts
// Set up cron: https://supabase.com/docs/guides/functions/schedule-functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('Running receipt expiry check...')

    // Call the database function to expire receipts
    const { data, error } = await supabaseClient.rpc('expire_unclaimed_receipts')

    if (error) {
      console.error('Error expiring receipts:', error)
      throw error
    }

    const expiredCount = data || 0

    console.log(`Successfully expired ${expiredCount} receipts`)

    return new Response(
      JSON.stringify({
        success: true,
        expiredCount,
        message: `Expired ${expiredCount} receipt(s) and returned items to inventory`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Exception in expire-receipts function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

/* 
To set up automatic expiry (cron job):

1. Deploy this function:
   supabase functions deploy expire-receipts

2. Set up a cron trigger in Supabase Dashboard:
   - Go to Database > Functions > expire-receipts
   - Add a cron schedule: "0 17 * * 5" (Every Friday at 5:00 PM)
   - Or use pg_cron in SQL:

   SELECT cron.schedule(
     'expire-receipts-friday-5pm',
     '0 17 * * 5',  -- Every Friday at 5PM
     $$
     SELECT net.http_post(
       url:='https://YOUR_PROJECT.supabase.co/functions/v1/expire-receipts',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
     );
     $$
   );

3. Or set up in your deployment platform (e.g., Vercel Cron, Netlify Functions)
*/
