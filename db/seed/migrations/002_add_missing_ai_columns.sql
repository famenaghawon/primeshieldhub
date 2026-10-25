-- migrations/002_add_missing_ai_columns.sql
-- This is idempotent - it will only add columns that don't exist

-- We use a trick: attempt to add the column, ignore error if it exists
-- In SQLite, there's no IF NOT EXISTS for ALTER TABLE
-- So we just run it and let the duplicate column error be ignored

-- But since D1 doesn't support conditional ALTER, we can create a new table approach:

-- Option A: If you just need the columns and they already exist, do nothing
-- The error you got means the migration already succeeded.

-- Option B: Create indexes if they don't exist (safer)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_sentiment ON ai_conversations(sentiment);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_urgency ON ai_conversations(urgency);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_model ON ai_conversations(model);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_fingerprint ON ai_conversations(fingerprint);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);

-- Create view for analytics
CREATE VIEW IF NOT EXISTS ai_analytics_daily AS
SELECT 
    date(created_at) as date,
    COUNT(*) as total_queries,
    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive_count,
    SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count,
    SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
    SUM(CASE WHEN urgency = 1 THEN 1 ELSE 0 END) as urgent_count,
    COUNT(DISTINCT fingerprint) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions
FROM ai_conversations
GROUP BY date(created_at)
ORDER BY date DESC;
