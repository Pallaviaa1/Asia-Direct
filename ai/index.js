/**
 * Workspace AI module — single entry for the Express app.
 * Secrets stay in project-root .env (GEMINI_*, AI_CHAT_HISTORY_TTL_MINUTES).
 */
const path = require('path');
const router = require('./routes/aiChatRoute');
const { startAiChatHistoryCleanup } = require('./jobs/aiChatHistoryCleanup');

function startCleanup() {
    startAiChatHistoryCleanup();
}

/** Absolute path to the HTML demo (served as /ai-chat.html). */
const demoHtmlPath = path.join(__dirname, 'demo', 'ai-chat.html');

module.exports = {
    router,
    startCleanup,
    demoHtmlPath,
};
