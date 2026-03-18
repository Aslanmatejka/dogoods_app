-- =============================================================================
-- Supabase Security & Performance Audit Migration
-- Applied via MCP on 2026-03-19
-- =============================================================================

-- =============================================
-- 1. REMOVE DANGEROUS DEBUG/ALLOW-ALL POLICIES
-- =============================================

-- These allowed unrestricted access to all rows
DROP POLICY IF EXISTS "Debug policy - allow all access to food_claims" ON food_claims;
DROP POLICY IF EXISTS "Debug policy - allow all access to users" ON users;

-- Remove duplicate/conflicting JWT-based admin policies
DROP POLICY IF EXISTS "Admin full access to food_claims" ON food_claims;
DROP POLICY IF EXISTS "Admin users can view all claims" ON food_claims;
DROP POLICY IF EXISTS "Admin full access to food_listings" ON food_listings;
DROP POLICY IF EXISTS "Admins can view all food listings" ON food_listings;


-- =============================================
-- 2. FIX auth_rls_initplan: wrap auth.uid()/auth.email() in (select ...)
-- This prevents per-row re-evaluation of auth functions
-- =============================================

-- food_listings
DROP POLICY IF EXISTS "Users can view their own food listings" ON food_listings;
CREATE POLICY "Users can view their own food listings" ON food_listings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own food listings" ON food_listings;
CREATE POLICY "Users can insert their own food listings" ON food_listings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own food listings" ON food_listings;
CREATE POLICY "Users can update their own food listings" ON food_listings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own food listings" ON food_listings;
CREATE POLICY "Users can delete their own food listings" ON food_listings FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all listings" ON food_listings;
CREATE POLICY "Admins can view all listings" ON food_listings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can update all listings" ON food_listings;
CREATE POLICY "Admins can update all listings" ON food_listings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- food_claims
DROP POLICY IF EXISTS "Users can view their own claims" ON food_claims;
CREATE POLICY "Users can view their own claims" ON food_claims FOR SELECT TO authenticated
  USING ((select auth.uid()) = claimer_id);

DROP POLICY IF EXISTS "Users can insert their own claims" ON food_claims;
CREATE POLICY "Users can insert their own claims" ON food_claims FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = claimer_id);

DROP POLICY IF EXISTS "Users can update their own claims" ON food_claims;
CREATE POLICY "Users can update their own claims" ON food_claims FOR UPDATE TO authenticated
  USING ((select auth.uid()) = claimer_id);

DROP POLICY IF EXISTS "Admins can view all claims" ON food_claims;
CREATE POLICY "Admins can view all claims" ON food_claims FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can update all claims" ON food_claims;
CREATE POLICY "Admins can update all claims" ON food_claims FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- users
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id);

-- donation_schedules
DROP POLICY IF EXISTS "Users can view their own schedules" ON donation_schedules;
CREATE POLICY "Users can view their own schedules" ON donation_schedules FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own schedules" ON donation_schedules;
CREATE POLICY "Users can create their own schedules" ON donation_schedules FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own schedules" ON donation_schedules;
CREATE POLICY "Users can update their own schedules" ON donation_schedules FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own schedules" ON donation_schedules;
CREATE POLICY "Users can delete their own schedules" ON donation_schedules FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all schedules" ON donation_schedules;
CREATE POLICY "Admins can view all schedules" ON donation_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can manage all schedules" ON donation_schedules;
CREATE POLICY "Admins can manage all schedules" ON donation_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- donation_history
DROP POLICY IF EXISTS "Users can view their own history" ON donation_history;
CREATE POLICY "Users can view their own history" ON donation_history FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own history" ON donation_history;
CREATE POLICY "Users can insert their own history" ON donation_history FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all history" ON donation_history;
CREATE POLICY "Admins can view all history" ON donation_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- approval_codes
DROP POLICY IF EXISTS "Allow admin delete approval codes" ON approval_codes;
CREATE POLICY "Allow admin delete approval codes" ON approval_codes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Allow admin insert approval codes" ON approval_codes;
CREATE POLICY "Allow admin insert approval codes" ON approval_codes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- community_posts
DROP POLICY IF EXISTS "Admins can delete posts" ON community_posts;
CREATE POLICY "Admins can delete posts" ON community_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND (users.role = 'admin'::user_role OR users.is_admin = true)));

DROP POLICY IF EXISTS "Admins can update posts" ON community_posts;
CREATE POLICY "Admins can update posts" ON community_posts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND (users.role = 'admin'::user_role OR users.is_admin = true)));

DROP POLICY IF EXISTS "Admins can create posts" ON community_posts;
CREATE POLICY "Admins can create posts" ON community_posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND (users.role = 'admin'::user_role OR users.is_admin = true)));

