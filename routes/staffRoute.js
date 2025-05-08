const express = require('express');
const staff_route = express();
const staffController = require('../controllers/staffController');
const { AddStaffValidation } = require('../helpers/validation');
const { authMiddleWare } = require('../helpers/authJwt');

const path = require('path');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (err, file, cb) {
        if (file.fieldname === "quote_document") {
            cb(null, path.join(__dirname, '../public/documents'));
        }
        if (file.fieldname === "profile") {
            cb(null, path.join(__dirname, '../public/images'));
        }
    },
    filename: function (err, file, cb) {
        cb(null, Date.now() + '-' + file.originalname, (err, success) => {
            if (err) {
                console.log(err);
            }
        });
    }
})

var upload = multer({ storage: storage })

staff_route.post('/add-staff', AddStaffValidation, staffController.AddStaff);
staff_route.get('/staff-list', staffController.GetStaffList);
staff_route.post('/delete-staff', staffController.DeleteStaff);
staff_route.post('/change-status', staffController.ChangeStatus);
staff_route.post('/update-staff', staffController.updateStaff);
staff_route.get('/GetAllPermissions', staffController.GetAllPermissions);
staff_route.post("/updateStaffPermission", staffController.updateStaffPermission)
staff_route.post("/getStaffPermissionsById", staffController.getStaffPermissionsById)
staff_route.post("/CheckPermission", staffController.CheckPermission)

module.exports = staff_route;