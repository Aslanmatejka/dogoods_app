-- Create table for impact stories/testimonials
CREATE TABLE IF NOT EXISTS impact_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    type VARCHAR(50) NOT NULL, -- 'testimonial', 'featured', 'news'
    title TEXT NOT NULL,
    subtitle TEXT,
    quote TEXT,
    description TEXT,
    image_url TEXT,
    attribution TEXT,
    organization TEXT,
    stats TEXT,
    button_text TEXT,
    button_link TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES auth.users (id)
);

-- Create table for gallery items
CREATE TABLE IF NOT EXISTS impact_gallery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    category VARCHAR(100),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES auth.users (id)
);

-- Create table for partner spotlights
CREATE TABLE IF NOT EXISTS partner_spotlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    logo_emoji TEXT,
    tagline TEXT,
    stat1_value TEXT,
    stat1_label TEXT,
    stat2_value TEXT,
    stat2_label TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES auth.users (id)
);

-- Add indexes for performance
CREATE INDEX idx_impact_stories_type ON impact_stories(type);

CREATE INDEX idx_impact_stories_active ON impact_stories (is_active);

CREATE INDEX idx_impact_stories_order ON impact_stories (display_order);

CREATE INDEX idx_impact_gallery_active ON impact_gallery (is_active);

CREATE INDEX idx_impact_gallery_order ON impact_gallery (display_order);

CREATE INDEX idx_partner_spotlights_active ON partner_spotlights (is_active);

CREATE INDEX idx_partner_spotlights_order ON partner_spotlights (display_order);

-- Enable RLS
ALTER TABLE impact_stories ENABLE ROW LEVEL SECURITY;

ALTER TABLE impact_gallery ENABLE ROW LEVEL SECURITY;

ALTER TABLE partner_spotlights ENABLE ROW LEVEL SECURITY;

-- Public can read active items
CREATE POLICY "Anyone can view active impact stories" ON impact_stories FOR
SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active gallery items" ON impact_gallery FOR
SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active partner spotlights" ON partner_spotlights FOR
SELECT USING (is_active = true);

-- Only admins can insert/update/delete (assumes is_admin column in users table)
CREATE POLICY "Admins can insert impact stories" ON impact_stories FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update impact stories" ON impact_stories FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

CREATE POLICY "Admins can delete impact stories" ON impact_stories FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

CREATE POLICY "Admins can insert gallery items" ON impact_gallery FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update gallery items" ON impact_gallery FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

CREATE POLICY "Admins can delete gallery items" ON impact_gallery FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

CREATE POLICY "Admins can insert partner spotlights" ON partner_spotlights FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update partner spotlights" ON partner_spotlights FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

CREATE POLICY "Admins can delete partner spotlights" ON partner_spotlights FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            users.id = auth.uid ()
            AND users.is_admin = true
    )
);

-- Insert some default sample data
INSERT INTO impact_stories (type, title, quote, image_url, attribution, organization, display_order) VALUES
('testimonial', 'Sarah''s Story: From Volunteer to Champion', '"I started as a volunteer driver, picking up surplus food from local restaurants. Now I coordinate our entire network in the Bay Area. Seeing families receive fresh, nutritious meals—food that would have been wasted—gives me purpose every single day. We''re not just feeding people; we''re building a community that cares."', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2070&auto=format&fit=crop', 'Sarah Martinez', 'Community Coordinator, Alameda', 1),
('testimonial', 'Restaurant Partnership: A Win-Win Solution', '"As a restaurant owner, I used to feel terrible about food waste at the end of each day. DoGoods transformed that guilt into impact. Now, instead of throwing away perfectly good food, I know it''s helping families in our neighborhood. The platform makes it effortless—I post what I have, and within an hour, it''s picked up and distributed."', 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=2070&auto=format&fit=crop', 'Michael Chen', 'Owner, Golden Wok Restaurant', 2);

INSERT INTO
    impact_gallery (
        title,
        description,
        image_url,
        category,
        display_order
    )
VALUES (
        'Community Centers',
        'Partnering with 45+ community centers across the Bay Area to provide fresh meals and groceries to families in need, serving over 10,000 people monthly.',
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800&auto=format&fit=crop',
        'community',
        1
    ),
    (
        'Restaurant Partners',
        'Working with 200+ restaurants and grocers to rescue surplus food daily. Our AI routing ensures food reaches recipients within 60 minutes of donation.',
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop',
        'partners',
        2
    ),
    (
        'Environmental Impact',
        'By preventing food waste, we''ve reduced over 1,200 tons of CO2 emissions and conserved resources equivalent to 30 million gallons of water.',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=800&auto=format&fit=crop',
        'environment',
        3
    );

INSERT INTO
    partner_spotlights (
        name,
        tagline,
        description,
        logo_emoji,
        stat1_value,
        stat1_label,
        stat2_value,
        stat2_label,
        display_order
    )
VALUES (
        'Alameda County Food Bank',
        'Serving communities since 1985',
        'Through our partnership with DoGoods, we''ve been able to triple our fresh food distribution capacity. The AI-powered routing means we can now serve rural communities that were previously out of reach.',
        '🏢',
        '15K+',
        'Monthly Meals Distributed',
        '45',
        'Distribution Sites',
        1
    ),
    (
        'Bay Area Restaurant Alliance',
        '200+ member restaurants',
        'DoGoods transformed how we handle surplus food. Instead of guilt and waste, we now have impact and purpose. Every evening, we know our unserved food is feeding families in our neighborhood.',
        '🍕',
        '800K+',
        'Pounds Donated',
        '200+',
        'Member Restaurants',
        2
    );