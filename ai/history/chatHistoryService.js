const { query } = require('../../helpers/dbQuery');

/** Inactivity TTL (minutes). Each new message extends the session expiry. */
const HISTORY_TTL_MINUTES = Math.max(
    5,
    Number(process.env.AI_CHAT_HISTORY_TTL_MINUTES || 60)
);
const HISTORY_LIMIT = 50;

let tablesReady = null;
let expiresColumnReady = false;

async function ensureTables() {
    if (tablesReady) return true;
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS ai_chat_messages (
              id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
              user_id int(11) NOT NULL,
              session_id varchar(120) NOT NULL,
              role enum('user','assistant') NOT NULL,
              content mediumtext NOT NULL,
              data_json longtext DEFAULT NULL,
              provider varchar(40) DEFAULT NULL,
              created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY idx_user_session_created (user_id, session_id, created_at),
              KEY idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS ai_chat_sessions (
              session_id varchar(120) NOT NULL,
              user_id int(11) NOT NULL,
              title varchar(255) DEFAULT NULL,
              last_freight_number varchar(64) DEFAULT NULL,
              expires_at timestamp NULL DEFAULT NULL,
              created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (session_id),
              KEY idx_user_updated (user_id, updated_at),
              KEY idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        await ensureExpiresColumn();
        tablesReady = true;
        return true;
    } catch (err) {
        console.warn('AI chat history tables unavailable:', err.message);
        tablesReady = false;
        return false;
    }
}

async function ensureExpiresColumn() {
    if (expiresColumnReady) return;
    try {
        const cols = await query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'ai_chat_sessions'
               AND COLUMN_NAME = 'expires_at'`
        );
        if (!cols.length) {
            await query(
                `ALTER TABLE ai_chat_sessions
                 ADD COLUMN expires_at timestamp NULL DEFAULT NULL AFTER last_freight_number,
                 ADD KEY idx_expires_at (expires_at)`
            );
            // Backfill: treat existing sessions as expiring after one TTL from last activity
            await query(
                `UPDATE ai_chat_sessions
                 SET expires_at = DATE_ADD(COALESCE(updated_at, created_at, NOW()), INTERVAL ? MINUTE)
                 WHERE expires_at IS NULL`,
                [HISTORY_TTL_MINUTES]
            );
        }
        expiresColumnReady = true;
    } catch (err) {
        console.warn('AI chat expires_at column setup:', err.message);
    }
}

function ttlSqlInterval() {
    return HISTORY_TTL_MINUTES;
}

/**
 * Delete sessions past expires_at and their messages.
 * Safe to run from cron or occasionally on write/read.
 */
async function purgeExpiredSessions() {
    if (!(await ensureTables())) return { sessions: 0, messages: 0 };
    try {
        const expired = await query(
            `SELECT session_id FROM ai_chat_sessions
             WHERE expires_at IS NOT NULL AND expires_at < NOW()`
        );
        if (!expired.length) return { sessions: 0, messages: 0 };

        const ids = expired.map((r) => r.session_id);
        const placeholders = ids.map(() => '?').join(',');

        const msgResult = await query(
            `DELETE FROM ai_chat_messages WHERE session_id IN (${placeholders})`,
            ids
        );
        const sessResult = await query(
            `DELETE FROM ai_chat_sessions WHERE session_id IN (${placeholders})`,
            ids
        );

        return {
            sessions: sessResult.affectedRows || ids.length,
            messages: msgResult.affectedRows || 0,
        };
    } catch (err) {
        console.warn('AI chat TTL purge failed:', err.message);
        return { sessions: 0, messages: 0 };
    }
}

/** @deprecated use purgeExpiredSessions — kept for callers */
async function purgeOldMessages() {
    return purgeExpiredSessions();
}

/**
 * Create or refresh a session and extend expires_at (inactivity TTL).
 */
async function touchSession(userId, sessionId, { title, lastFreightNumber } = {}) {
    if (!(await ensureTables()) || !userId || !sessionId) return;
    const ttl = ttlSqlInterval();
    await query(
        `INSERT INTO ai_chat_sessions (session_id, user_id, title, last_freight_number, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           title = COALESCE(VALUES(title), title),
           last_freight_number = COALESCE(VALUES(last_freight_number), last_freight_number),
           expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
           updated_at = CURRENT_TIMESTAMP`,
        [
            sessionId,
            Number(userId),
            title || null,
            lastFreightNumber || null,
            ttl,
            ttl,
        ]
    );
}

async function isSessionActive(userId, sessionId) {
    if (!(await ensureTables()) || !userId || !sessionId) return false;
    const rows = await query(
        `SELECT session_id FROM ai_chat_sessions
         WHERE session_id = ? AND user_id = ?
           AND (expires_at IS NULL OR expires_at >= NOW())
         LIMIT 1`,
        [String(sessionId), Number(userId)]
    );
    return Boolean(rows[0]);
}

async function saveChatMessage({
    userId,
    sessionId,
    role,
    content,
    data = null,
    provider = null,
    lastFreightNumber = null,
}) {
    if (!(await ensureTables()) || !userId || !sessionId || !role) return null;
    const text = String(content || '');
    if (!text) return null;

    let dataJson = null;
    if (data != null) {
        try {
            dataJson = JSON.stringify(data);
        } catch (_) {
            dataJson = null;
        }
    }

    const result = await query(
        `INSERT INTO ai_chat_messages (user_id, session_id, role, content, data_json, provider)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(userId), String(sessionId), role === 'assistant' ? 'assistant' : 'user', text, dataJson, provider]
    );

    const title = role === 'user' ? text.slice(0, 80) : null;
    // Extend TTL on every message (active conversation stays alive)
    await touchSession(userId, sessionId, { title, lastFreightNumber });

    if (Math.random() < 0.05) purgeExpiredSessions().catch(() => {});

    return result.insertId;
}

async function getChatHistory(userId, sessionId, { limit = HISTORY_LIMIT } = {}) {
    if (!(await ensureTables()) || !userId || !sessionId) return [];
    await purgeExpiredSessions();

    if (!(await isSessionActive(userId, sessionId))) {
        return [];
    }

    const rows = await query(
        `SELECT id, role, content, data_json, provider, created_at
         FROM ai_chat_messages
         WHERE user_id = ? AND session_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [Number(userId), String(sessionId), Math.min(Number(limit) || HISTORY_LIMIT, 100)]
    );
    return rows
        .reverse()
        .map((r) => {
            let data = null;
            if (r.data_json) {
                try {
                    data = JSON.parse(r.data_json);
                } catch (_) {
                    data = null;
                }
            }
            return {
                id: r.id,
                role: r.role,
                content: r.content,
                data,
                provider: r.provider,
                created_at: r.created_at,
            };
        });
}

async function getSessionMeta(userId, sessionId) {
    if (!(await ensureTables()) || !userId || !sessionId) return null;
    const rows = await query(
        `SELECT session_id, user_id, title, last_freight_number, expires_at, created_at, updated_at
         FROM ai_chat_sessions
         WHERE session_id = ? AND user_id = ?
           AND (expires_at IS NULL OR expires_at >= NOW())
         LIMIT 1`,
        [String(sessionId), Number(userId)]
    );
    return rows[0] || null;
}

async function createNewSession(userId) {
    const sessionId = `u${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await touchSession(userId, sessionId, { title: 'New chat' });
    return sessionId;
}

async function getLatestSessionId(userId) {
    if (!(await ensureTables()) || !userId) return null;
    await purgeExpiredSessions();
    const rows = await query(
        `SELECT session_id FROM ai_chat_sessions
         WHERE user_id = ?
           AND (expires_at IS NULL OR expires_at >= NOW())
         ORDER BY updated_at DESC
         LIMIT 1`,
        [Number(userId)]
    );
    return rows[0]?.session_id || null;
}

module.exports = {
    HISTORY_TTL_MINUTES,
    /** @deprecated use HISTORY_TTL_MINUTES */
    HISTORY_RETENTION_DAYS: HISTORY_TTL_MINUTES,
    ensureTables,
    saveChatMessage,
    getChatHistory,
    getSessionMeta,
    createNewSession,
    getLatestSessionId,
    touchSession,
    purgeOldMessages,
    purgeExpiredSessions,
    isSessionActive,
};
