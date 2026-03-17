-- Atomic increment functions for signal subscriptions
-- These functions ensure thread-safe counter updates

-- Function to atomically increment signals_received
CREATE OR REPLACE FUNCTION increment_signals_received(sub_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE signal_subscriptions
  SET signals_received = signals_received + 1,
      updated_at = NOW()
  WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment signals_executed and update total_pnl
CREATE OR REPLACE FUNCTION increment_signals_executed(sub_id UUID, pnl_value DECIMAL(20, 8))
RETURNS void AS $$
BEGIN
  UPDATE signal_subscriptions
  SET signals_executed = signals_executed + 1,
      total_pnl = total_pnl + pnl_value,
      updated_at = NOW()
  WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment executions_count for trading_signals
CREATE OR REPLACE FUNCTION increment_signal_executions(signal_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE trading_signals
  SET executions_count = executions_count + 1,
      updated_at = NOW()
  WHERE id = signal_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment views_count for trading_signals
CREATE OR REPLACE FUNCTION increment_signal_views(signal_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE trading_signals
  SET views_count = views_count + 1,
      updated_at = NOW()
  WHERE id = signal_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_signals_received(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_signals_executed(UUID, DECIMAL(20, 8)) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_signal_executions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_signal_views(UUID) TO authenticated;
