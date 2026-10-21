const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { generateToken } = require("../config/jwtToken");
const { generateRefreshToken } = require("../config/refreshToken");

function fail(status, message, fields) {
  const error = new Error(message);
  error.status = status;
  if (fields) error.fields = fields;
  return error;
}

function requestBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw fail(400, "Please provide a valid request body.");
  }
  return req.body;
}

function text(value, field, max, required = true) {
  if (!required && (value === undefined || value === "")) return undefined;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw fail(400, "Please check your account details.", { [field]: `Enter a valid ${field} (${max} characters or fewer).` });
  }
  return value.trim();
}

function emailAddress(value) {
  const email = text(value, "email", 254);
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw fail(400, "Please enter a valid email address.", { email: "Enter a valid email address." });
  // Keep existing account casing semantics; changing account identities requires a migration.
  return email;
}

function newPassword(value) {
  if (typeof value !== "string" || value.length < 8 || Buffer.byteLength(value, "utf8") > 72) {
    throw fail(400, "Use a password of at least 8 characters and at most 72 UTF-8 bytes.", { password: "Use 8 or more characters, up to 72 UTF-8 bytes." });
  }
  return value;
}

function mobileNumber(value) {
  const mobile = text(value, "mobile", 30, false);
  if (mobile !== undefined && (!/^\+?[\d\s().-]{7,30}$/.test(mobile) || mobile.replace(/\D/g, "").length < 7)) {
    throw fail(400, "Please enter a valid mobile number.", { mobile: "Enter a valid mobile number, including your country code." });
  }
  return mobile;
}

function publicUser(user, includeMobile = true) {
  if (!user) return null;
  return {
    _id: String(user._id),
    id: String(user._id),
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    ...(includeMobile && user.mobile !== undefined ? { mobile: user.mobile } : {}),
    role: user.role,
    isBlocked: Boolean(user.isBlocked),
  };
}

function validId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) throw fail(400, "Please provide a valid user identifier.");
  return value;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/user",
  };
}

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, { ...cookieOptions(), maxAge: 3 * 24 * 60 * 60 * 1000 });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", cookieOptions());
  // Expire the legacy root-scoped cookie too, so older sessions can sign out cleanly.
  res.clearCookie("refreshToken", { ...cookieOptions(), path: "/" });
}

function rejectCrossSiteCookieRequest(req) {
  if (req.get("sec-fetch-site") === "cross-site") throw fail(403, "This request must originate from the storefront.");
}

const createUser = asyncHandler(async (req, res) => {
  const input = requestBody(req);
  const account = {
    firstname: text(input.firstname, "firstname", 60),
    lastname: text(input.lastname, "lastname", 60),
    email: emailAddress(input.email),
    password: newPassword(input.password),
    role: "user",
    isBlocked: false,
  };
  const mobile = mobileNumber(input.mobile);
  if (mobile !== undefined) account.mobile = mobile;
  if (await User.exists({ email: account.email })) throw fail(409, "User Already Exists");
  let user;
  try {
    // This explicit allowlist excludes role, refresh tokens, cart, and every other protected field.
    user = await User.create(account);
  } catch (error) {
    if (error.code === 11000) throw fail(409, "User Already Exists");
    throw error;
  }
  res.json(publicUser(user));
});

const loginUserCtrl = asyncHandler(async (req, res) => {
  const input = requestBody(req);
  const email = emailAddress(input.email);
  if (typeof input.password !== "string" || !input.password || Buffer.byteLength(input.password, "utf8") > 1024) {
    throw fail(401, "Invalid Credentials");
  }
  const user = await User.findOne({ email });
  if (!user || !(await user.isPasswordMatched(input.password))) throw fail(401, "Invalid Credentials");
  if (user.isBlocked) throw fail(403, "This account is blocked. Please contact the store administrator.");
  const refreshToken = generateRefreshToken(user._id);
  await User.updateOne({ _id: user._id }, { $set: { refreshToken } });
  setRefreshCookie(res, refreshToken);
  res.json({ ...publicUser(user), token: generateToken(user._id) });
});

const currentUser = asyncHandler(async (req, res) => {
  res.json(publicUser(req.user, false));
});

