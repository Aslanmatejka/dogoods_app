-- Create sms_logs table to track SMS messages sent via Twilio
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) CHECK (type IN ('claim', 'reminder', 'verification', 'notification')),
    status VARCHAR(20) DEFAULT 'sent',
    twilio_sid VARCHAR(100),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_type ON sms_logs(type);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at);

-- Add comment
COMMENT ON TABLE sms_logs IS 'Logs of SMS messages sent via Twilio for tracking and debugging';
