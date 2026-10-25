-- ai_conversations table (with all columns)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    fingerprint TEXT DEFAULT '',
    user_message TEXT,
    assistant_reply TEXT,
    sentiment TEXT DEFAULT 'neutral',
    urgency INTEGER DEFAULT 0,
    model TEXT DEFAULT 'unknown',
    intent TEXT DEFAULT 'general',
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ai_analytics table
CREATE TABLE IF NOT EXISTS ai_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    event_data TEXT,
    analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- logs table (for error tracking)
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    message TEXT,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- security_logs table
CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created ON ai_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_sentiment ON ai_conversations(sentiment);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_fingerprint ON ai_conversations(fingerprint);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_created ON ai_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON security_logs(created_at);
