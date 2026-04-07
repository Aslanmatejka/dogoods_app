-- Add SELECT policies so admins can see ALL items (including is_active = false)
-- Without these, admins could only see active items in the management panel

CREATE POLICY "Admins can view all impact stories" ON impact_stories FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can view all gallery items" ON impact_gallery FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can view all partner spotlights" ON partner_spotlights FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );