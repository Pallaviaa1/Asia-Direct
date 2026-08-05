const cron = require('node-cron');
const { purgeExpiredSessions, HISTORY_TTL_MINUTES } = require('../history/chatHistoryService');

/**
 * Periodically remove AI chat sessions past expires_at (inactivity TTL).
 * Default TTL is 1 hour; expiry is extended on each user message.
 */
function startAiChatHistoryCleanup() {
    // Every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        try {
            const result = await purgeExpiredSessions();
            if (result.sessions > 0) {
                console.log(
                    `AI chat TTL cleanup: removed ${result.sessions} session(s), ${result.messages} message(s) (TTL=${HISTORY_TTL_MINUTES}m)`
                );
            }
        } catch (err) {
            console.warn('AI chat TTL cleanup error:', err.message);
        }
    });
}

module.exports = { startAiChatHistoryCleanup };
