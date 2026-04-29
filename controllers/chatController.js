const db = require("../config/database");

const detectParticipantType = (id, callback) => {
    db.query(
        "SELECT id FROM tbl_users WHERE id=? AND is_deleted=0",
        [id],
        (err, rows) => {
            if (err) return callback(err, null);
            if (rows.length > 0) return callback(null, 'user');

            db.query(
                "SELECT id FROM tbl_suppliers WHERE id=? AND is_deleted=0",
                [id],
                (err, rows) => {
                    if (err) return callback(err, null);
                    if (rows.length > 0) return callback(null, 'supplier');

                    return callback(null, null);
                }
            );
        }
    );
};

// exports.createConversation = (req, res) => {
//     const { sender_id, receiver_id } = req.body;

//     if (!sender_id || !receiver_id) {
//         return res.status(400).json({
//             success: false,
//             message: "sender_id & receiver_id required"
//         });
//     }

//     if (sender_id === receiver_id) {
//         return res.status(400).json({
//             success: false,
//             message: "Cannot create conversation with yourself"
//         });
//     }

//     detectParticipantType(sender_id, (err, senderType) => {
//         if (err) return res.status(500).json({ success: false, error: err });

//         if (!senderType) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Invalid sender"
//             });
//         }

//         detectParticipantType(receiver_id, (err, receiverType) => {
//             if (err) return res.status(500).json({ success: false, error: err });

//             if (!receiverType) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Invalid receiver"
//                 });
//             }

//             // Check existing conversation
//             const checkSql = `
//                 SELECT c.id 
//                 FROM tbl_conversations c
//                 JOIN tbl_conversation_members m1 ON c.id = m1.conversation_id
//                 JOIN tbl_conversation_members m2 ON c.id = m2.conversation_id
//                 WHERE c.type = 'private'
//                   AND c.is_deleted = 0
//                   AND m1.user_id = ? AND m1.participant_type = ?
//                   AND m2.user_id = ? AND m2.participant_type = ?
//                 LIMIT 1
//             `;

//             db.query(
//                 checkSql,
//                 [sender_id, senderType, receiver_id, receiverType],
//                 (err, rows) => {
//                     if (err) {
//                         return res.status(500).json({ success: false, error: err });
//                     }

//                     if (rows.length > 0) {
//                         return res.json({
//                             success: true,
//                             conversation_id: rows[0].id
//                         });
//                     }

//                     // Create conversation
//                     db.query(
//                         "INSERT INTO tbl_conversations (type, created_by) VALUES ('private', ?)",
//                         [sender_id],
//                         (err, result) => {
//                             if (err) {
//                                 return res.status(500).json({ success: false, error: err });
//                             }

//                             const conversation_id = result.insertId;

//                             const members = [
//                                 [conversation_id, sender_id, senderType],
//                                 [conversation_id, receiver_id, receiverType]
//                             ];

//                             db.query(
//                                 `INSERT INTO tbl_conversation_members 
//                                  (conversation_id, user_id, participant_type)
//                                  VALUES ?`,
//                                 [members],
//                                 (err) => {
//                                     if (err) {
//                                         return res.status(500).json({ success: false, error: err });
//                                     }

//                                     res.json({
//                                         success: true,
//                                         conversation_id
//                                     });
//                                 }
//                             );
//                         }
//                     );
//                 }
//             );
//         });
//     });
// };

// 11/03/2026

