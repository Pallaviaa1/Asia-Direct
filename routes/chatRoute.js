const router = require("express").Router();
const auth = require("../helpers/authJwt");
const chat = require("../controllers/chatController");

router.post("/chat/createConversation", chat.createConversation);
router.post("/chat/sendMessage", chat.sendMessage);
router.post("/chat/getMessages", chat.getMessages);
router.post("/chat/getInbox", chat.getInbox);
router.post("/chat/getAdminInbox", chat.getAdminInbox);
router.post("/chat/markAsRead", chat.markAsRead);
router.post("/markMessagesRead", chat.markMessagesRead)

// ============== Leaves =============== //

router.post("/applyStaffLeave", chat.applyStaffLeave);
router.post("/getMystaffLeaves", chat.getMystaffLeaves);
router.post("/getAllStaffLeaveRequests", chat.getAllStaffLeaveRequests);
router.post("/updateStaffLeaveStatus", chat.updateStaffLeaveStatus);

// ============= Feedbacks ============= //

router.post("/add-Feedback", chat.addFeedback);
router.post("/get-Feedback", chat.getFeedback);


module.exports = router;
