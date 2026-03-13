/**
 * Test Script for Issue #72: Supabase Realtime Authentication
 * 
 * This script tests:
 * 1. Supabase client initialization with anon key
 * 2. Realtime channel subscription
 * 3. Broadcast functionality
 * 
 * Run with: node tests/test-realtime-auth.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://plnylmnckssnfpwznpwf.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ';

console.log('🧪 Testing Supabase Realtime Authentication\n');
console.log('URL:', SUPABASE_URL);
console.log('Key (first 50 chars):', SUPABASE_ANON_KEY.substring(0, 50) + '...\n');

async function testRealtimeAuth() {
  const results = {
    clientCreation: false,
    restApiTest: false,
    realtimeSubscription: false,
    broadcast: false,
  };

  try {
    // Test 1: Create Supabase client
    console.log('📝 Test 1: Creating Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    results.clientCreation = true;
    console.log('✅ Client created successfully\n');

    // Test 2: Test REST API access
    console.log('📝 Test 2: Testing REST API access...');
    try {
      const { data, error } = await supabase
        .from('_nonexistent_table')
        .select('*')
        .limit(1);
      
      if (error) {
        // Expected: table doesn't exist, but auth should work
        if (error.code === '42P01') {
          console.log('✅ REST API authentication works (table not found is expected)\n');
          results.restApiTest = true;
        } else {
          console.log('⚠️  REST API error:', error.message, '\n');
        }
      } else {
        console.log('✅ REST API works\n');
        results.restApiTest = true;
      }
    } catch (error) {
      console.log('❌ REST API test failed:', error.message, '\n');
    }

    // Test 3: Subscribe to Realtime channel
    console.log('📝 Test 3: Testing Realtime subscription...');
    const channel = supabase.channel('test:issue-72');
    
    const subscriptionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Subscription timeout (10s)'));
      }, 10000);

      channel.subscribe((status) => {
        clearTimeout(timeout);
        console.log('   Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          results.realtimeSubscription = true;
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Subscription failed: ${status}`));
        }
      });
    });

    try {
      await subscriptionPromise;
      console.log('✅ Realtime subscription successful\n');
    } catch (error) {
      console.log('❌ Realtime subscription failed:', error.message, '\n');
      throw error;
    }

    // Test 4: Test broadcast
    console.log('📝 Test 4: Testing broadcast functionality...');
    const broadcastResult = await channel.send({
      type: 'broadcast',
      event: 'test',
      payload: { message: 'Issue #72 test', timestamp: Date.now() },
    });

    console.log('   Broadcast result:', broadcastResult);
    if (broadcastResult === 'ok' || broadcastResult.status === 'ok') {
      results.broadcast = true;
      console.log('✅ Broadcast successful\n');
    } else {
      console.log('⚠️  Broadcast returned:', broadcastResult, '\n');
    }

    // Cleanup
    console.log('🧹 Cleaning up...');
    await supabase.removeChannel(channel);
    console.log('   Channel removed\n');

  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('Client Creation:     ', results.clientCreation ? '✅ PASS' : '❌ FAIL');
  console.log('REST API Test:       ', results.restApiTest ? '✅ PASS' : '❌ FAIL');
  console.log('Realtime Subscription:', results.realtimeSubscription ? '✅ PASS' : '❌ FAIL');
  console.log('Broadcast:           ', results.broadcast ? '✅ PASS' : '❌ FAIL');
  console.log('='.repeat(50));
  
  const allPassed = Object.values(results).every(r => r === true);
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Realtime authentication is working.\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED. Check the errors above.\n');
    console.log('💡 Troubleshooting:');
    console.log('   1. Verify SUPABASE_ANON_KEY is correct (from Supabase Dashboard → Settings → API)');
    console.log('   2. Check that Realtime is enabled (Database → Replication)');
    console.log('   3. Ensure the key has not expired');
    console.log('   4. Check Supabase project status and logs\n');
    process.exit(1);
  }
}

// Run the test
testRealtimeAuth().catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});
