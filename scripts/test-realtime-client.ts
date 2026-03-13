/**
 * Test script for Supabase Realtime Client
 * 
 * This script tests the frontend RealtimeClient by:
 * 1. Subscribing to orderbook channels
 * 2. Subscribing to ticker channels
 * 3. Listening for broadcast events
 * 4. Testing presence tracking
 * 
 * Run with: npx tsx scripts/test-realtime-client.ts
 */

import { RealtimeClient } from '../src/client/utils/realtime';

async function testRealtimeClient() {
  console.log('🧪 Testing Supabase Realtime Client...\n');

  const client = new RealtimeClient();

  try {
    // Test 1: Connect
    console.log('📡 Test 1: Connecting to Supabase Realtime...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Test 2: Subscribe to orderbook channel
    console.log('📊 Test 2: Subscribing to orderbook:BTC/USDT...');
    await client.subscribeOrderBook('BTC/USDT');
    console.log('✅ Subscribed to orderbook channel\n');

    // Test 3: Listen for orderbook updates
    console.log('👂 Test 3: Listening for orderbook updates...');
    const unsubscribeSnapshot = client.onOrderBookSnapshot('BTC/USDT', (snapshot) => {
      console.log('📥 Received orderbook snapshot:', {
        bids: snapshot.bids?.length || 0,
        asks: snapshot.asks?.length || 0,
        timestamp: new Date(snapshot.timestamp).toISOString(),
      });
    });

    const unsubscribeDelta = client.onOrderBookDelta('BTC/USDT', (delta) => {
      console.log('📥 Received orderbook delta:', {
        timestamp: new Date(delta.timestamp).toISOString(),
      });
    });
    console.log('✅ Listening for orderbook events\n');

    // Test 4: Subscribe to ticker channel
    console.log('📈 Test 4: Subscribing to ticker:BTC/USDT...');
    await client.subscribe('ticker:BTC/USDT');
    console.log('✅ Subscribed to ticker channel\n');

    // Test 5: Listen for ticker updates
    console.log('👂 Test 5: Listening for ticker updates...');
    const unsubscribeTicker = client.onMarketTick('BTC/USDT', (ticker) => {
      console.log('📥 Received ticker update:', {
        symbol: ticker.symbol,
        price: ticker.price,
        change24h: ticker.priceChange24h,
        timestamp: new Date(ticker.timestamp).toISOString(),
      });
    });
    console.log('✅ Listening for ticker events\n');

    // Test 6: Test presence tracking
    console.log('👤 Test 6: Testing presence tracking...');
    await client.trackPresence('test-user-123', {
      testMode: true,
      joinedAt: new Date().toISOString(),
    });
    console.log('✅ Presence tracked\n');

    // Test 7: Get presence state
    console.log('👥 Test 7: Getting presence state...');
    const presenceState = client.getPresenceState();
    console.log('✅ Presence state:', Object.keys(presenceState).length, 'channels\n');

    // Wait for some real-time events
    console.log('⏳ Waiting 10 seconds for real-time events...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Cleanup
    console.log('🧹 Cleaning up...');
    unsubscribeSnapshot();
    unsubscribeDelta();
    unsubscribeTicker();
    await client.unsubscribe('orderbook:BTC/USDT');
    await client.unsubscribe('ticker:BTC/USDT');
    await client.unsubscribe('presence:traders');
    client.disconnect();
    console.log('✅ Cleanup complete\n');

    console.log('🎉 All tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    client.disconnect();
    process.exit(1);
  }
}

// Run the test
testRealtimeClient();