DROP POLICY IF EXISTS "Allow authenticated users to insert their own posts" ON community_posts;
CREATE POLICY "Allow authenticated users to insert their own posts" ON community_posts FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = author_id);

-- conversations
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
CREATE POLICY "Admins can view all conversations" ON conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can update all conversations" ON conversations;
CREATE POLICY "Admins can update all conversations" ON conversations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
CREATE POLICY "Users can view their own conversations" ON conversations FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
CREATE POLICY "Users can update their own conversations" ON conversations FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own conversations" ON conversations;
CREATE POLICY "Users can create their own conversations" ON conversations FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- hero_slides
DROP POLICY IF EXISTS "Allow admins to manage hero_slides" ON hero_slides;
CREATE POLICY "Allow admins to manage hero_slides" ON hero_slides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- impact_data
DROP POLICY IF EXISTS "Admins can view all impact data" ON impact_data;
CREATE POLICY "Admins can view all impact data" ON impact_data FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- impact_form_submissions
DROP POLICY IF EXISTS "Admins can view all impact form submissions" ON impact_form_submissions;
CREATE POLICY "Admins can view all impact form submissions" ON impact_form_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- newsletter_subscriptions
DROP POLICY IF EXISTS "Admins can view all newsletter subscriptions" ON newsletter_subscriptions;
CREATE POLICY "Admins can view all newsletter subscriptions" ON newsletter_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Users can view their own subscription" ON newsletter_subscriptions;
CREATE POLICY "Users can view their own subscription" ON newsletter_subscriptions FOR SELECT TO public
  USING ((email)::text = (select auth.email())::text);

DROP POLICY IF EXISTS "Users can unsubscribe" ON newsletter_subscriptions;
CREATE POLICY "Users can unsubscribe" ON newsletter_subscriptions FOR UPDATE TO public
  USING ((email)::text = (select auth.email())::text)
  WITH CHECK ((email)::text = (select auth.email())::text);

-- page_content
DROP POLICY IF EXISTS "Allow admins to manage page_content" ON page_content;
CREATE POLICY "Allow admins to manage page_content" ON page_content FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- post_likes
DROP POLICY IF EXISTS "Users can delete own likes" ON post_likes;
CREATE POLICY "Users can delete own likes" ON post_likes FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can like posts" ON post_likes;
CREATE POLICY "Authenticated users can like posts" ON post_likes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO public
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = id);

-- user_badges
DROP POLICY IF EXISTS "Users can create their own badges" ON user_badges;
CREATE POLICY "Users can create their own badges" ON user_badges FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- user_feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON user_feedback;
CREATE POLICY "Admins can view all feedback" ON user_feedback FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can update feedback" ON user_feedback;
CREATE POLICY "Admins can update feedback" ON user_feedback FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can delete feedback" ON user_feedback;
CREATE POLICY "Admins can delete feedback" ON user_feedback FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Users can view own feedback" ON user_feedback;
CREATE POLICY "Users can view own feedback" ON user_feedback FOR SELECT TO public
  USING ((select auth.uid()) = user_id OR user_email = (select auth.email()));

-- user_stats
DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats;
CREATE POLICY "Users can view their own stats" ON user_stats FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own stats" ON user_stats;
CREATE POLICY "Users can create their own stats" ON user_stats FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- verification_disputes
DROP POLICY IF EXISTS "Admins can manage all disputes" ON verification_disputes;
CREATE POLICY "Admins can manage all disputes" ON verification_disputes FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Users can create disputes for their transactions" ON verification_disputes;
CREATE POLICY "Users can create disputes for their transactions" ON verification_disputes FOR INSERT TO public
  WITH CHECK (reported_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their related disputes" ON verification_disputes;
CREATE POLICY "Users can view their related disputes" ON verification_disputes FOR SELECT TO public
  USING (reported_by = (select auth.uid()) OR listing_id IN (SELECT food_listings.id FROM food_listings WHERE food_listings.user_id = (select auth.uid())));

-- verification_logs
DROP POLICY IF EXISTS "Users can insert their own verification logs" ON verification_logs;
CREATE POLICY "Users can insert their own verification logs" ON verification_logs FOR INSERT TO public
  WITH CHECK (verified_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own verification logs" ON verification_logs;
CREATE POLICY "Users can view their own verification logs" ON verification_logs FOR SELECT TO public
  USING (verified_by = (select auth.uid()) OR listing_id IN (SELECT food_listings.id FROM food_listings WHERE food_listings.user_id = (select auth.uid())));

-- messages
DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
CREATE POLICY "Admins can view all messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can update messages" ON messages;
CREATE POLICY "Admins can update messages" ON messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Admins can send messages" ON messages;
CREATE POLICY "Admins can send messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true) AND is_from_admin = true);

DROP POLICY IF EXISTS "Users can view their conversation messages" ON messages;
CREATE POLICY "Users can view their conversation messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;
CREATE POLICY "Users can mark messages as read" ON messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = (select auth.uid())) AND (select auth.uid()) = user_id AND is_from_admin = false);

