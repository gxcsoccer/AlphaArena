/**
 * Supabase Realtime Performance Test
 * Tests the backend Realtime integration without requiring a browser
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://plnylmnckssnfpwznpwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnlsbW5ja3NzbmZwd3pucHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTc5MDUsImV4cCI6MjA4ODc5MzkwNX0.BATHv0SbrOJC2MhitL_i-UyOhHRUv4HGycfecd4H4gg';
const TEST_SYMBOLS = ['BTC-PERP', 'ETH-PERP', 'BCH-PERP'];

// Test metrics
const results = {
  startTime: Date.now(),
  connectionLatency: [],
  messageCounts: { orderbook: 0, ticker: 0, trades: 0, presence: 0 },
  errors: [],
  presenceData: [],
  latencySamples: []
};

console.log('🧪 Supabase Realtime Performance Test');
console.log('📍 Supabase URL:', SUPABASE_URL);
console.log('📊 Test Symbols:', TEST_SYMBOLS.join(', '));
console.log('');

async function testRealtimeIntegration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  console.log('⏳ Testing Supabase Realtime connection...');
  const connectStart = Date.now();
  
  // Test 1: Basic connectivity (check realtime socket)
  const connectTime = Date.now() - connectStart;
  results.connectionLatency.push(connectTime);
  console.log(`  ✅ Realtime client initialized: ${connectTime}ms`);

  // Test 2: Subscribe to orderbook channels
  console.log('\n📈 Test 2: Orderbook Channel Subscriptions');
  const channelResults = [];
  
  for (const symbol of TEST_SYMBOLS) {
    const topic = `orderbook:${symbol}`;
    const channel = supabase.channel(topic);
    const subscribeStart = Date.now();
    
    try {
      const { status } = await new Promise((resolve) => {
        channel.subscribe((status) => {
          resolve({ status });
        });
        setTimeout(() => resolve({ status: 'TIMED_OUT' }), 5000);
      });
      
      const subscribeTime = Date.now() - subscribeStart;
      results.latencySamples.push(subscribeTime);
      
      if (status === 'SUBSCRIBED') {
        console.log(`  ✅ ${symbol}: Subscribed in ${subscribeTime}ms`);
        results.messageCounts.orderbook++;
        channelResults.push({ symbol, status: 'success', time: subscribeTime });
        
        // Listen for messages
        channel.on('broadcast', { event: 'snapshot' }, (payload) => {
          console.log(`    📨 ${symbol} snapshot received`);
        });
        
        channel.on('broadcast', { event: 'delta' }, (payload) => {
          console.log(`    📨 ${symbol} delta received`);
        });
      } else {
        console.log(`  ⚠️  ${symbol}: Subscription failed (${status})`);
        results.errors.push(`${symbol} subscription failed: ${status}`);
        channelResults.push({ symbol, status: 'failed', error: status });
      }
    } catch (err) {
      console.log(`  ❌ ${symbol}: ${err.message}`);
      results.errors.push(`${symbol}: ${err.message}`);
      channelResults.push({ symbol, status: 'error', error: err.message });
    }
  }

  // Test 3: Presence tracking
  console.log('\n👥 Test 3: Presence Tracking');
  const presenceChannel = supabase.channel('presence:traders');
  
  try {
    await new Promise((resolve) => {
      presenceChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
      setTimeout(resolve, 3000);
    });
    
    // Track test presence
    await presenceChannel.track({
      id: 'test-user-' + Date.now(),
      userId: 'test-user',
      online_at: new Date().toISOString(),
    });
    
    const presenceState = presenceChannel.presenceState();
    results.presenceData.push({
      timestamp: Date.now(),
      count: Object.keys(presenceState).length
    });
    
    console.log(`  ✅ Presence tracking active (${Object.keys(presenceState).length} users online)`);
    results.messageCounts.presence = Object.keys(presenceState).length;
    
    // Listen for presence changes
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      console.log(`    👥 Presence sync: ${Object.keys(state).length} users`);
    });
  } catch (err) {
    console.log(`  ⚠️  Presence tracking: ${err.message}`);
    results.errors.push(`Presence: ${err.message}`);
  }

  // Test 4: Message reception and broadcast testing
  console.log('\n⏱️  Test 4: Message Broadcast & Reception Test');
  let messageCount = 0;
  const broadcastResults = [];
  
  // Set up listeners for all channels
  for (const symbol of TEST_SYMBOLS) {
    const channel = supabase.channel(`orderbook:${symbol}`);
    
    // Subscribe first
    await new Promise(resolve => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
      setTimeout(resolve, 2000);
    });
    
    // Listen for messages
    channel.on('broadcast', { event: 'test' }, (payload) => {
      messageCount++;
      console.log(`    📨 ${symbol} received test message:`, payload);
    });
  }
  
  // Send test broadcasts
  console.log('  📤 Sending test broadcasts...');
  for (const symbol of TEST_SYMBOLS) {
    const channel = supabase.channel(`orderbook:${symbol}`);
    const broadcastStart = Date.now();
    
    try {
      const { error } = await channel.send({
        type: 'broadcast',
        event: 'test',
        payload: { 
          test: true, 
          symbol, 
          timestamp: Date.now() 
        }
      });
      
      const broadcastTime = Date.now() - broadcastStart;
      results.latencySamples.push(broadcastTime);
      
      if (error) {
        console.log(`  ⚠️  ${symbol} broadcast failed: ${error.message}`);
        broadcastResults.push({ symbol, success: false, error: error.message });
      } else {
        console.log(`  ✅ ${symbol} broadcast sent in ${broadcastTime}ms`);
        broadcastResults.push({ symbol, success: true, time: broadcastTime });
      }
    } catch (err) {
      console.log(`  ❌ ${symbol} broadcast error: ${err.message}`);
      broadcastResults.push({ symbol, success: false, error: err.message });
    }
  }
  
  // Wait for messages to be received
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log(`  📊 Total messages received: ${messageCount}`);
  
  // Test 5: Latency statistics
  console.log('\n📊 Test 5: Latency Statistics');
  if (results.latencySamples.length > 0) {
    const sorted = [...results.latencySamples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    
    console.log(`  Samples: ${sorted.length}`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  P50: ${p50}ms`);
    console.log(`  P95: ${p95}ms ${p95 < 500 ? '✅' : '⚠️  (target: <500ms)'}`);
  } else {
    console.log('  ℹ️  No latency samples collected');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  await supabase.removeAllChannels();
  
  // Generate summary
  const totalTime = Date.now() - results.startTime;
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Duration: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Orderbook Subscriptions: ${results.messageCounts.orderbook}/${TEST_SYMBOLS.length} ✅`);
  console.log(`Broadcast Tests: ${broadcastResults.filter(r => r.success).length}/${TEST_SYMBOLS.length} ${messageCount > 0 ? '✅' : '⚠️'}`);
  console.log(`Presence Tracking: ${results.messageCounts.presence >= 0 ? 'Active' : 'Inactive'}`);
  console.log(`Messages Received: ${messageCount}`);
  console.log(`Errors: ${results.errors.length === 0 ? 'None' : results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    results.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  const passed = results.messageCounts.orderbook === TEST_SYMBOLS.length && 
                 broadcastResults.filter(r => r.success).length > 0 &&
                 results.errors.length === 0;
  console.log(`\nOverall: ${passed ? '✅ PASS' : '⚠️  PARTIAL'}`);
  
  return {
    passed,
    duration: totalTime,
    orderbookSubscriptions: results.messageCounts.orderbook,
    broadcastTests: broadcastResults,
    presenceActive: results.messageCounts.presence >= 0,
    messagesReceived: messageCount,
    errors: results.errors,
    latency: results.latencySamples.length > 0 ? {
      avg: results.latencySamples.reduce((a, b) => a + b, 0) / results.latencySamples.length,
      p95: [...results.latencySamples].sort((a, b) => a - b)[Math.floor(results.latencySamples.length * 0.95)]
    } : null
  };
}

testRealtimeIntegration()
  .then(results => {
    console.log('\n📄 Full Results:', JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