exports.createConversation = (req, res) => {
    const { sender_id, sender_type, receiver_id, receiver_type } = req.body;

    if (!sender_id || !receiver_id || !sender_type || !receiver_type) {
        return res.status(400).json({
            success: false,
            message: "sender_id, sender_type, receiver_id, receiver_type required"
        });
    }

    if (sender_id === receiver_id && sender_type === receiver_type) {
        return res.status(400).json({
            success: false,
            message: "Cannot create conversation with yourself"
        });
    }

    // check if conversation already exists
    const checkSql = `
        SELECT c.id
        FROM tbl_conversations c
        JOIN tbl_conversation_members m1 ON c.id = m1.conversation_id
        JOIN tbl_conversation_members m2 ON c.id = m2.conversation_id
        WHERE c.type = 'private'
          AND c.is_deleted = 0
          AND m1.user_id = ?
          AND m1.participant_type = ?
          AND m2.user_id = ?
          AND m2.participant_type = ?
        LIMIT 1
    `;

    db.query(
        checkSql,
        [sender_id, sender_type, receiver_id, receiver_type],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    error: err
                });
            }

            // conversation already exists
            if (rows.length > 0) {
                return res.json({
                    success: true,
                    conversation_id: rows[0].id
                });
            }

            // create new conversation
            db.query(
                "INSERT INTO tbl_conversations (type, created_by) VALUES ('private', ?)",
                [sender_id],
                (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            success: false,
                            error: err
                        });
                    }

                    const conversation_id = result.insertId;

                    const members = [
                        [conversation_id, sender_id, sender_type],
                        [conversation_id, receiver_id, receiver_type]
                    ];

                    const insertMembers = `
                        INSERT INTO tbl_conversation_members 
                        (conversation_id, user_id, participant_type)
                        VALUES ?
                    `;

                    db.query(insertMembers, [members], (err) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({
                                success: false,
                                error: err
                            });
                        }

                        return res.json({
                            success: true,
                            conversation_id
                        });
                    });
                }
            );
        }
    );
};

// exports.sendMessage = (req, res) => {
//     const { sender_id, conversation_id, message, message_type = "text" } = req.body;

//     if (!sender_id || !conversation_id || !message?.trim()) {
//         return res.status(400).json({
//             success: false,
//             message: "sender_id, conversation_id and message are required"
//         });
//     }

//     // Check sender is part of conversation + get sender type
//     const memberCheck = `
//         SELECT participant_type 
//         FROM tbl_conversation_members
//         WHERE conversation_id = ? AND user_id = ?
//         LIMIT 1
//     `;

//     db.query(memberCheck, [conversation_id, sender_id], (err, rows) => {
//         if (err) {
//             return res.status(500).json({ success: false, error: err });
//         }

//         if (rows.length === 0) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Not a conversation member"
//             });
//         }

//         const sender_type = rows[0].participant_type;

//         // Save message
//         const insertSql = `
//             INSERT INTO tbl_chat_messages
//             (conversation_id, sender_id, sender_type, message, message_type)
//             VALUES (?, ?, ?, ?, ?)
//         `;

//         db.query(
//             insertSql,
//             [conversation_id, sender_id, sender_type, message, message_type],
//             (err, result) => {
//                 if (err) {
//                     return res.status(500).json({ success: false, error: err });
//                 }

//                 const payload = {
//                     message_id: result.insertId,
//                     conversation_id,
//                     sender_id,
//                     sender_type,
//                     message,
//                     message_type,
//                     created_at: new Date()
//                 };

//                 // REAL-TIME SOCKET EMIT
//                 if (global.io) {
//                     global.io
//                         .to(`chat_${conversation_id}`)
//                         .emit("newMessage", payload);
//                 }

//                 res.json({
//                     success: true,
//                     message_id: result.insertId
//                 });
//             }
//         );
//     });
// };


// 11/03/2026

exports.sendMessage = (req, res) => {
    const { sender_id, conversation_id, message, message_type = "text" } = req.body;

    if (!sender_id || !conversation_id) {
        return res.status(400).json({
            success: false,
            message: "sender_id and conversation_id are required"
        });
    }

    if (!message || !message.trim()) {
        return res.status(400).json({
            success: false,
            message: "Message cannot be empty"
        });
    }

    const cleanMessage = message.trim();

    // Check sender is member of conversation
    const memberCheck = `
        SELECT participant_type
        FROM tbl_conversation_members
        WHERE conversation_id = ? AND user_id = ?
        LIMIT 1
    `;

    db.query(memberCheck, [conversation_id, sender_id], (err, rows) => {

        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: err });
        }

        if (rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Not a conversation member"
            });
        }

        const sender_type = rows[0].participant_type;

        const insertSql = `
            INSERT INTO tbl_chat_messages
            (conversation_id, sender_id, sender_type, message, message_type)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(
            insertSql,
            [conversation_id, sender_id, sender_type, cleanMessage, message_type],
            (err, result) => {

                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, error: err });
                }

                const payload = {
                    message_id: result.insertId,
                    conversation_id,
                    sender_id,
                    sender_type,
                    message: cleanMessage,
                    message_type,
                    created_at: new Date()
                };

                // SOCKET REALTIME
                if (global.io) {
                    global.io.to(`chat_${conversation_id}`).emit("newMessage", payload);
                }

                return res.json({
                    success: true,
                    message_id: result.insertId
                });
            }
        );
    });
};

// exports.getMessages = (req, res) => {
//     const { conversation_id, receiver_id } = req.body;

//     if (!conversation_id || !receiver_id) {
//         return res.status(400).json({
//             success: false,
//             message: "conversation_id & receiver_id are required"
//         });
//     }

//     // First check user is member of conversation
//     const checkSql = `
//         SELECT 1 
//         FROM tbl_conversation_members
//         WHERE conversation_id = ? AND user_id = ?
//         LIMIT 1
//     `;

