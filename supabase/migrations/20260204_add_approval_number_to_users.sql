-- Add approval_number column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_number TEXT;

-- Create index on approval_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_approval_number ON users (approval_number);

-- Add comment to document the column
COMMENT ON COLUMN users.approval_number IS 'Approval number received from school community closet contact, required to claim food from community closets';