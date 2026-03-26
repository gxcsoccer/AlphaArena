-- Frontend Errors Table for APM
-- Stores frontend error reports for monitoring and analysis

CREATE TABLE IF NOT EXISTS frontend_errors (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    
    -- Error details
    message TEXT NOT NULL,
    error_name TEXT,
    stack TEXT,
    error_type TEXT NOT NULL DEFAULT 'javascript',
    severity TEXT NOT NULL DEFAULT 'medium',
    
    -- Context
    page TEXT NOT NULL,
    route TEXT,
    component_stack TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Environment
    url TEXT,
    user_agent TEXT,
    breadcrumbs JSONB DEFAULT '[]',
    
    -- Resolution status
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_error_type CHECK (error_type IN ('javascript', 'promise', 'react', 'resource', 'unknown'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_frontend_errors_created_at ON frontend_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_user_id ON frontend_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_session_id ON frontend_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_severity ON frontend_errors(severity);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_type ON frontend_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_page ON frontend_errors(page);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_resolved ON frontend_errors(resolved);

-- Enable RLS
ALTER TABLE frontend_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert for authenticated users (for error reporting)
CREATE POLICY "Allow insert for all users" ON frontend_errors
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow read for authenticated users (admin dashboard)
CREATE POLICY "Allow read for authenticated users" ON frontend_errors
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow update for authenticated users (resolve errors)
CREATE POLICY "Allow update for authenticated users" ON frontend_errors
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comment
COMMENT ON TABLE frontend_errors IS 'Frontend error reports for APM monitoring';
COMMENT ON COLUMN frontend_errors.error_type IS 'Type of error: javascript, promise, react, resource, unknown';
COMMENT ON COLUMN frontend_errors.severity IS 'Error severity: low, medium, high, critical';
COMMENT ON COLUMN frontend_errors.breadcrumbs IS 'Array of breadcrumb events leading up to the error';