//     db.query(checkSql, [conversation_id, receiver_id], (err, checkRows) => {
//         if (err) {
//             return res.status(500).json({ success: false, error: err });
//         }

//         if (checkRows.length === 0) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Access denied"
//             });
//         }

//         // Fetch messages
//         const sql = `
//             SELECT 
//                 m.id AS message_id,
//                 m.conversation_id,
//                 m.sender_id,
//                 m.sender_type,
//                 m.message,
//                 m.message_type,
//                 m.created_at,

//                 COALESCE(u.full_name, s.name) AS sender_name,
//                 COALESCE(u.profile, s.profile) AS sender_profile

//             FROM tbl_chat_messages m

//             LEFT JOIN tbl_users u
//                 ON u.id = m.sender_id
//                AND m.sender_type = 'user'

//             LEFT JOIN tbl_suppliers s
//                 ON s.id = m.sender_id
//                AND m.sender_type = 'supplier'

//             WHERE m.conversation_id = ?
//             ORDER BY m.id ASC
//         `;

//         db.query(sql, [conversation_id], (err, rows) => {
//             if (err) {
//                 return res.status(500).json({ success: false, error: err });
//             }

//             res.json({
//                 success: true,
//                 messages: rows
//             });
//         });
//     });
// };


// 11/03/2026

exports.getMessages = (req, res) => {

    const { conversation_id, receiver_id } = req.body;

    if (!conversation_id || !receiver_id) {
        return res.status(400).json({
            success: false,
            message: "conversation_id and receiver_id are required"
        });
    }

    // Verify membership
    const checkSql = `
        SELECT 1
        FROM tbl_conversation_members
        WHERE conversation_id = ? AND user_id = ?
        LIMIT 1
    `;

    db.query(checkSql, [conversation_id, receiver_id], (err, checkRows) => {

        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: err });
        }

        if (checkRows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const sql = `
            SELECT 
                m.id AS message_id,
                m.conversation_id,
                m.sender_id,
                m.sender_type,
                m.message,
                m.message_type,
                m.created_at,

                COALESCE(u.full_name, s.name) AS sender_name,
                COALESCE(u.profile, s.profile) AS sender_profile

            FROM tbl_chat_messages m

            LEFT JOIN tbl_users u
                ON u.id = m.sender_id
               AND m.sender_type = 'user'

            LEFT JOIN tbl_suppliers s
                ON s.id = m.sender_id
               AND m.sender_type = 'supplier'

            WHERE m.conversation_id = ?
            ORDER BY m.id ASC
        `;

        db.query(sql, [conversation_id], (err, rows) => {

            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, error: err });
            }

            return res.json({
                success: true,
                messages: rows
            });
        });

    });
};

// 11/03/2026
// exports.getInbox = (req, res) => {
//     const { receiver_id } = req.body;

//     if (!receiver_id) {
//         return res.status(400).json({
//             success: false,
//             message: "receiver_id required"
//         });
//     }

//     const sql = `
//         SELECT
//             c.id AS conversation_id,

//             other.user_id AS sender_id,
//             other.participant_type AS sender_type,

//             COALESCE(u.full_name, s.name) AS sender_name,
//             COALESCE(u.profile, s.profile) AS sender_profile,

//             lm.message AS last_message,
//             lm.message_type,
//             lm.created_at AS last_time,

//             (
//                 SELECT COUNT(*)
//                 FROM tbl_chat_messages m2
//                 LEFT JOIN tbl_message_reads r
//                     ON r.message_id = m2.id
//                    AND r.user_id = ?
//                 WHERE m2.conversation_id = c.id
//                   AND m2.sender_id != ?
//                   AND r.id IS NULL
//             ) AS unread_count

