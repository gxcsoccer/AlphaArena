/**
 * Supabase Realtime Connection Test
 * 
 * This script tests the Supabase Realtime connection and broadcast functionality.
 * Run with: npx ts-node scripts/test-realtime.ts
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plnylmnckssnfpwznpwf.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnlsbW5ja3NzbmZwd3pucHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTc5MDUsImV4cCI6MjA4ODc5MzkwNX0.BATHv0SbrOJC2MhitL_i-UyOhHRUv4HGycfecd4H4gg';

console.log('[Test] Supabase Realtime Connection Test');
console.log('[Test] URL:', SUPABASE_URL);

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBroadcast() {
  console.log('\n[Test] Testing Broadcast functionality...');
  
  // Create a test channel
  const channelName = 'test:broadcast';
  const channel: RealtimeChannel = supabase.channel(channelName);
  
  let receivedMessage = false;
  let subscribeComplete = false;
  
  // Subscribe to broadcast messages
  channel.on('broadcast', { event: 'test' }, (payload) => {
    console.log('[Test] ✓ Received broadcast:', payload);
    receivedMessage = true;
  });
  
  // Subscribe to the channel
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      console.log('[Test] Channel status:', status);
      if (status === 'SUBSCRIBED') {
        subscribeComplete = true;
        resolve();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Test] ✗ Channel subscription error');
        resolve();
      }
    });
  });
  
  if (!subscribeComplete) {
    console.error('[Test] ✗ Failed to subscribe to channel');
    return false;
  }
  
  console.log('[Test] ✓ Channel subscribed successfully');
  
  // Send a test broadcast
  console.log('[Test] Sending test broadcast...');
  const testPayload = {
    message: 'Hello from Realtime!',
    timestamp: Date.now(),
    data: { test: true }
  };
  
  const response = await channel.send({
    type: 'broadcast',
    event: 'test',
    payload: testPayload
  });
  
  console.log('[Test] Send response:', response);
  
  console.log('[Test] ✓ Broadcast sent successfully');
  
  // Wait a bit for the message to be received
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Cleanup
  await supabase.removeChannel(channel);
  console.log('[Test] ✓ Channel removed');
  
  return receivedMessage;
}

async function testPresence() {
  console.log('\n[Test] Testing Presence functionality...');
  
  const channelName = 'test:presence';
  const channel: RealtimeChannel = supabase.channel(channelName);
  
  let presenceSynced = false;
  
  // Track presence changes
  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel.presenceState();
    console.log('[Test] Presence state:', presenceState);
    presenceSynced = true;
  });
  
  // Subscribe with presence
  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track this client's presence
        await channel.track({ online_at: new Date().toISOString() });
        console.log('[Test] ✓ Presence tracked');
        resolve();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Test] ✗ Presence channel error');
        resolve();
      }
    });
  });
  
  // Wait for presence sync
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Cleanup
  await supabase.removeChannel(channel);
  
  return presenceSynced;
}

async function runTests() {
  console.log('\n========================================');
  console.log('Starting Supabase Realtime Tests');
  console.log('========================================\n');
  
  try {
    // Test 1: Broadcast
    const broadcastOk = await testBroadcast();
    console.log(`\n[Test] Broadcast test: ${broadcastOk ? '✓ PASSED' : '✗ FAILED'}`);
    
    // Test 2: Presence
    const presenceOk = await testPresence();
    console.log(`\n[Test] Presence test: ${presenceOk ? '✓ PASSED' : '✗ FAILED'}`);
    
    console.log('\n========================================');
    console.log('Tests Complete');
    console.log('========================================');
    
    if (broadcastOk && presenceOk) {
      console.log('\n✓ All tests passed! Supabase Realtime is working correctly.\n');
      process.exit(0);
    } else {
      console.log('\n✗ Some tests failed. Check the logs above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n[Test] ✗ Test execution error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