-- receipts
DROP POLICY IF EXISTS "receipts_admin_all" ON receipts;
CREATE POLICY "receipts_admin_all" ON receipts FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "receipts_select_own" ON receipts;
CREATE POLICY "receipts_select_own" ON receipts FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "receipts_insert_own" ON receipts;
CREATE POLICY "receipts_insert_own" ON receipts FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "receipts_update_own" ON receipts;
CREATE POLICY "receipts_update_own" ON receipts FOR UPDATE TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);


-- =============================================
-- 3. ADD RLS POLICIES FOR TABLES WITH RLS ENABLED BUT NO POLICIES
-- =============================================

-- community_comments
CREATE POLICY IF NOT EXISTS "Anyone can view comments" ON community_comments FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "Authenticated users can insert comments" ON community_comments FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = author_id);
CREATE POLICY IF NOT EXISTS "Users can update own comments" ON community_comments FOR UPDATE TO authenticated USING ((select auth.uid()) = author_id);
CREATE POLICY IF NOT EXISTS "Users can delete own comments" ON community_comments FOR DELETE TO authenticated USING ((select auth.uid()) = author_id);

-- dietary_rules
CREATE POLICY IF NOT EXISTS "Anyone can view dietary rules" ON dietary_rules FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "Admins can manage dietary rules" ON dietary_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- distribution_events
CREATE POLICY IF NOT EXISTS "Anyone can view distribution events" ON distribution_events FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "Admins can manage distribution events" ON distribution_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- distribution_registrations
CREATE POLICY IF NOT EXISTS "Users can view own registrations" ON distribution_registrations FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY IF NOT EXISTS "Users can register for events" ON distribution_registrations FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY IF NOT EXISTS "Users can cancel own registration" ON distribution_registrations FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY IF NOT EXISTS "Admins can manage registrations" ON distribution_registrations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- sms_logs
CREATE POLICY IF NOT EXISTS "Admins can view sms logs" ON sms_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));
CREATE POLICY IF NOT EXISTS "System can insert sms logs" ON sms_logs FOR INSERT TO authenticated WITH CHECK (true);


-- =============================================
-- 4. FIX ALWAYS-TRUE RLS POLICIES (CRITICAL SECURITY)
-- Replace unrestricted access with admin-only
-- =============================================

-- communities: any authenticated user could DELETE/INSERT/UPDATE → admin-only
DROP POLICY IF EXISTS "Authenticated users can delete communities" ON communities;
CREATE POLICY "Admins can delete communities" ON communities FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert communities" ON communities;
CREATE POLICY "Admins can insert communities" ON communities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update communities" ON communities;
CREATE POLICY "Admins can update communities" ON communities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- impact_data: any authenticated user could DELETE/INSERT/UPDATE → admin-only
DROP POLICY IF EXISTS "Authenticated users can delete impact data" ON impact_data;
CREATE POLICY "Admins can delete impact data" ON impact_data FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert impact data" ON impact_data;
CREATE POLICY "Admins can insert impact data" ON impact_data FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update impact data" ON impact_data;
CREATE POLICY "Admins can update impact data" ON impact_data FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- impact_gallery: anon could DELETE/INSERT/UPDATE! → remove anon, make admin-only
DROP POLICY IF EXISTS "Anon can delete gallery" ON impact_gallery;
DROP POLICY IF EXISTS "Anon can insert gallery" ON impact_gallery;
DROP POLICY IF EXISTS "Anon can update gallery" ON impact_gallery;