//         FROM tbl_conversations c

//         JOIN tbl_conversation_members me
//             ON me.conversation_id = c.id
//            AND me.user_id = ?

//         JOIN tbl_conversation_members other
//             ON other.conversation_id = c.id
//            AND other.user_id != me.user_id

//         LEFT JOIN tbl_users u
//             ON u.id = other.user_id
//            AND other.participant_type = 'user'

//         LEFT JOIN tbl_suppliers s
//             ON s.id = other.user_id
//            AND other.participant_type = 'supplier'

//         LEFT JOIN tbl_chat_messages lm
//             ON lm.id = (
//                 SELECT id
//                 FROM tbl_chat_messages
//                 WHERE conversation_id = c.id
//                 ORDER BY id DESC
//                 LIMIT 1
//             )

//         WHERE c.is_deleted = 0
//         ORDER BY last_time DESC
//     `;

//     db.query(sql, [receiver_id, receiver_id, receiver_id], (err, rows) => {
//         if (err) {
//             console.error(err);
//             return res.status(500).json(err);
//         }

//         res.json({
//             success: true,
//             inbox: rows
//         });
//     });
// };

// exports.getInbox = (req, res) => {

//     const { receiver_id, receiver_type } = req.body;

//     if (!receiver_id || !receiver_type) {
//         return res.status(400).json({
//             success: false,
//             message: "receiver_id and receiver_type required"
//         });
//     }

//     const sql = `
//         SELECT
//             c.id AS conversation_id,

//             other.user_id AS sender_id,
//             other.participant_type AS sender_type,

//             COALESCE(u.full_name, s.name) AS sender_name,
//             COALESCE(u.profile, s.profile) AS sender_profile,

//             lm.message AS last_message,
//             lm.message_type,
//             lm.created_at AS last_time,

//             IFNULL((
//                 SELECT COUNT(*)
//                 FROM tbl_chat_messages m2
//                 LEFT JOIN tbl_message_reads r
//                     ON r.message_id = m2.id
//                    AND r.user_id = ?
//                 WHERE m2.conversation_id = c.id
//                 AND m2.sender_id != ?
//                 AND r.id IS NULL
//             ),0) AS unread_count

//         FROM tbl_conversations c

//         JOIN tbl_conversation_members me
//             ON me.conversation_id = c.id
//            AND me.user_id = ?
//            AND me.participant_type = ?

//         JOIN tbl_conversation_members other
//             ON other.conversation_id = c.id
//            AND (other.user_id != me.user_id OR other.participant_type != me.participant_type)

//         LEFT JOIN tbl_users u
//             ON u.id = other.user_id
//            AND other.participant_type = 'user'

//         LEFT JOIN tbl_suppliers s
//             ON s.id = other.user_id
//            AND other.participant_type = 'supplier'

//         LEFT JOIN tbl_chat_messages lm
//             ON lm.id = (
//                 SELECT id
//                 FROM tbl_chat_messages
//                 WHERE conversation_id = c.id
//                 ORDER BY id DESC
//                 LIMIT 1
//             )

//         WHERE c.is_deleted = 0
//         ORDER BY lm.created_at DESC
//     `;

//     db.query(
//         sql,
//         [receiver_id, receiver_id, receiver_id, receiver_type],
//         (err, rows) => {

//             if (err) {
//                 console.error(err);
//                 return res.status(500).json({
//                     success: false,
//                     error: "Database error"
//                 });
//             }

//             res.json({
//                 success: true,
//                 inbox: rows
//             });
//         }
//     );
// };

