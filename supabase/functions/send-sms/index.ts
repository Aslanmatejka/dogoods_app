import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmsRequest {
  to: string
  message: string
  type?: 'claim' | 'reminder' | 'verification' | 'notification'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, message, type = 'notification' }: SmsRequest = await req.json()

    // Validate inputs
    if (!to || !message) {
      throw new Error('Missing required fields: to and message')
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(to.replace(/[\s()-]/g, ''))) {
      throw new Error('Invalid phone number format')
    }

    // Get Twilio credentials from environment variables
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured')
    }

    // Format phone number (remove spaces, dashes, parentheses)
    const formattedTo = to.replace(/[\s()-]/g, '')
    
    // Create Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
    
    const body = new URLSearchParams({
      To: formattedTo,
      From: twilioPhoneNumber,
      Body: message,
    })

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!twilioResponse.ok) {
      const error = await twilioResponse.json()
      throw new Error(`Twilio API error: ${error.message || twilioResponse.statusText}`)
    }

    const twilioData = await twilioResponse.json()

    // Log SMS sent to database for tracking
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient.from('sms_logs').insert({
      phone_number: formattedTo,
      message: message,
      type: type,
      status: 'sent',
      twilio_sid: twilioData.sid,
      sent_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        status: twilioData.status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending SMS:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
