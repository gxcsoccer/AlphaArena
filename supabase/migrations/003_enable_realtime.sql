-- Enable Realtime replication for tables
-- This allows Supabase Realtime to broadcast changes to these tables

ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE strategies;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_entries;

-- Add comments for documentation
COMMENT ON TABLE trades IS 'Realtime enabled for trade updates';
COMMENT ON TABLE portfolios IS 'Realtime enabled for portfolio updates';
COMMENT ON TABLE strategies IS 'Realtime enabled for strategy updates';
COMMENT ON TABLE leaderboard_entries IS 'Realtime enabled for leaderboard updates';
