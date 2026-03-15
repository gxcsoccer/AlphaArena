import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Only allow PATCH
    if (req.method !== 'PATCH') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      );
    }

    // Extract alert ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const alertId = pathParts[pathParts.length - 1];

    if (!alertId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Alert ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { status, targetPrice, notificationMethod, isRecurring, notes } = body;

    // Check if alert exists
    const { data: existingAlert, error: fetchError } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ success: false, error: 'Price alert not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      throw fetchError;
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      if (!['active', 'triggered', 'disabled', 'expired'].includes(status)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid status. Must be "active", "triggered", "disabled", or "expired"' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      updateData.status = status;
    }

    if (targetPrice !== undefined) {
      if (typeof targetPrice !== 'number' || targetPrice <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid targetPrice. Must be a positive number' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      updateData.target_price = targetPrice.toString();
    }

    if (notificationMethod !== undefined) {
      if (!['in_app', 'feishu', 'email', 'push'].includes(notificationMethod)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid notificationMethod. Must be "in_app", "feishu", "email", or "push"' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      updateData.notification_method = notificationMethod;
    }

    if (isRecurring !== undefined) {
      updateData.is_recurring = isRecurring;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Update the alert
    const { data: updatedAlert, error: updateError } = await supabase
      .from('price_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating price alert:', updateError);
      throw updateError;
    }

    // Format response
    const formattedAlert = {
      id: updatedAlert.id,
      userId: updatedAlert.user_id,
      symbol: updatedAlert.symbol,
      conditionType: updatedAlert.condition_type,
      targetPrice: parseFloat(updatedAlert.target_price),
      currentPrice: updatedAlert.current_price ? parseFloat(updatedAlert.current_price) : null,
      status: updatedAlert.status,
      notificationMethod: updatedAlert.notification_method,
      triggeredAt: updatedAlert.triggered_at,
      triggeredPrice: updatedAlert.triggered_price ? parseFloat(updatedAlert.triggered_price) : null,
      isRecurring: updatedAlert.is_recurring,
      notes: updatedAlert.notes,
      expiresAt: updatedAlert.expires_at,
      createdAt: updatedAlert.created_at,
      updatedAt: updatedAlert.updated_at,
    };

    return new Response(
      JSON.stringify({ success: true, data: formattedAlert }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in update-price-alert:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
