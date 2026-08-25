const router = require("express").Router();
const auth = require("../helpers/authJwt");
const chat = require("../controllers/chatController");
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // list of document fields
        const documentFields = [
            "attachment"
        ];

        if (documentFields.includes(file.fieldname)) {
            cb(null, path.join(__dirname, "../public/documents"));
        } else if (file.fieldname === "profile") {
            cb(null, path.join(__dirname, "../public/images"));
        } else {
            cb(new Error("Unexpected field: " + file.fieldname));
        }
    },

    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

var upload = multer({ storage: storage })


router.post("/chat/createConversation", chat.createConversation);
router.post("/chat/sendMessage", chat.sendMessage);
router.post("/chat/getMessages", chat.getMessages);
router.post("/chat/getInbox", chat.getInbox);
router.post("/chat/getAdminInbox", chat.getAdminInbox);
router.post("/chat/markAsRead", chat.markAsRead);
router.post("/markMessagesRead", chat.markMessagesRead)

// ============== Leaves =============== //

router.post("/applyStaffLeave", upload.single("attachment"), chat.applyStaffLeave);
router.post("/getMystaffLeaves", chat.getMystaffLeaves);
router.post("/getAllStaffLeaveRequests", chat.getAllStaffLeaveRequests);
router.post("/updateStaffLeaveStatus", chat.updateStaffLeaveStatus);
router.post("/deleteStaffLeave", chat.deleteStaffLeave);
router.get("/getStaffLeaveDetails/:leave_id", chat.getStaffLeaveById);

// ============= Feedbacks ============= //

router.post("/add-Feedback", chat.addFeedback);
router.post("/get-Feedback", chat.getFeedback);


module.exports = router;