exports.getInbox = (req, res) => {

    const { receiver_id, receiver_type } = req.body;

    if (!receiver_id || !receiver_type) {
        return res.status(400).json({
            success: false,
            message: "receiver_id and receiver_type required"
        });
    }

    const sql = `
        SELECT
            c.id AS conversation_id,

            other.user_id AS sender_id,
            other.participant_type AS sender_type,

            COALESCE(u.full_name, s.name) AS sender_name,
            COALESCE(u.profile, s.profile) AS sender_profile,

            lm.message AS last_message,
            lm.message_type,
            lm.created_at AS last_time,

            --  SIMPLE unread count (same as admin)
            IFNULL((
                SELECT COUNT(*)
                FROM tbl_chat_messages m2
                WHERE m2.conversation_id = c.id
                AND m2.is_read = 0
                AND m2.sender_id != ?
            ), 0) AS unread_count

        FROM tbl_conversations c

        JOIN tbl_conversation_members me
            ON me.conversation_id = c.id
           AND me.user_id = ?
           AND me.participant_type = ?

        JOIN tbl_conversation_members other
            ON other.conversation_id = c.id
           AND NOT (
                other.user_id = me.user_id 
                AND other.participant_type = me.participant_type
           )

        LEFT JOIN tbl_users u
            ON u.id = other.user_id
           AND other.participant_type = 'user'

        LEFT JOIN tbl_suppliers s
            ON s.id = other.user_id
           AND other.participant_type = 'supplier'

        LEFT JOIN tbl_chat_messages lm
            ON lm.id = (
                SELECT id
                FROM tbl_chat_messages
                WHERE conversation_id = c.id
                ORDER BY id DESC
                LIMIT 1
            )

        WHERE c.is_deleted = 0
        ORDER BY lm.created_at DESC
    `;

    db.query(
        sql,
        [receiver_id, receiver_id, receiver_type],
        (err, rows) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    error: "Database error"
                });
            }

            res.json({
                success: true,
                inbox: rows
            });
        }
    );
};

// exports.getAdminInbox = (req, res) => {
//     const { admin_id } = req.body;

//     if (!admin_id) {
//         return res.status(400).json({
//             success: false,
//             message: "admin_id required"
//         });
//     }

//     const sql = `
//         SELECT 
//             c.id AS conversation_id,

//             cm.user_id AS sender_id,
//             cm.participant_type,

//             CASE 
//                 WHEN cm.participant_type = 'user' 
//                 THEN u.full_name
//                 ELSE s.name
//             END AS sender_name,

//             CASE 
//                 WHEN cm.participant_type = 'user' 
//                 THEN u.profile
//                 ELSE s.profile
//             END AS profile,

//             m.message AS last_message,
//             m.message_type,
//             m.created_at AS last_time

//         FROM tbl_conversations c

//         JOIN tbl_conversation_members admin_cm 
//             ON c.id = admin_cm.conversation_id
//             AND admin_cm.user_id = ?
//             AND admin_cm.participant_type = 'user'

//         JOIN tbl_conversation_members cm 
//             ON c.id = cm.conversation_id
//             AND cm.user_id != admin_cm.user_id

//         LEFT JOIN tbl_users u 
//             ON u.id = cm.user_id 
//             AND cm.participant_type = 'user'

//         LEFT JOIN tbl_suppliers s 
//             ON s.id = cm.user_id 
//             AND cm.participant_type = 'supplier'

//         LEFT JOIN tbl_chat_messages m 
//             ON m.id = (
//                 SELECT id FROM tbl_chat_messages
//                 WHERE conversation_id = c.id
//                 ORDER BY id DESC
//                 LIMIT 1
//             )

//         WHERE c.is_deleted = 0
//         ORDER BY last_time DESC
//     `;

//     db.query(sql, [admin_id], (err, rows) => {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 error: err
//             });
//         }

//         res.json({
//             success: true,
//             inbox: rows
//         });
//     });
// };

exports.getAdminInbox = (req, res) => {
    const { admin_id } = req.body;

    if (!admin_id) {
        return res.status(400).json({
            success: false,
            message: "admin_id required"
        });
    }

    const sql = `
        SELECT 
            c.id AS conversation_id,

            cm.user_id AS sender_id,
            cm.participant_type,

            CASE 
                WHEN cm.participant_type = 'user' 
                THEN u.full_name
                ELSE s.name
            END AS sender_name,

            CASE 
                WHEN cm.participant_type = 'user' 
                THEN u.profile
                ELSE s.profile
            END AS profile,

            m.message AS last_message,
            m.message_type,
            m.created_at AS last_time,

            --  FIXED unread count
            IFNULL((
                SELECT COUNT(*) 
                FROM tbl_chat_messages m2
                WHERE m2.conversation_id = c.id
                AND m2.is_read = 0
                AND m2.sender_id != ?   -- exclude admin messages
            ), 0) AS unread_count

        FROM tbl_conversations c

        JOIN tbl_conversation_members admin_cm 
            ON c.id = admin_cm.conversation_id
            AND admin_cm.user_id = ?
            AND admin_cm.participant_type = 'user'

        JOIN tbl_conversation_members cm 
            ON c.id = cm.conversation_id
            AND cm.user_id != admin_cm.user_id

        LEFT JOIN tbl_users u 
            ON u.id = cm.user_id 
            AND cm.participant_type = 'user'

        LEFT JOIN tbl_suppliers s 
            ON s.id = cm.user_id 
            AND cm.participant_type = 'supplier'

        LEFT JOIN tbl_chat_messages m 
            ON m.id = (
                SELECT id FROM tbl_chat_messages
                WHERE conversation_id = c.id
                ORDER BY id DESC
                LIMIT 1
            )

        WHERE c.is_deleted = 0
        ORDER BY last_time DESC
    `;

    // pass admin_id twice
    db.query(sql, [admin_id, admin_id], (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err
            });
        }

        res.json({
            success: true,
            inbox: rows
        });
    });
};

