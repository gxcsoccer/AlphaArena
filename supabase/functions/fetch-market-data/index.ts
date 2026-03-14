/**
 * Fetch and Broadcast Market Data Edge Function
 * 
 * Fetches real-time market data from OKX exchange and broadcasts to Supabase Realtime.
 * This replaces the Railway backend WebSocket service.
 * 
 * Can be triggered by:
 * - Supabase pg_cron (scheduled every few seconds)
 * - Manual HTTP request
 * - External webhook
 * 
 * Data sources:
 * - OKX WebSocket for real-time orderbook updates
 * - OKX REST API for ticker data
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OKX API endpoints
const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
const OKX_REST_API = "https://www.okx.com";

// Trading pairs to monitor
const SYMBOLS = ["BTC-USDT", "ETH-USDT", "BCH-USDT"];

// OKX returns arrays: [price, size, count, ...]
type OKXOrderBookLevel = [string, string, string, string];

interface OKXOrderBookData {
  asks: OKXOrderBookLevel[];
  bids: OKXOrderBookLevel[];
  ts: string;
}

interface BroadcastMessage {
  type: string;
  symbol: string;
  data: any;
  timestamp: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[MarketData] Fetch request received");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[MarketData] Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch orderbook data from OKX REST API
    // Note: For production, should use WebSocket for real-time updates
    // This is a simplified version using REST API
    const results: BroadcastMessage[] = [];

    for (const symbol of SYMBOLS) {
      try {
        // Fetch orderbook from OKX
        const orderbookUrl = `${OKX_REST_API}/api/v5/market/books?instId=${symbol}&sz=20`;
        console.log(`[MarketData] Fetching orderbook for ${symbol}`);
        
        const response = await fetch(orderbookUrl, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "AlphaArena/1.0",
          },
        });

        if (!response.ok) {
          console.warn(`[MarketData] Failed to fetch ${symbol}: ${response.status}`);
          continue;
        }

        const okxData = await response.json();
        
        if (okxData.code !== "0" || !okxData.data || okxData.data.length === 0) {
          console.warn(`[MarketData] Invalid response for ${symbol}`);
          continue;
        }

        const bookData: OKXOrderBookData = okxData.data[0];
        
        // Transform to our format (OKX returns arrays: [price, size, count, ...])
        const snapshot = {
          symbol: symbol.replace("-", "/"), // Convert BTC-USDT to BTC/USDT
          bids: bookData.bids.map((level) => ({
            price: parseFloat(level[0]),
            size: parseFloat(level[1]),
          })),
          asks: bookData.asks.map((level) => ({
            price: parseFloat(level[0]),
            size: parseFloat(level[1]),
          })),
          timestamp: parseInt(bookData.ts),
        };

        // Broadcast orderbook snapshot
        const channel = `orderbook:${snapshot.symbol}`;
        const realtimeChannel = supabase.channel(channel);

        await new Promise<void>((resolve, reject) => {
          realtimeChannel.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              reject(new Error(`Subscription failed: ${status}`));
            }
          });
        });

        const broadcastResult = await realtimeChannel.send({
          type: "broadcast",
          event: "snapshot",
          payload: {
            data: snapshot,
            timestamp: Date.now(),
          },
        });

        await supabase.removeChannel(realtimeChannel);

        const isSuccess = broadcastResult === "ok" || (broadcastResult as any).status === "ok";
        
        if (isSuccess) {
          console.log(`[MarketData] Broadcasted orderbook for ${snapshot.symbol}`);
          results.push({
            type: "orderbook:snapshot",
            symbol: snapshot.symbol,
            data: snapshot,
            timestamp: Date.now(),
          });
        } else {
          console.error(`[MarketData] Failed to broadcast ${snapshot.symbol}`);
        }
      } catch (error: any) {
        console.error(`[MarketData] Error processing ${symbol}:`, error.message);
      }
    }

    // Also fetch ticker data
    try {
      const tickerUrl = `${OKX_REST_API}/api/v5/market/tickers?instType=SWAP`;
      const tickerResponse = await fetch(tickerUrl, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AlphaArena/1.0",
        },
      });

      if (tickerResponse.ok) {
        const tickerData = await tickerResponse.json();
        
        if (tickerData.code === "0" && tickerData.data) {
          // Filter for our symbols
          for (const ticker of tickerData.data) {
            if (SYMBOLS.includes(ticker.instId)) {
              const symbol = ticker.instId.replace("-", "/");
              const channel = `ticker:${symbol}`;
              const realtimeChannel = supabase.channel(channel);

              await new Promise<void>((resolve, reject) => {
                realtimeChannel.subscribe((status) => {
                  if (status === "SUBSCRIBED") resolve();
                  else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    reject(new Error(`Subscription failed: ${status}`));
                  }
                });
              });

              const tickerPayload = {
                symbol,
                last: parseFloat(ticker.last || "0"),
                bid: parseFloat(ticker.bidPx || "0"),
                ask: parseFloat(ticker.askPx || "0"),
                volume24h: parseFloat(ticker.vol24h || "0"),
                change24h: parseFloat(ticker.sodUtc24h || "0"),
                timestamp: Date.now(),
              };

              const broadcastResult = await realtimeChannel.send({
                type: "broadcast",
                event: "tick",
                payload: {
                  data: tickerPayload,
                  timestamp: Date.now(),
                },
              });

              await supabase.removeChannel(realtimeChannel);

              const isSuccess = broadcastResult === "ok" || (broadcastResult as any).status === "ok";
              
              if (isSuccess) {
                console.log(`[MarketData] Broadcasted ticker for ${symbol}`);
                results.push({
                  type: "market:tick",
                  symbol,
                  data: tickerPayload,
                  timestamp: Date.now(),
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("[MarketData] Error fetching tickers:", error.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        broadcasts: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[MarketData] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
