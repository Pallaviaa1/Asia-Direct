const router = require('express').Router();
const aiChat = require('../controllers/aiChatController');

// No JWT — identify the caller with user_id in query/body (same as HTML demo).
router.get('/ai-chat/status', aiChat.getStatus);
router.get('/ai-chat/context', aiChat.getContext);
router.get('/ai-chat/history', aiChat.getHistory);
router.post('/ai-chat/new-session', aiChat.newSession);
router.post('/ai-chat/message', aiChat.sendMessage);

module.exports = router;
