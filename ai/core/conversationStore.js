const sessions = new Map();

function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            history: [],
            pendingAction: null,
            candidates: [],
            lastFreightNumber: null,
            hydrated: false,
            userId: null,
            updatedAt: Date.now(),
        });
    }
    return sessions.get(sessionId);
}

function addMessage(sessionId, role, content) {
    const session = getSession(sessionId);
    session.history.push({ role, content, at: Date.now() });
    if (session.history.length > 40) {
        session.history = session.history.slice(-40);
    }
    session.updatedAt = Date.now();
}

function setPendingDisambiguation(sessionId, pendingAction, candidates) {
    const session = getSession(sessionId);
    session.pendingAction = pendingAction;
    session.candidates = candidates;
    session.updatedAt = Date.now();
}

function clearPending(sessionId) {
    const session = getSession(sessionId);
    session.pendingAction = null;
    session.candidates = [];
}

function setLastFreightNumber(sessionId, freightNumber) {
    if (!sessionId || !freightNumber) return;
    const session = getSession(sessionId);
    session.lastFreightNumber = String(freightNumber).trim();
    session.updatedAt = Date.now();
}

function getLastFreightNumber(sessionId) {
    if (!sessionId) return null;
    return getSession(sessionId).lastFreightNumber || null;
}

function getHistory(sessionId) {
    return getSession(sessionId).history;
}

function markHydrated(sessionId, { userId, lastFreightNumber, history } = {}) {
    const session = getSession(sessionId);
    session.hydrated = true;
    if (userId) session.userId = userId;
    if (lastFreightNumber) session.lastFreightNumber = lastFreightNumber;
    if (Array.isArray(history) && history.length && !session.history.length) {
        session.history = history.map((h) => ({
            role: h.role,
            content: h.content,
            at: h.created_at ? new Date(h.created_at).getTime() : Date.now(),
        }));
    }
}

function isHydrated(sessionId) {
    return Boolean(getSession(sessionId).hydrated);
}

function clearSessionMemory(sessionId) {
    if (!sessionId) return;
    sessions.delete(sessionId);
}

module.exports = {
    getSession,
    addMessage,
    setPendingDisambiguation,
    clearPending,
    setLastFreightNumber,
    getLastFreightNumber,
    getHistory,
    markHydrated,
    isHydrated,
    clearSessionMemory,
};
