import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendSuccess, sendError, handleAsync } from '../utils/responseHandler.js';

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId }, 
    process.env.JWT_REFRESH_SECRET, 
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Get client info for security
const getClientInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || 'Unknown'
  };
};

// Register user
export const register = handleAsync(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendError(res, 'User already exists with this email', 'USER_EXISTS', 409);
  }

  // Create user
  const user = new User({
    name,
    email,
    password,
    role: role || 'user'
  });

  await user.save();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  const clientInfo = getClientInfo(req);

  // Store refresh token with client info
  await user.addRefreshToken(refreshToken, clientInfo.userAgent, clientInfo.ipAddress);

  // Update last login
  await user.updateLastLogin();

  sendSuccess(res, 'User registered successfully', {
    user: user.userProfile,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 * 1000 // 15 minutes
    }
  }, 'REGISTRATION_SUCCESS', 201);
});

// Login user
export const login = handleAsync(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
  
  if (!user) {
    return sendError(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
  }

  if (!user.isActive) {
    return sendError(res, 'Account is deactivated', 'ACCOUNT_DEACTIVATED', 401);
  }

  if (user.isLocked) {
    const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000); // minutes remaining
    return sendError(res, `Account is temporarily locked. Try again in ${lockTime} minutes.`, 'ACCOUNT_LOCKED', 423);
  }

  // Check password
  try {
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      const attemptsLeft = 5 - user.loginAttempts;
      return sendError(res, `Invalid credentials. ${attemptsLeft} attempts left.`, 'INVALID_CREDENTIALS', 401);
    }
  } catch (error) {
    if (error.message === 'Account is temporarily locked due to too many failed attempts') {
      return sendError(res, 'Account is temporarily locked. Please try again later.', 'ACCOUNT_LOCKED', 423);
    }
    throw error;
  }

  // Clean expired tokens
  user.cleanExpiredTokens();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  const clientInfo = getClientInfo(req);

  // Store refresh token with client info
  await user.addRefreshToken(refreshToken, clientInfo.userAgent, clientInfo.ipAddress);

  // Update last login
  await user.updateLastLogin();

  sendSuccess(res, 'Login successful', {
    user: user.userProfile,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 * 1000
    }
  }, 'LOGIN_SUCCESS');
});

// Refresh token
export const refreshToken = handleAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return sendError(res, 'Refresh token required', 'REFRESH_TOKEN_REQUIRED', 401);
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    return sendError(res, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  if (user.isLocked) {
    return sendError(res, 'Account is locked', 'ACCOUNT_LOCKED', 423);
  }

  // Check if refresh token exists in user's tokens
  const tokenExists = user.refreshTokens.some(
    tokenData => tokenData.token === refreshToken && tokenData.expiresAt > new Date()
  );

  if (!tokenExists) {
    return sendError(res, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
  const clientInfo = getClientInfo(req);

  // Remove old refresh token and add new one
  await user.removeRefreshToken(refreshToken);
  await user.addRefreshToken(newRefreshToken, clientInfo.userAgent, clientInfo.ipAddress);

  sendSuccess(res, 'Token refreshed successfully', {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 15 * 60 * 1000
  }, 'TOKEN_REFRESHED');
});

// Logout
export const logout = handleAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const user = await User.findById(req.user._id);

  if (refreshToken) {
    await user.removeRefreshToken(refreshToken);
  }

  sendSuccess(res, 'Logout successful', null, 'LOGOUT_SUCCESS');
});

// Logout all devices
export const logoutAll = handleAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.refreshTokens = [];
  await user.save();

  sendSuccess(res, 'Logged out from all devices', null, 'LOGOUT_ALL_SUCCESS');
});

// Get current user
export const getMe = handleAsync(async (req, res) => {
  sendSuccess(res, 'User profile retrieved successfully', {
    user: req.user.userProfile
  }, 'PROFILE_RETRIEVED');
});

// Update profile
export const updateProfile = handleAsync(async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  
  await user.save();

  sendSuccess(res, 'Profile updated successfully', {
    user: user.userProfile
  }, 'PROFILE_UPDATED');
});

// Change password
export const changePassword = handleAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return sendError(res, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Invalidate all refresh tokens (security measure)
  user.refreshTokens = [];
  await user.save();

  sendSuccess(res, 'Password changed successfully', null, 'PASSWORD_CHANGED');
});

// Get active sessions
export const getSessions = handleAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  const activeSessions = user.refreshTokens.map(token => ({
    id: token._id,
    userAgent: token.userAgent,
    ipAddress: token.ipAddress,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt
  }));

  sendSuccess(res, 'Active sessions retrieved', { sessions: activeSessions }, 'SESSIONS_RETRIEVED');
});

// Revoke session
export const revokeSession = handleAsync(async (req, res) => {
  const { sessionId } = req.params;
  const user = await User.findById(req.user._id);

  user.refreshTokens = user.refreshTokens.filter(
    token => token._id.toString() !== sessionId
  );

  await user.save();

  sendSuccess(res, 'Session revoked successfully', null, 'SESSION_REVOKED');
});