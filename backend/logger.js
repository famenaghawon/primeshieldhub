// logger.js

export async function logEvent(db, event) {
  await db.prepare(`
    INSERT INTO logs (type, message, user, timestamp)
    VALUES (?, ?, ?, ?)
  `).bind(
    event.type,
    event.message,
    event.user || "system",
    new Date().toISOString()
  ).run();
}

