import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DonationSchedule {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_donation_date: string;
  reminder_enabled: boolean;
  reminder_days_before: number;
  status: string;
}

function calculateNextDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
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

    const today = new Date().toISOString().split('T')[0];

    const schedulesResponse = await fetch(
      `${supabaseUrl}/rest/v1/donation_schedules?status=eq.active&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!schedulesResponse.ok) {
      throw new Error('Failed to fetch schedules');
    }

    const schedules: DonationSchedule[] = await schedulesResponse.json();

    const results = {
      remindersCreated: 0,
      donationsProcessed: 0,
      errors: [] as string[]
    };

    for (const schedule of schedules) {
      try {
        const nextDonationDate = new Date(schedule.next_donation_date);
        const todayDate = new Date(today);
        const daysUntil = Math.ceil((nextDonationDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        if (schedule.reminder_enabled && daysUntil === schedule.reminder_days_before) {
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
                user_id: schedule.user_id,
                type: 'donation_reminder',
                title: 'Upcoming Donation',
                message: `Your donation of $${schedule.amount} for "${schedule.title}" is scheduled for ${schedule.next_donation_date}`,
                read: false
              })
            }
          );

          if (notificationResponse.ok) {
            results.remindersCreated++;
          }
        }

        if (daysUntil <= 0) {
          const newNextDate = calculateNextDate(schedule.next_donation_date, schedule.frequency);

          const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/donation_schedules?id=eq.${schedule.id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                next_donation_date: newNextDate,
                last_processed_at: new Date().toISOString(),
                total_donated: Number(schedule.amount),
                donation_count: 1
              })
            }
          );

          if (updateResponse.ok) {
            await fetch(
              `${supabaseUrl}/rest/v1/donation_history`,
              {
                method: 'POST',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  schedule_id: schedule.id,
                  user_id: schedule.user_id,
                  amount: schedule.amount,
                  status: 'pending',
                  processed_at: new Date().toISOString()
                })
              }
            );

            results.donationsProcessed++;
          }
        }
      } catch (error) {
        results.errors.push(`Error processing schedule ${schedule.id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: schedules.length,
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
    console.error('Error processing donation schedules:', error);

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