exports.markMessagesRead = (req, res) => {
    const { conversation_id, current_user_id } = req.body;

    if (!conversation_id || !current_user_id) {
        return res.status(400).json({
            success: false,
            message: "conversation_id and current_user_id are required"
        });
    }

    const sql = `
        UPDATE tbl_chat_messages
        SET is_read = 1
        WHERE conversation_id = ?
        AND sender_id != ?
        AND is_read = 0
    `;

    db.query(sql, [conversation_id, current_user_id], (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err
            });
        }

        res.json({
            success: true,
            message: `All messages from other users in conversation ${conversation_id} marked as read.`,
            affectedRows: result.affectedRows
        });
    });
};

exports.markAsRead = (req, res) => {
    const { receiver_id, message_id, conversation_id } = req.body;

    if (!receiver_id || !message_id || !conversation_id) {
        return res.status(400).json({
            success: false,
            message: "receiver_id, message_id & conversation_id required"
        });
    }

    const sql = `
        INSERT IGNORE INTO tbl_message_reads (message_id, user_id)
        VALUES (?, ?)
    `;

    db.query(sql, [message_id, receiver_id], (err) => {
        if (err) return res.status(500).json(err);

        if (global.io) {
            global.io
                .to(`chat_${conversation_id}`)
                .emit("messageRead", {
                    message_id,
                    read_by: receiver_id
                });
        }

        res.json({
            success: true,
            message: "Marked as read"
        });
    });
};

