const { loadUserContext } = require('../../services/permissions/userContext');
const { chatWithGemini, isGeminiAvailable } = require('./llmProvider');
const { ruleBasedRoute, isDefaultHelpReply } = require('./tools');
const {
    addMessage,
    getHistory,
    getSession,
    getLastFreightNumber,
    markHydrated,
    isHydrated,
} = require('./conversationStore');
const {
    saveChatMessage,
    getChatHistory,
    getSessionMeta,
    ensureTables,
} = require('../history/chatHistoryService');
const {
    extractQuoteReference,
    extractFreightNumber,
    extractOrderNumber,
    extractDisputeId,
    extractSageDocumentNumber,
    extractFreightInvoiceReference,
    extractSupplierInvoiceReference,
    extractBatchNumber,
    extractClearanceNumber,
    extractCashbookBankRef,
    extractWaybill,
    isGreetingOrSmallTalk,
} = require('./messageParser');

function isSelectionReply(message) {
    return /^(?:option\s*)?\d+\b/i.test(String(message || '').trim());
}

/**
 * Clear reference lookups are fast and reliable on rules — skip slow Gemini retries.
 */
function shouldPreferRulesFastPath(message) {
    const text = String(message || '');
    if (isGreetingOrSmallTalk(text)) return true;
    return Boolean(
        extractQuoteReference(text) ||
            extractOrderNumber(text) ||
            extractFreightNumber(text) ||
            extractDisputeId(text) ||
            extractSageDocumentNumber(text) ||
            extractFreightInvoiceReference(text) ||
            extractSupplierInvoiceReference(text) ||
            extractBatchNumber(text) ||
            extractClearanceNumber(text) ||
            extractCashbookBankRef(text) ||
            extractWaybill(text)
    );
}

function isWeakAiResult(result) {
    if (!result) return true;
    if (isDefaultHelpReply(result.reply)) return true;
    if (!result.reply || !String(result.reply).trim()) return true;
    return false;
}

function findLastFreightInHistory(history) {
    if (!Array.isArray(history)) return null;
    for (let i = history.length - 1; i >= 0; i--) {
        const hit = extractFreightNumber(history[i]?.content || '');
        if (hit) return hit;
    }
    return null;
}

async function hydrateSession(sessionId, userId) {
    if (isHydrated(sessionId)) return;
    try {
        await ensureTables();
        const [meta, history] = await Promise.all([
            getSessionMeta(userId, sessionId),
            getChatHistory(userId, sessionId, { limit: 40 }),
        ]);
        const lastFreight =
            meta?.last_freight_number || findLastFreightInHistory(history) || null;
        markHydrated(sessionId, {
            userId,
            lastFreightNumber: lastFreight,
            history,
        });
    } catch (err) {
        console.warn('AI chat hydrate failed:', err.message);
        markHydrated(sessionId, { userId });
    }
}

async function persistTurn({ userId, sessionId, userText, result }) {
    try {
        const freight =
            result?.data?.freight?.freight_number ||
            result?.data?.focusedAnswer?.freightNumber ||
            getLastFreightNumber(sessionId) ||
            extractFreightNumber(userText) ||
            null;
        await saveChatMessage({
            userId,
            sessionId,
            role: 'user',
            content: userText,
            lastFreightNumber: freight,
        });
        await saveChatMessage({
            userId,
            sessionId,
            role: 'assistant',
            content: result.reply,
            data: result.data || null,
            provider: result.provider || null,
            lastFreightNumber: freight,
        });
    } catch (err) {
        console.warn('AI chat persist failed:', err.message);
    }
}

function buildSuccess(result, ctx, sid) {
    return {
        success: true,
        reply: result.reply,
        data: result.data || null,
        sessionId: sid,
        provider: result.provider,
        user: {
            id: ctx.userId,
            name: ctx.fullName,
            userType: ctx.userType,
            clientNumber: ctx.clientNumber,
        },
    };
}

/**
 * Prefer Gemini AI first. Fall back to rule-based routing when needed.
 * Persists chat history so refresh restores the conversation (chatbot-style).
 */
async function processChatMessage({ message, userId, sessionId }) {
    if (!message || !message.trim()) {
        return { success: false, message: 'Message is required.' };
    }

    if (!userId) {
        return { success: false, message: 'user_id is required.' };
    }

    const ctx = await loadUserContext(userId);
    if (!ctx) {
        return { success: false, message: 'User not found or inactive.' };
    }

    const sid = sessionId || `user-${userId}`;
    await hydrateSession(sid, userId);

    const trimmedMessage = message.trim();
    addMessage(sid, 'user', trimmedMessage);

    const session = getSession(sid);
    const waitingForChoice = Boolean(session.pendingAction && session.candidates.length);

    let result = null;
    let triedGemini = false;
    const preferRules = shouldPreferRulesFastPath(trimmedMessage);

    if ((waitingForChoice && isSelectionReply(trimmedMessage)) || preferRules) {
        result = await ruleBasedRoute(trimmedMessage, ctx, sid);
        result.provider = result.provider || 'rules';
        if (preferRules && !isWeakAiResult(result)) {
            addMessage(sid, 'assistant', result.reply);
            await persistTurn({ userId, sessionId: sid, userText: trimmedMessage, result });
            return buildSuccess(result, ctx, sid);
        }
    } else if (isGeminiAvailable()) {
        triedGemini = true;
        try {
            const geminiResult = await chatWithGemini(trimmedMessage, getHistory(sid), ctx, sid);
            if (geminiResult && !isWeakAiResult(geminiResult)) {
                result = geminiResult;
                result.provider = geminiResult.provider || 'gemini';
            } else if (geminiResult == null) {
                // cooldown / quota — silent rules fallback
            } else {
                console.warn('Gemini returned weak/empty result — falling back to rules');
            }
        } catch (err) {
            const short = /429|quota|Too Many Requests/i.test(err.message)
                ? 'Gemini quota exceeded — using rules'
                : String(err.message || err).slice(0, 160);
            console.warn('Gemini error, falling back to rules:', short);
        }
    }

    if (!result || isWeakAiResult(result)) {
        result = await ruleBasedRoute(trimmedMessage, ctx, sid);
        result.provider = triedGemini ? 'rules-fallback' : 'rules';
    }

    if (waitingForChoice && isSelectionReply(trimmedMessage) && isDefaultHelpReply(result.reply)) {
        result = {
            reply: 'Please tap a client from the list, or reply with a valid number from the options shown.',
            data: { candidates: session.candidates },
            provider: 'rules',
        };
    }

    addMessage(sid, 'assistant', result.reply);
    await persistTurn({ userId, sessionId: sid, userText: trimmedMessage, result });
    return buildSuccess(result, ctx, sid);
}

module.exports = { processChatMessage };
