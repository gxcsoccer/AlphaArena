/**
 * Broadcast Market Data Edge Function
 * 
 * Accepts market data via POST request and broadcasts to Supabase Realtime channels.
 * This replaces the Railway backend for real-time data broadcasting.
 * 
 * Usage:
 * ```
 * POST https://plnylmnckssnfpwznpwf.supabase.co/functions/v1/broadcast-market-data
 * Body: {
 *   type: 'orderbook:snapshot' | 'orderbook:delta' | 'market:tick' | 'trade',
 *   symbol: 'BTC-PERP' | 'ETH-PERP' | etc,
 *   data: { ... }
 * }
 * ```
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  type: "orderbook:snapshot" | "orderbook:delta" | "market:tick" | "trade";
  symbol: string;
  data: any;
  timestamp?: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: BroadcastRequest = await req.json();
    const { type, symbol, data, timestamp = Date.now() } = body;

    if (!type || !symbol || !data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, symbol, data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine channel and event based on type
    let channel: string;
    let event: string;
    let payload: any;

    switch (type) {
      case "orderbook:snapshot":
        channel = `orderbook:${symbol}`;
        event = "snapshot";
        payload = { data, timestamp };
        break;

      case "orderbook:delta":
        channel = `orderbook:${symbol}`;
        event = "delta";
        payload = { data, timestamp };
        break;

      case "market:tick":
        channel = `ticker:${symbol}`;
        event = "tick";
        payload = { data, timestamp };
        break;

      case "trade":
        channel = `trade:global`;
        event = "new";
        payload = { data, timestamp };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown broadcast type: ${type}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    console.log(`[Broadcast] Sending ${event} to ${channel}`);

    // Send broadcast via Supabase Realtime
    const realtimeChannel = supabase.channel(channel);
    
    // Wait for channel to be ready
    await new Promise<void>((resolve, reject) => {
      realtimeChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(`Subscription failed: ${status}`));
        }
      });
    });

    // Send the broadcast
    const result = await realtimeChannel.send({
      type: "broadcast",
      event,
      payload,
    });

    // Clean up channel
    await supabase.removeChannel(realtimeChannel);

    const isSuccess = result === "ok" || (result as any).status === "ok";

    if (isSuccess) {
      console.log(`[Broadcast] Successfully broadcast ${event} to ${channel}`);
      return new Response(
        JSON.stringify({
          success: true,
          channel,
          event,
          timestamp,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.error(`[Broadcast] Failed to broadcast:`, result);
      return new Response(
        JSON.stringify({ error: "Broadcast failed", details: result }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("[Broadcast] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
