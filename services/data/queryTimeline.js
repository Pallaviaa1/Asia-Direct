const { query } = require('../../helpers/dbQuery');

const PIPELINE = ['Lodged', 'Under Review', 'In Progress', 'Awaiting Customer', 'Resolved'];

let tableReady = null;

function clean(value) {
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
}

async function ensureQueryTimelineTable() {
    if (tableReady) return true;
    await query(`
        CREATE TABLE IF NOT EXISTS tbl_query_timeline (
          id int(11) NOT NULL AUTO_INCREMENT,
          query_id int(11) NOT NULL,
          stage varchar(100) NOT NULL,
          outcome varchar(100) DEFAULT NULL,
          note text DEFAULT NULL,
          updated_by int(11) DEFAULT NULL,
          created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_query_timeline_query (query_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    tableReady = true;
    return true;
}

function canonicalStage(stage, outcome) {
    const raw = `${stage || ''} ${outcome || ''}`.trim().toLowerCase();
    if (!raw || raw === 'pending' || raw.includes('lodged')) return 'Lodged';
    if (raw.includes('review')) return 'Under Review';
    if (raw.includes('await')) return 'Awaiting Customer';
    if (raw.includes('progress') || raw === 'open') return 'In Progress';
    if (raw.includes('resolv') || raw.includes('closed') || raw.includes('complete')) return 'Resolved';
    return clean(stage) || clean(outcome) || 'Lodged';
}

async function addTimelineEvent({ queryId, stage, outcome, note, updatedBy, createdAt }) {
    if (!queryId) return;
    await ensureQueryTimelineTable();
    const stageName = canonicalStage(stage, outcome);
    const outcomeValue = clean(outcome) || (stageName === 'Lodged' ? 'Pending' : stageName);
    const noteValue = clean(note);

    const latest = await query(
        `SELECT stage, outcome, note
         FROM tbl_query_timeline
         WHERE query_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [queryId]
    );
    if (latest.length > 0) {
        const sameStage = canonicalStage(latest[0].stage, latest[0].outcome) === stageName;
        const sameOutcome = clean(latest[0].outcome) === outcomeValue;
        const sameNote = clean(latest[0].note) === noteValue;
        if (sameStage && sameOutcome && sameNote) return;
    }

    if (createdAt) {
        await query(
            `INSERT INTO tbl_query_timeline (query_id, stage, outcome, note, updated_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [queryId, stageName, outcomeValue, noteValue, updatedBy || null, createdAt]
        );
        return;
    }

    await query(
        `INSERT INTO tbl_query_timeline (query_id, stage, outcome, note, updated_by)
         VALUES (?, ?, ?, ?, ?)`,
        [queryId, stageName, outcomeValue, noteValue, updatedBy || null]
    );
}

async function recordQueryLodged({ queryId, message, userId, createdAt }) {
    await addTimelineEvent({
        queryId,
        stage: 'Lodged',
        outcome: 'Pending',
        note: clean(message) || 'Dispute lodged',
        updatedBy: userId || null,
        createdAt: createdAt || null,
    });
}

async function recordQueryUpdate({ queryId, outcome, resolution, stage, note, updatedBy }) {
    const stageName = canonicalStage(stage, outcome);
    const noteValue = clean(note) || clean(resolution);
    await addTimelineEvent({
        queryId,
        stage: stageName,
        outcome: clean(outcome) || stageName,
        note: noteValue,
        updatedBy,
    });
}

function buildStageTracker(timeline, currentOutcome) {
    const reached = new Map();
    timeline.forEach((event) => {
        const key = canonicalStage(event.stage, event.outcome);
        if (!reached.has(key)) reached.set(key, event.created_at);
    });

    const latest = timeline[timeline.length - 1];
    const current = canonicalStage(latest && latest.stage, currentOutcome || (latest && latest.outcome));
    const names = PIPELINE.slice();
    if (current && !names.includes(current)) names.push(current);

    return names.map((name) => ({
        stage: name,
        state: name === current ? 'current' : (reached.has(name) ? 'completed' : 'upcoming'),
        reached_at: reached.get(name) || null,
    }));
}

async function getQueryTimelineView(queryRow) {
    await ensureQueryTimelineTable();
    const existing = await query(
        'SELECT id FROM tbl_query_timeline WHERE query_id = ? LIMIT 1',
        [queryRow.id]
    );
    if (existing.length === 0) {
        await recordQueryLodged({
            queryId: queryRow.id,
            message: queryRow.message,
            userId: queryRow.user_id,
            createdAt: queryRow.created || null,
        });
    }

    const timeline = await query(
        `SELECT id, query_id, stage, outcome, note, updated_by, created_at
         FROM tbl_query_timeline
         WHERE query_id = ?
         ORDER BY created_at ASC, id ASC`,
        [queryRow.id]
    );

    const currentStage = canonicalStage(
        timeline.length ? timeline[timeline.length - 1].stage : null,
        queryRow.outcome
    );

    return {
        ...queryRow,
        current_stage: currentStage,
        stages: buildStageTracker(timeline, queryRow.outcome),
        timeline,
    };
}

module.exports = {
    ensureQueryTimelineTable,
    recordQueryLodged,
    recordQueryUpdate,
    getQueryTimelineView,
};
