-- Create receipts system for aggregating food claims
-- Users can claim multiple items in one transaction, all grouped into a single receipt
-- Receipts have three states: pending (Pick Up), completed, or expired (Reclaim)
-- Unclaimed receipts expire Friday 5PM Pacific and items return to inventory

-- Create receipts table
CREATE TABLE IF NOT EXISTS receipts (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'expired'

-- Pickup location details
pickup_location VARCHAR(255), -- e.g., "Ruby Bridges Elementary School"
pickup_address TEXT, -- Full address
pickup_window TEXT, -- e.g., "XYZ (fill with same info listed on claim food page)"

-- Timestamps

claimed_at TIMESTAMPTZ DEFAULT NOW(),
    pickup_by TIMESTAMPTZ NOT NULL, -- Auto-calculated: Friday 5PM Pacific after claimed_at
    picked_up_at TIMESTAMPTZ, -- When user clicked "Pick Up" button
    expired_at TIMESTAMPTZ, -- When receipt auto-expired (if applicable)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add receipt_id to food_claims table
ALTER TABLE food_claims
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts (id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts (user_id);

CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts (status);

CREATE INDEX IF NOT EXISTS idx_receipts_pickup_by ON receipts (pickup_by);

CREATE INDEX IF NOT EXISTS idx_receipts_user_status ON receipts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_food_claims_receipt_id ON food_claims (receipt_id);

-- Function to calculate next Friday 5PM Pacific from a given timestamp
CREATE OR REPLACE FUNCTION calculate_pickup_deadline(claim_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    claim_pacific TIMESTAMP;
    days_until_friday INT;
    next_friday_pacific TIMESTAMP;
BEGIN
    -- Convert to Pacific Time (no time zone)
    claim_pacific := claim_time AT TIME ZONE 'America/Los_Angeles';
    
    -- Calculate days until next Friday (0=Sunday, 5=Friday)
    days_until_friday := (12 - EXTRACT(DOW FROM claim_pacific)::INT) % 7;
    
    -- If it's Friday before 5PM, deadline is today at 5PM
    IF EXTRACT(DOW FROM claim_pacific) = 5 AND EXTRACT(HOUR FROM claim_pacific) < 17 THEN
        next_friday_pacific := date_trunc('day', claim_pacific) + INTERVAL '17 hours';
    ELSE
        -- Otherwise, deadline is next Friday at 5PM
        IF days_until_friday = 0 THEN
            days_until_friday := 7;
        END IF;
        next_friday_pacific := date_trunc('day', claim_pacific) + (days_until_friday || ' days')::INTERVAL + INTERVAL '17 hours';
    END IF;
    
    -- Convert back to UTC for storage by treating it as a Pacific time
    RETURN timezone('America/Los_Angeles', next_friday_pacific);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically set pickup_by when receipt is created
CREATE OR REPLACE FUNCTION set_receipt_pickup_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pickup_by IS NULL THEN
        NEW.pickup_by := calculate_pickup_deadline(NEW.claimed_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_receipt_pickup_deadline
BEFORE INSERT ON receipts
FOR EACH ROW
EXECUTE FUNCTION set_receipt_pickup_deadline();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_receipt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_receipt_timestamp
BEFORE UPDATE ON receipts
FOR EACH ROW
EXECUTE FUNCTION update_receipt_updated_at();

-- Function to expire old receipts and return items to inventory
CREATE OR REPLACE FUNCTION expire_unclaimed_receipts()
RETURNS TABLE(expired_count INT) AS $$
DECLARE
    expired_receipt RECORD;
    total_expired INT := 0;
BEGIN
    -- Find all pending receipts past their pickup_by deadline
    FOR expired_receipt IN
        SELECT id FROM receipts
        WHERE status = 'pending'
        AND pickup_by < NOW()
    LOOP
        -- Mark receipt as expired
        UPDATE receipts
        SET status = 'expired',
            expired_at = NOW()
        WHERE id = expired_receipt.id;
        
        -- Return all food items from this receipt back to inventory
        UPDATE food_listings
        SET status = 'available'
        WHERE id IN (
            SELECT food_id FROM food_claims
            WHERE receipt_id = expired_receipt.id
        );
        
        -- Update the claims status
        UPDATE food_claims
        SET status = 'expired'
        WHERE receipt_id = expired_receipt.id;
        
        total_expired := total_expired + 1;
    END LOOP;
    
    RETURN QUERY SELECT total_expired;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Users can view their own receipts
CREATE POLICY receipts_select_own ON receipts FOR
SELECT USING (auth.uid () = user_id);

-- Users can insert their own receipts
CREATE POLICY receipts_insert_own ON receipts FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

-- Users can update their own receipts (for pickup)
CREATE POLICY receipts_update_own ON receipts FOR
UPDATE USING (auth.uid () = user_id)
WITH
    CHECK (auth.uid () = user_id);

-- Admins can view all receipts
CREATE POLICY receipts_admin_all ON receipts FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

-- Comments for documentation
COMMENT ON
TABLE receipts IS 'Aggregates multiple food claims into a single pickup receipt. Expires Friday 5PM Pacific if not picked up.';

COMMENT ON COLUMN receipts.status IS 'pending = awaiting pickup, completed = picked up, expired = past deadline';

COMMENT ON COLUMN receipts.pickup_by IS 'Auto-calculated deadline: next Friday 5PM Pacific after claim';

COMMENT ON COLUMN receipts.receipt_id IS 'Links claim to its parent receipt for aggregation';

COMMENT ON FUNCTION expire_unclaimed_receipts () IS 'Cron job function: expires old receipts and returns items to inventory';