exports.sendFileMessage = (req, res) => {
    const { sender_id, conversation_id } = req.body;

    if (!sender_id || !conversation_id || !req.file) {
        return res.status(400).json({ message: "Missing fields" });
    }

    const fileUrl = `/uploads/chat/${req.file.mimetype.startsWith("image/") ? "images" : "files"}/${req.file.filename}`;
    const message_type = req.file.mimetype.startsWith("image/") ? "image" : "file";

    const sql = `
        INSERT INTO tbl_chat_messages
        (conversation_id, sender_id, message, message_type)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [conversation_id, sender_id, fileUrl, message_type], (err, result) => {
        if (err) return res.status(500).json(err);

        const payload = {
            message_id: result.insertId,
            conversation_id,
            sender_id,
            message: fileUrl,
            message_type,
            created_at: new Date()
        };

        // REAL-TIME EMIT
        if (global.io) {
            global.io
                .to(`conversation_${conversation_id}`)
                .emit("newMessage", payload);
        }

        res.json({
            success: true,
            message: "File sent",
            data: payload
        });
    });
};


//============================== Leaves =========================//

exports.applyStaffLeave = (req, res) => {
    try {
        const { staff_id, leave_from, leave_to, reason } = req.body;

        if (!staff_id || !leave_from || !leave_to || !reason) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const startDate = new Date(leave_from);
        const endDate = new Date(leave_to);

        if (isNaN(startDate) || isNaN(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format"
            });
        }

        if (endDate < startDate) {
            return res.status(400).json({
                success: false,
                message: "End date cannot be before start date"
            });
        }

        const q = `
            INSERT INTO tbl_leaves
            (staff_id, leave_from, leave_to, reason)
            VALUES (?, ?, ?, ?)
        `;

        db.query(
            q,
            [staff_id, leave_from, leave_to, reason],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error",
                        error: err.message
                    });
                }

                res.status(200).json({
                    success: true,
                    message: "Leave request submitted successfully",
                    leave_id: result.insertId
                });
            }
        );

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllStaffLeaveRequests = (req, res) => {
    try {
        let { search, status, page, limit } = req.body;

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let where = `WHERE l.is_deleted = 0`;
        let params = [];

        if (status) {
            where += ` AND l.status = ?`;
            params.push(status);
        }

        if (search) {
            where += `
                AND (
                    s.full_name LIKE ?
                    OR l.reason LIKE ?
                )
            `;
            const val = `%${search}%`;
            params.push(val, val);
        }

        const countQ = `
            SELECT COUNT(*) AS total
            FROM tbl_leaves l
            JOIN tbl_users s ON s.id = l.staff_id
            ${where}
        `;

        db.query(countQ, params, (e1, cRes) => {
            if (e1) {
                return res.status(500).json({
                    success: false,
                    message: e1.message
                });
            }

            const total = cRes[0].total;

            const dataQ = `
                SELECT
                    l.id as leave_id,
                    l.leave_from,
                    l.leave_to,
                    l.reason,
                    l.status,
                    l.admin_remark,
                    l.created_at,
                    s.id AS staff_id,
                    s.full_name AS staff_name
                FROM tbl_leaves l
                JOIN tbl_users s ON s.id = l.staff_id
                ${where}
                ORDER BY l.id DESC
                LIMIT ? OFFSET ?
            `;

            db.query(
                dataQ,
                [...params, limit, offset],
                (e2, rows) => {
                    if (e2) {
                        return res.status(500).json({
                            success: false,
                            message: e2.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "Leave requests fetched successfully",
                        data: rows,
                        total: total,
                        page,
                        limit
                    });
                }
            );
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateStaffLeaveStatus = (req, res) => {
    try {
        const { leave_id, status, admin_remark } = req.body;

        if (!leave_id || status === undefined) {
            return res.status(400).json({
                success: false,
                message: "leave_id and status are required"
            });
        }

        if (![0, 1, 2].includes(Number(status))) {
            return res.status(400).json({
                success: false,
                message: "Invalid status (0=Pending,1=Approved,2=Rejected)"
            });
        }

        const q = `
            UPDATE tbl_leaves
            SET status = ?, admin_remark = ?
            WHERE id = ? AND is_deleted = 0
        `;

        db.query(
            q,
            [status, admin_remark || null, leave_id],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Leave request not found"
                    });
                }

                res.status(200).json({
                    success: true,
                    message:
                        status == 1
                            ? "Leave approved successfully"
                            : status == 2
                                ? "Leave rejected successfully"
                                : "Leave set to pending"
                });
            }
        );

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMystaffLeaves = (req, res) => {
    try {
        let { staff_id, status, page=1, limit=10 } = req.body;

        if (!staff_id) {
            return res.status(400).json({
                success: false,
                message: "staff_id is required"
            });
        }

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let where = `
            WHERE is_deleted = 0
            AND staff_id = ?
        `;
        let params = [staff_id];

        if (status !== undefined) {
            where += ` AND status = ?`;
            params.push(status);
        }

        /* ================= COUNT QUERY ================= */
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM tbl_leaves
            ${where}
        `;

        db.query(countQuery, params, (countErr, countRes) => {
            if (countErr) {
                return res.status(500).json({
                    success: false,
                    message: countErr.message
                });
            }

            const totalRecords = countRes[0].total;
            const totalPages = Math.ceil(totalRecords / limit);

            /* ================= DATA QUERY ================= */
            const dataQuery = `
                SELECT
                    id as leave_id,
                    leave_from,
                    leave_to,
                    reason,
                    status,
                    admin_remark,
                    created_at,
                    updated_at
                FROM tbl_leaves
                ${where}
                ORDER BY id DESC
                LIMIT ? OFFSET ?
            `;

            db.query(
                dataQuery,
                [...params, limit, offset],
                (dataErr, rows) => {
                    if (dataErr) {
                        return res.status(500).json({
                            success: false,
                            message: dataErr.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "My leaves fetched successfully",
                        data: rows,
                        total: totalRecords,
                        total_pages: totalPages,
                        page,
                        limit
                    });
                }
            );
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================ Feedbacks ======================== //

exports.addFeedback = (req, res) => {
    try {
        const { customer_id, staff_id, rating, feedback } = req.body;

        if (!customer_id || !staff_id || !rating) {
            return res.status(400).json({
                success: false,
                message: "customer_id, staff_id and rating are required"
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        /*  VALIDATE USER TYPES */
        const userCheckQuery = `
            SELECT id, user_type
            FROM tbl_users
            WHERE id IN (?, ?) AND is_deleted = 0
        `;

        db.query(
            userCheckQuery,
            [customer_id, staff_id],
            (err, users) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                const customer = users.find(u => u.id == customer_id);
                const staff = users.find(u => u.id == staff_id);

                if (!customer || customer.user_type != 3) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid customer"
                    });
                }

                if (!staff || staff.user_type != 2) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid staff"
                    });
                }

                /* OPTIONAL: PREVENT DUPLICATE FEEDBACK */
                const checkFeedbackQuery = `
                    SELECT id
                    FROM tbl_feedbacks
                    WHERE customer_id = ? AND staff_id = ? AND is_deleted = 0
                `;

                db.query(
                    checkFeedbackQuery,
                    [customer_id, staff_id],
                    (chkErr, chkRes) => {
                        if (chkErr) {
                            return res.status(500).json({
                                success: false,
                                message: chkErr.message
                            });
                        }

                        if (chkRes.length > 0) {
                            return res.status(409).json({
                                success: false,
                                message: "Feedback already submitted for this staff"
                            });
                        }

                        /* INSERT FEEDBACK */
                        const insertQuery = `
                            INSERT INTO tbl_feedbacks
                            (customer_id, staff_id, rating, feedback)
                            VALUES (?, ?, ?, ?)
                        `;

                        db.query(
                            insertQuery,
                            [customer_id, staff_id, rating, feedback || null],
                            (insErr, result) => {
                                if (insErr) {
                                    return res.status(500).json({
                                        success: false,
                                        message: insErr.message
                                    });
                                }

                                res.status(200).json({
                                    success: true,
                                    message: "Feedback submitted successfully",
                                    feedback_id: result.insertId
                                });
                            }
                        );
                    }
                );
            }
        );

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getFeedback = (req, res) => {
    try {
        let { staff_id, search, rating, page, limit } = req.body;

        if (!staff_id) {
            return res.status(400).json({
                success: false,
                message: "staff_id is required"
            });
        }

        page = page ? parseInt(page) : 1;
        limit = limit ? parseInt(limit) : 10;
        const offset = (page - 1) * limit;

        let where = `
            WHERE f.staff_id = ?
            AND f.is_deleted = 0
        `;
        let params = [staff_id];

        if (search) {
            where += `
                AND (
                    u.full_name LIKE ?
                    OR f.feedback LIKE ?
                )
            `;
            const s = `%${search}%`;
            params.push(s, s);
        }

        if (rating !== undefined) {
            where += ` AND f.rating = ?`;
            params.push(rating);
        }

        /* ================= SUMMARY QUERY ================= */
        const summaryQuery = `
            SELECT
                COUNT(*) AS total_reviews,
                ROUND(AVG(f.rating), 1) AS avg_rating
            FROM tbl_feedbacks f
            JOIN tbl_users u ON u.id = f.customer_id
            ${where}
        `;

        db.query(summaryQuery, params, (sErr, summaryRes) => {
            if (sErr) {
                return res.status(500).json({
                    success: false,
                    message: sErr.message
                });
            }

            const totalReviews = summaryRes[0].total_reviews;
            const avgRating = summaryRes[0].avg_rating || 0;

            /* ================= DATA QUERY ================= */
            const dataQuery = `
                SELECT
                    f.id as feedback_id,
                    f.rating,
                    f.feedback,
                    f.created_at,
                    f.customer_id,
                    u.full_name AS customer_name
                FROM tbl_feedbacks f
                JOIN tbl_users u ON u.id = f.customer_id
                ${where}
                ORDER BY f.id DESC
                LIMIT ? OFFSET ?
            `;

            db.query(
                dataQuery,
                [...params, limit, offset],
                (dErr, rows) => {
                    if (dErr) {
                        return res.status(500).json({
                            success: false,
                            message: dErr.message
                        });
                    }

                    res.status(200).json({
                        success: true,
                        message: "Staff feedback fetched successfully",
                        summary: {
                            average_rating: avgRating,
                            total_reviews: totalReviews
                        },
                        data: rows,
                        page,
                        limit
                    });
                }
            );
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
