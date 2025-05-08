const jwt = require("jsonwebtoken");
const con = require('../config/database');
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = process.env;

// console.log(ACCESS_TOKEN_SECRET)
const authServices = {
  genrateToken: async (user) => {
    try {
      let tokens = null;
      const { id } = user;
      const payload = {
        id: id
      };
      const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
        expiresIn: "14d",
      });

      // check user alredy has refresh token saved
      let findTokenQuery = "SELECT * FROM usertoken WHERE userId = ?";
      con.query(findTokenQuery, [user.id], (err, data) => {
        if (err) return res.json(err);
        // find any refresh token conatined with given

        if (data.length > 0) {
          // remove existing token
          let delTokenQuery = "DELETE FROM usertoken WHERE userId = ?";
          con.query(delTokenQuery, [data[0].userId], (err, data1) => {
            if (err) throw err;
            // console.log("Existing token removed");
          });
        }
        // Add new Token to database
        let insertTokenQuery = "INSERT INTO usertoken (`userId`, `token`) VALUES (?)";
        let values = [user.id, refreshToken];
        con.query(insertTokenQuery, [values], (err, data) => {
          if (err) throw err;
          // console.log("new Token Added");
        });
      });
      tokens = {
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
      //console.log(tokens);
      return tokens;
    } catch (err) {
      console.log(err);
    }
  },
  verifyRefreshToken: async (refreshToken) => {
    return new Promise((resolve, reject) => {
      let findTokenQuery = "SELECT token FROM usertoken WHERE token = ?";
      con.query(findTokenQuery, [refreshToken], (err, doc) => {
        // console.log(doc)
        if (doc.length < 1)
          return reject({ success: false, message: "Invalid refresh token" });
        jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, tokenDetails) => {
          if (err)
            return reject({ success: false, message: "Invalid refresh token" });
          //console.log(tokenDetails)
          resolve({
            tokenDetails,
            error: false,
            message: "Valid refresh token",
          });
        });
      });
    });
  },
  authMiddleWare: async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      // console.log("middle", token)
      if (token === null || !token)
        return res.status(401).json({
          success: false,
          message: "There is no token in header",
        });

      const user = jwt.verify(token, ACCESS_TOKEN_SECRET);
      req.user = user;
    }
    catch (error) {
      return res.status(401).send({
        success: false,
        message: "Token is Expired Login Again."
      });
    }
    // console.log(user)
    next();
  },
};

module.exports = authServices;