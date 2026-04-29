const { check } = require('express-validator');

exports.userRegValidation = [
    check('firstname', 'please enter firstname').not().isEmpty(),
    check('lastname', 'please enter lastname').not().isEmpty(),
    check('email', 'please enter a valid email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    check('password', 'Password must be greater than 6 and contains at least one uppercase letter, one lowercase letter, and one number, and one special character')
        .isStrongPassword({
            minLength: 6,
            minUppercase: 1,
            minLowercase: 1,
            minNumber: 1,
            minSpecialCharacter: 1
        })
]

exports.adminLoginValidation = [
    check('email', 'please enter a valid email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    check('password', 'Please enter password').not().isEmpty()
]

exports.adminChangPassValidation = [
    check('id', 'Please enter id').not().isEmpty(),
    check('oldpassword', 'Please enter your old password').not().isEmpty(),
    check('newpassword', 'Please enter your new password').not().isEmpty()
]

exports.adminUpdateProfileValidation = [
    check('id', 'Please provide id').not().isEmpty(),
    check('full_name', 'Please enter your full name').not().isEmpty(),
    check('email', 'please enter a valid email').isEmail().normalizeEmail({ gmail_remove_dots: false })
]

exports.forgotPasswordValidation = [
    check('email', 'please enter a valid email').isEmail().normalizeEmail({ gmail_remove_dots: false })
]

exports.resetPasswordValidation = [
    check('newPassword', 'Please enter new password').not().isEmpty(),
]

exports.Privacy_TermValidation= [
    check('heading', 'Please enter heading').not().isEmpty(),
    check('description', 'Please enter description').not().isEmpty()
]

exports.AddfreightValidation= [
    check('client_ref', 'Please enter client ref').not().isEmpty(),
    check('type', 'Please enter type').not().isEmpty(),
    check('incoterm', 'Please enter incoterm').not().isEmpty(),
    check('weight', 'Please enter weight').not().isEmpty()
]

exports.UpdatefreightValidation= [
    check('freight_id', 'Please enter freight id').not().isEmpty(),
    check('client_ref', 'Please enter client ref').not().isEmpty(),
    check('type', 'Please enter type').not().isEmpty(),
    check('incoterm', 'Please enter incoterm').not().isEmpty(),
    check('weight', 'Please enter weight').not().isEmpty(),
    check('industry', 'Please enter industry').not().isEmpty()
]

exports.ClientfreightValidation= [
    check('freight_id', 'Please enter freight id').not().isEmpty(),
    check('type', 'Please enter type').not().isEmpty(),
    check('incoterm', 'Please enter incoterm').not().isEmpty(),
    check('weight', 'Please enter weight').not().isEmpty(),
    check('industry', 'Please enter industry').not().isEmpty()
]

exports.AddfreightByClientsValidation= [
    check('client_id', 'Please enter client id').not().isEmpty(),
    check('type', 'Please enter type').not().isEmpty(),
    check('incoterm', 'Please enter incoterm').not().isEmpty(),
    check('weight', 'Please enter weight').not().isEmpty(),
    check('industry', 'Please enter industry').not().isEmpty()
]

exports.AddCustomerValidation=[
    check('client_ref', 'Please enter client ref').not().isEmpty(),
    check('cellphone', 'Please enter cellphone').not().isEmpty(),
    check('telephone', 'Please enter telephone').not().isEmpty(),
    check('email', 'Please enter email').not().isEmpty(),
    check('code', 'Please enter code').not().isEmpty()
]

exports.RegisterCustomerValidation=[
    check('client_name', 'Please enter client name').not().isEmpty(),
    check('cellphone', 'Please enter cellphone').not().isEmpty(),
    check('email', 'Please enter email').not().isEmpty(),
    check('password', 'Please enter password').not().isEmpty()
]

exports.UpdateCustomerValidation=[
    check('client_id', 'Please enter client id').not().isEmpty(),
    check('cellphone', 'Please enter cellphone').not().isEmpty(),
    check('email', 'Please enter email').not().isEmpty()
]

exports.AddSupplierValidation=[
    check('supplier_email', 'Please enter supplier email').not().isEmpty()
]

exports.UpdateSupplierValidation=[
    check('supplier_id', 'Please enter supplier id').not().isEmpty(),
    check('supplier_email', 'Please enter supplier email').not().isEmpty()
]

exports.AddCountryValidation=[
    check('country_of_origin', 'Please enter country of origin').not().isEmpty(),
    check('china', 'Please enter china').not().isEmpty()
]

exports.UpdateCountryValidation=[
    check('country_id', 'Please enter country id').not().isEmpty(),
    check('country_of_origin', 'Please enter country of origin').not().isEmpty(),
    check('china', 'Please enter china').not().isEmpty()
]

exports.AddClearingValidation=[
    check('trans_reference', 'Please enter trans reference').not().isEmpty()
]

exports.UpdateClearingValidation=[
    check('clearing_id', 'Please enter clearing id').not().isEmpty()
]

exports.AddShipEstimateValidation=[
    check('serial_number', 'Please enter serial number').not().isEmpty(),
    check('date', 'Please enter date').not().isEmpty(),
    check('client_name', 'Please enter client name').not().isEmpty(),
    check('product_desc', 'Please enter product description').not().isEmpty(),
    check('dimension', 'Please enter dimension').not().isEmpty(),
    check('weight', 'Please enter weight').not().isEmpty()
]

exports.UpdateShipEstimateValidation=[
    check('estimate_id', 'Please enter estimate id').not().isEmpty(),
    check('serial_number', 'Please enter serial number').not().isEmpty(),
    check('date', 'Please enter date').not().isEmpty(),
    check('client_name', 'Please enter client name').not().isEmpty(),
    check('product_desc', 'Please enter product description').not().isEmpty(),
    check('dimension', 'Please enter dimension').not().isEmpty(),
    check('weight', 'Please enter weight').not().isEmpty()
]

exports.AddStaffValidation=[
    check('staff_name', 'Please enter staff name').not().isEmpty(),
    check('staff_email', 'Please enter staff email').not().isEmpty(),
    check('new_password', 'Please enter new password').not().isEmpty()
]

exports.RegisterSupplierValidation=[
    check('full_name', 'Please enter staff name').not().isEmpty(),
    check('email', 'Please enter staff email').not().isEmpty(),
    check('new_password', 'Please enter new password').not().isEmpty()
]
