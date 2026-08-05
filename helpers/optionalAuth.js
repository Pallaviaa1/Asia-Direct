const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET } = process.env;

async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const user = jwt.verify(token, ACCESS_TOKEN_SECRET);
            req.user = user;
        } catch (error) {
            return res.status(401).send({
                success: false,
                message: 'Token is expired or invalid. Login again.',
            });
        }
    }

    next();
}

module.exports = { optionalAuth };