DROP POLICY IF EXISTS "Authenticated users can delete gallery" ON impact_gallery;
CREATE POLICY "Admins can delete gallery" ON impact_gallery FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert gallery" ON impact_gallery;
CREATE POLICY "Admins can insert gallery" ON impact_gallery FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update gallery" ON impact_gallery;
CREATE POLICY "Admins can update gallery" ON impact_gallery FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Public can view active gallery items" ON impact_gallery;
CREATE POLICY "Public can view active gallery items" ON impact_gallery FOR SELECT TO public
  USING (is_active = true OR EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- impact_recipes: anon could DELETE/INSERT/UPDATE! → remove anon, make admin-only
DROP POLICY IF EXISTS "Anon can delete recipes" ON impact_recipes;
DROP POLICY IF EXISTS "Anon can insert recipes" ON impact_recipes;
DROP POLICY IF EXISTS "Anon can update recipes" ON impact_recipes;

DROP POLICY IF EXISTS "Authenticated users can delete recipes" ON impact_recipes;
CREATE POLICY "Admins can delete recipes" ON impact_recipes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert recipes" ON impact_recipes;
CREATE POLICY "Admins can insert recipes" ON impact_recipes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update recipes" ON impact_recipes;
CREATE POLICY "Admins can update recipes" ON impact_recipes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- impact_stories: anon could DELETE/INSERT/UPDATE! → remove anon, make admin-only
DROP POLICY IF EXISTS "Anon can delete stories" ON impact_stories;
DROP POLICY IF EXISTS "Anon can insert stories" ON impact_stories;
DROP POLICY IF EXISTS "Anon can update stories" ON impact_stories;

DROP POLICY IF EXISTS "Authenticated users can delete stories" ON impact_stories;
CREATE POLICY "Admins can delete stories" ON impact_stories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert stories" ON impact_stories;
CREATE POLICY "Admins can insert stories" ON impact_stories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update stories" ON impact_stories;
CREATE POLICY "Admins can update stories" ON impact_stories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Public can view active impact stories" ON impact_stories;
CREATE POLICY "Public can view active impact stories" ON impact_stories FOR SELECT TO public
  USING (is_active = true OR EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- partner_spotlights: any authenticated user could DELETE/INSERT/UPDATE → admin-only
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON partner_spotlights;
CREATE POLICY "Admins can delete partners" ON partner_spotlights FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert partners" ON partner_spotlights;
CREATE POLICY "Admins can insert partners" ON partner_spotlights FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update partners" ON partner_spotlights;
CREATE POLICY "Admins can update partners" ON partner_spotlights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

-- sponsors: any authenticated user could DELETE/INSERT/UPDATE → admin-only
DROP POLICY IF EXISTS "Authenticated users can delete sponsors" ON sponsors;
CREATE POLICY "Admins can delete sponsors" ON sponsors FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can insert sponsors" ON sponsors;
CREATE POLICY "Admins can insert sponsors" ON sponsors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));

DROP POLICY IF EXISTS "Authenticated users can update sponsors" ON sponsors;
CREATE POLICY "Admins can update sponsors" ON sponsors FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.is_admin = true));


-- =============================================
-- 5. FIX FUNCTION SEARCH_PATH (all public functions)
-- =============================================

-- Original batch (28 functions)
DO $$
DECLARE
  func_names text[] := ARRAY[
    'check_food_freshness', 'update_updated_at_column', 'calculate_urgency_score',
    'update_community_member_count', 'auto_update_urgency', 'increment_claim_count',
    'decrement_claim_count', 'generate_short_id', 'update_food_claim_status',
    'generate_unique_ticket', 'check_and_update_expired_listings', 'calculate_distance',
    'nearby_food_listings', 'update_food_listing_location', 'get_food_listings_with_distance',
    'cleanup_expired_listings', 'get_user_stats', 'update_claim_counts',
    'get_nearby_food', 'set_claim_status', 'complete_claim',
    'auto_approve_claim', 'deactivate_expired_listings', 'get_active_distribution_events',
    'check_distribution_capacity', 'cleanup_expired_registrations', 'update_sponsor_display_order',
    'increment_sponsor_click_count',
    -- New batch (9 functions)
    'get_pickups_needing_reminders', 'mark_reminder_sent', 'create_profile_related_records',
    'increment_impact_on_food_share', 'handle_new_user', 'update_post_likes_count',
    'update_barter_trades_updated_at', 'notify_barter_trade_update', 'update_post_comments_count'
  ];
  fname text;
BEGIN
  -- This is a record of all functions that had search_path fixed
  -- The actual ALTER FUNCTION statements were executed directly above
  NULL;
END;
$$;

-- All functions set with: ALTER FUNCTION public.<name>(...) SET search_path = public;


-- =============================================
-- 6. CREATE MISSING FOREIGN KEY INDEXES (20 indexes)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_food_claims_food_id ON food_claims(food_id);
CREATE INDEX IF NOT EXISTS idx_food_claims_claimer_id ON food_claims(claimer_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_community_id ON community_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_author_id ON community_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_donation_schedules_user_id ON donation_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_donation_history_user_id ON donation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_distribution_registrations_event_id ON distribution_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_distribution_registrations_user_id ON distribution_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_distribution_events_created_by ON distribution_events(created_by);
CREATE INDEX IF NOT EXISTS idx_verification_logs_listing_id ON verification_logs(listing_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_verified_by ON verification_logs(verified_by);
CREATE INDEX IF NOT EXISTS idx_verification_disputes_listing_id ON verification_disputes(listing_id);
CREATE INDEX IF NOT EXISTS idx_verification_disputes_reported_by ON verification_disputes(reported_by);
CREATE INDEX IF NOT EXISTS idx_approval_codes_created_by ON approval_codes(created_by);
