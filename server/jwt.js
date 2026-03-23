const jwt = require("jsonwebtoken");

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || "change-me-access";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "change-me-refresh";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

function signToken(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

function signAccessToken(payload) {
  return signToken(payload, ACCESS_SECRET, ACCESS_TTL);
}

function signRefreshToken(payload) {
  return signToken(payload, REFRESH_SECRET, REFRESH_TTL);
}

function verifyAccessToken(token) {
  return verifyToken(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return verifyToken(token, REFRESH_SECRET);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
