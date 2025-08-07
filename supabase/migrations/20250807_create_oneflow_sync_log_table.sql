-- Create oneflow_sync_log table for webhook event logging
CREATE TABLE IF NOT EXISTS oneflow_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  oneflow_contract_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'verified', 'processed', 'error')),
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_oneflow_sync_log_contract_id ON oneflow_sync_log(oneflow_contract_id);
CREATE INDEX idx_oneflow_sync_log_created_at ON oneflow_sync_log(created_at DESC);
CREATE INDEX idx_oneflow_sync_log_status ON oneflow_sync_log(status);
CREATE INDEX idx_oneflow_sync_log_event_type ON oneflow_sync_log(event_type);

-- Add RLS policies
ALTER TABLE oneflow_sync_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read logs
CREATE POLICY "Users can view webhook logs" ON oneflow_sync_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role to insert logs (for webhook handler)
CREATE POLICY "Service role can insert webhook logs" ON oneflow_sync_log
  FOR INSERT
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE oneflow_sync_log IS 'Logs OneFlow webhook events for debugging and monitoring';
COMMENT ON COLUMN oneflow_sync_log.event_type IS 'Type of webhook event (e.g., contract:publish, contract:sign)';
COMMENT ON COLUMN oneflow_sync_log.oneflow_contract_id IS 'OneFlow contract ID associated with the event';
COMMENT ON COLUMN oneflow_sync_log.status IS 'Processing status: received, verified, processed, or error';
COMMENT ON COLUMN oneflow_sync_log.details IS 'Full webhook payload and processing details as JSON';
COMMENT ON COLUMN oneflow_sync_log.error_message IS 'Error message if processing failed';