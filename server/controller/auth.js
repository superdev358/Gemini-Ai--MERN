import { getGooleOAuthToken, getGoogleUser } from "../service/auth_service.js";
import { user } from "../model/user.js";
import "dotenv/config";
import { jwtSignIn } from "../service/auth_service.js";
import { tokenVerify } from "../helper/tokenVerify.js";
import { getCookieValue } from "../helper/cookieHandler.js";

export const googleOauthHandler = (req, res, next) => {
  const code = req.query.code;

  let newUserData;

  getGooleOAuthToken(code)
    .then((tokenData) => {
      const { access_token, id_token } = tokenData;

      return getGoogleUser(id_token, access_token);
    })
    .then((userData) => {
      if (!userData.email_verified) {
        const error = new Error("Email address is not verified");
        error.statusCode = 403;
        throw error;
      }
      newUserData = userData;

      return user.findOne({ email: newUserData.email });
    })
    .then((dbUser) => {
      if (!dbUser) {
        req.user.name = newUserData.name;
        req.user.email = newUserData.email;
        req.user.profileImg = newUserData.picture;
        return req.user.save();
      }

      dbUser.name = newUserData.name;
      dbUser.email = newUserData.email;
      dbUser.profileImg = newUserData.picture;

      return dbUser.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("user data update failed");
        error.statusCode = 500;
        throw error;
      }

      const clientUserAgent = req.headers["user-agent"];
      const tokenUserData = {
        email: newUserData.email,
        name: newUserData.name,
        userAgent: clientUserAgent,
      };

      const accessTokenSecret = process.env.ACCESS_TOKEN_JWT_SECRET;
      const refreshTokenSecret = process.env.REFRESH_TOKEN_JWT_SECRET;
      const accessTokenExpire = process.env.ACCESS_TOKEN_EXPIRETIME;
      const refreshTokenExpire = process.env.REFRESH_TOKEN_EXPIRETIME;

      const accessToken = jwtSignIn(
        tokenUserData,
        accessTokenSecret,
        accessTokenExpire
      );

      const refreshToken = jwtSignIn(
        tokenUserData,
        refreshTokenSecret,
        refreshTokenExpire
      );

      const applicationType = process.env.APPLICATION_TYPE;
      const cookieDomain = process.env.COOKIE_DOMAIN || "localhost";

      const accessCookieOption = {
        maxAge: 900000,
        httpOnly: true,
        domain: cookieDomain,
      };

      const refreshCookieOption = {
        maxAge: 604800000,
        httpOnly: true,
        domain: cookieDomain,
      };

      if (applicationType === "production") {
        accessCookieOption.secure = true;
        accessCookieOption.sameSite = "Lex";
        refreshCookieOption.secure = true;
        refreshCookieOption.sameSite = "Lex";
      }

      res.cookie("access_token", accessToken, accessCookieOption);
      res.cookie("refresh_token", refreshToken, refreshCookieOption);
      res.cookie("isLogin", "yes", accessCookieOption);

      const clientRedirectUrl = process.env.CLIENT_REDIRECT_URL;
      res.redirect(clientRedirectUrl);
    })
    .catch((error) => {
      console.log(error);
    });
};

let a = 0;

export const loginValidation = (req, res, next) => {
  const cookieSting = req.headers.cookie;
  const cookieName = "access_token";
  const token = getCookieValue(cookieSting, cookieName);

  if (!token) {
    const err = new Error("Invalid Token");
    err.statusCode = 401;
    throw err;
  }

  a += 1;

  console.log("Login Validation ", a);

  tokenVerify(token)
    .then((user) => {
      if (!user) {
        const error = new Error("user not found");
        error.statusCode = 403;
        throw error;
      }

      console.log(user);

      res.status(200).json({ message: "Login Success" });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

export const logoutHandler = (req, res, next) => {
  const cookieSting = req.headers.cookie;
  const acessToken = getCookieValue(cookieSting, "access_token");
  const refresh_token = getCookieValue(cookieSting, "refresh_token");

  req.user.expireAccessToken.push(acessToken);
  req.user.expireRefreshToken.push(refresh_token);
  req.user
    .save()
    .then((result) => {
      if (!result) {
        const error = new Error("Token Expire Add Failed");
        error.statusCode = 403;
        throw error;
      }
      const applicationType = process.env.APPLICATION_TYPE;
      const cookieDomain = process.env.COOKIE_DOMAIN || "localhost";

      const accessCookieOption = {
        maxAge: 900000,
        httpOnly: true,
        domain: cookieDomain,
      };

      const refreshCookieOption = {
        maxAge: 604800000,
        httpOnly: true,
        domain: cookieDomain,
      };

      if (applicationType === "production") {
        accessCookieOption.secure = true;
        accessCookieOption.sameSite = "Lex";
        refreshCookieOption.secure = true;
        refreshCookieOption.sameSite = "Lex";
      }

      res.clearCookie("access_token", accessCookieOption);
      res.clearCookie("refresh_token", refreshCookieOption);
      res.clearCookie("isLogin", "yes", accessCookieOption);

      res.status(200).json({ message: "Logout" });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
