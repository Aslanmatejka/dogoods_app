-- Script to manually set up the likes_count trigger
-- Run this in Supabase SQL Editor

-- Function to update likes_count on community_posts
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment likes_count when a like is added
    UPDATE community_posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement likes_count when a like is removed
    UPDATE community_posts
    SET likes_count = likes_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT on post_likes
DROP TRIGGER IF EXISTS trigger_post_likes_insert ON post_likes;

CREATE TRIGGER trigger_post_likes_insert
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION update_post_likes_count();

-- Create trigger for DELETE on post_likes
DROP TRIGGER IF EXISTS trigger_post_likes_delete ON post_likes;

CREATE TRIGGER trigger_post_likes_delete
AFTER DELETE ON post_likes
FOR EACH ROW
EXECUTE FUNCTION update_post_likes_count();

-- Optional: Sync existing likes_count with actual likes
UPDATE community_posts
SET
    likes_count = (
        SELECT COUNT(*)
        FROM post_likes
        WHERE
            post_likes.post_id = community_posts.id
    );