const handleRefreshToken = asyncHandler(async (req, res) => {
  rejectCrossSiteCookieRequest(req);
  const refreshToken = req.cookies?.refreshToken;
  if (typeof refreshToken !== "string" || refreshToken.length > 4096) throw fail(401, "Please sign in again to continue.");
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    clearRefreshCookie(res);
    throw fail(401, "Please sign in again to continue.");
  }
  if (!decoded || typeof decoded !== "object" || typeof decoded.id !== "string" ||
      !/^[a-f\d]{24}$/i.test(decoded.id) || (decoded.type !== undefined && decoded.type !== "refresh")) {
    clearRefreshCookie(res);
    throw fail(401, "Please sign in again to continue.");
  }
  const user = await User.findOne({ _id: decoded.id, refreshToken });
  if (!user) {
    clearRefreshCookie(res);
    throw fail(401, "Please sign in again to continue.");
  }
  if (user.isBlocked) {
    clearRefreshCookie(res);
    throw fail(403, "This account is blocked. Please contact the store administrator.");
  }
  const replacement = generateRefreshToken(user._id);
  const updated = await User.updateOne({ _id: user._id, refreshToken }, { $set: { refreshToken: replacement } });
  if (updated.modifiedCount !== 1) throw fail(401, "Please sign in again to continue.");
  setRefreshCookie(res, replacement);
  res.json({ accessToken: generateToken(user._id) });
});

const logout = asyncHandler(async (req, res) => {
  rejectCrossSiteCookieRequest(req);
  const refreshToken = req.cookies?.refreshToken;
  if (typeof refreshToken === "string" && refreshToken.length <= 4096) {
    await User.updateOne({ refreshToken }, { $set: { refreshToken: "" } });
  }
  clearRefreshCookie(res);
  res.sendStatus(204);
});

const updatedUser = asyncHandler(async (req, res) => {
  const input = requestBody(req);
  const update = {};
  if (input.firstname !== undefined) update.firstname = text(input.firstname, "firstname", 60);
  if (input.lastname !== undefined) update.lastname = text(input.lastname, "lastname", 60);
  if (input.email !== undefined) update.email = emailAddress(input.email);
  if (input.mobile !== undefined) {
    const mobile = mobileNumber(input.mobile);
    if (mobile === undefined) throw fail(400, "Please enter a valid mobile number.");
    update.mobile = mobile;
  }
  if (!Object.keys(update).length) throw fail(400, "Provide account details to update.");
  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true });
  if (!user) throw fail(404, "The requested account was not found.");
  res.json(publicUser(user));
});

const getallUser = asyncHandler(async (req, res) => {
  // Keep the existing array response shape, with an explicit safe projection.
  const users = await User.find().select("firstname lastname email mobile role isBlocked");
  res.json(users.map((user) => publicUser(user)));
});

const getaUser = asyncHandler(async (req, res) => {
  const user = await User.findById(validId(req.params.id)).select("firstname lastname email mobile role isBlocked");
  if (!user) throw fail(404, "The requested account was not found.");
  res.json({ getaUser: publicUser(user) });
});

const deleteaUser = asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  if (id === String(req.user._id)) throw fail(400, "You cannot delete the account you are currently using.");
  const user = await User.findByIdAndDelete(id).select("firstname lastname email mobile role isBlocked");
  if (!user) throw fail(404, "The requested account was not found.");
  res.json({ deleteaUser: publicUser(user) });
});

const blockUser = asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  if (id === String(req.user._id)) throw fail(400, "You cannot block the account you are currently using.");
  const user = await User.findByIdAndUpdate(id, { $set: { isBlocked: true, refreshToken: "" } }, { new: true, runValidators: true });
  if (!user) throw fail(404, "The requested account was not found.");
  res.json(publicUser(user));
});

const unblockUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(validId(req.params.id), { $set: { isBlocked: false } }, { new: true, runValidators: true });
  if (!user) throw fail(404, "The requested account was not found.");
  res.json({ message: "User unBlocked" });
});

const updatePassword = asyncHandler(async (req, res) => {
  const input = requestBody(req);
  const password = newPassword(input.password);
  const user = await User.findById(req.user._id);
  if (!user) throw fail(401, "Please sign in again to continue.");
  user.password = password;
  user.passwordChangedAt = new Date();
  user.refreshToken = "";
  await user.save();
  clearRefreshCookie(res);
  res.json(publicUser(user));
});

module.exports = {
  createUser, loginUserCtrl, currentUser, getallUser, getaUser, deleteaUser,
  updatedUser, blockUser, unblockUser, handleRefreshToken, logout, updatePassword,
};
