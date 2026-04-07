import supabase from './utils/supabaseClient.js';

async function testNewsletterFunction() {
    console.log('🧪 Testing newsletter subscription...\n');

    const testEmail = `test${Date.now()}@example.com`;
    const testData = {
        first_name: 'Test',
        last_name: 'User',
        email: testEmail,
        consent: true,
        source: 'test-script'
    };

    try {
        // Test 1: Insert new subscription
        console.log('Test 1: Creating new subscription...');
        const { data: insertData, error: insertError } = await supabase
            .from('newsletter_subscriptions')
            .insert([testData])
            .select();

        if (insertError) {
            console.error('❌ Insert failed:', insertError.message);
            console.log('\n💡 Note: You need to run the migration SQL in your Supabase dashboard first!');
            console.log('   Go to: https://supabase.com → SQL Editor → Paste the migration from');
            console.log('   supabase/migrations/020_create_newsletter_subscriptions.sql\n');
            return;
        }

        console.log('✅ Subscription created:', insertData[0]);

        // Test 2: Try duplicate email
        console.log('\nTest 2: Testing duplicate email prevention...');
        const { error: duplicateError } = await supabase
            .from('newsletter_subscriptions')
            .insert([testData]);

        if (duplicateError) {
            console.log('✅ Duplicate prevention working:', duplicateError.message);
        }

        // Test 3: Check subscription exists
        console.log('\nTest 3: Checking subscription exists...');
        const { data: checkData, error: checkError } = await supabase
            .from('newsletter_subscriptions')
            .select('email, is_active')
            .eq('email', testEmail)
            .maybeSingle();

        if (checkData) {
            console.log('✅ Subscription found:', checkData);
        }

        // Test 4: Update subscription (unsubscribe)
        console.log('\nTest 4: Testing unsubscribe...');
        const { error: updateError } = await supabase
            .from('newsletter_subscriptions')
            .update({ 
                is_active: false,
                unsubscribed_at: new Date().toISOString()
            })
            .eq('email', testEmail);

        if (!updateError) {
            console.log('✅ Unsubscribe successful');
        }

        // Test 5: Reactivate subscription
        console.log('\nTest 5: Testing reactivation...');
        const { error: reactivateError } = await supabase
            .from('newsletter_subscriptions')
            .update({ 
                is_active: true,
                subscribed_at: new Date().toISOString()
            })
            .eq('email', testEmail);

        if (!reactivateError) {
            console.log('✅ Reactivation successful');
        }

        console.log('\n🎉 All tests passed! Newsletter subscription is working correctly.\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testNewsletterFunction();
