import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PickupReminder {
  claim_id: string;
  claimer_id: string;
  food_id: string;
  pickup_date: string;
  pickup_time: string;
  pickup_place: string;
  reminder_hours_before: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const pickupsResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_pickups_needing_reminders`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!pickupsResponse.ok) {
      throw new Error('Failed to fetch pickups needing reminders');
    }

    const pickups: PickupReminder[] = await pickupsResponse.json();

    const results = {
      remindersCreated: 0,
      errors: [] as string[]
    };

    for (const pickup of pickups) {
      try {
        const pickupDateTime = `${pickup.pickup_date} ${pickup.pickup_time || '12:00:00'}`;
        const pickupDate = new Date(pickupDateTime);
        const formattedDate = pickupDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedTime = pickup.pickup_time ? 
          new Date(`2000-01-01 ${pickup.pickup_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }) : 'TBD';

        const hoursUntil = pickup.reminder_hours_before;
        const reminderText = hoursUntil === 24 ? 'tomorrow' : `in ${hoursUntil} hours`;

        const notificationResponse = await fetch(
          `${supabaseUrl}/rest/v1/notifications`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              user_id: pickup.claimer_id,
              type: 'pickup_reminder',
              title: 'Pickup Reminder',
              message: `Don't forget! Your food pickup is scheduled for ${formattedDate} at ${formattedTime}${pickup.pickup_place ? ` at ${pickup.pickup_place}` : ''}.`,
              read: false,
              data: {
                claim_id: pickup.claim_id,
                food_id: pickup.food_id,
                pickup_date: pickup.pickup_date,
                pickup_time: pickup.pickup_time,
                pickup_place: pickup.pickup_place
              }
            })
          }
        );

        if (notificationResponse.ok) {
          const markSentResponse = await fetch(
            `${supabaseUrl}/rest/v1/rpc/mark_reminder_sent`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ claim_uuid: pickup.claim_id })
            }
          );

          if (markSentResponse.ok) {
            results.remindersCreated++;
          } else {
            results.errors.push(`Failed to mark reminder as sent for claim ${pickup.claim_id}`);
          }
        } else {
          results.errors.push(`Failed to create notification for claim ${pickup.claim_id}`);
        }
      } catch (error) {
        results.errors.push(`Error processing pickup ${pickup.claim_id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: pickups.length,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error processing pickup reminders:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500
      }
    );
  }
});