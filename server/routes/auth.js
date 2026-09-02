const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const emailService = require('../services/emailService');
const { protect } = require('../middleware/auth');

const {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFY_ATTEMPTS
} = PasswordResetOtp;

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Short-lived token proving an OTP was verified, so the reset step does not
// have to send the code around a second time
const generateResetToken = (userId, otpId) => {
  return jwt.sign({ id: userId, otpId, purpose: 'password_reset' }, process.env.JWT_SECRET, {
    expiresIn: `${OTP_EXPIRY_MINUTES}m`
  });
};

// The same reply whether or not the address belongs to an account, so the
// endpoint cannot be used to discover which emails are registered
const RESET_CODE_SENT_MESSAGE =
  'If that email belongs to an account, a verification code has been sent to it.';

// Byte-for-byte identical for unknown addresses, deactivated accounts and
// requests made during the resend cooldown - the client runs its own countdown
const resetCodeSentResponse = (res) => res.json({
  success: true,
  message: RESET_CODE_SENT_MESSAGE,
  data: { expiresInMinutes: OTP_EXPIRY_MINUTES, resendAfterSeconds: RESEND_COOLDOWN_SECONDS }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (user.status === 'inactive') {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.mustChangePassword) {
      const latest = await PasswordResetOtp.findLatestForEmail(user.email);
      if (latest && !latest.consumedAt && latest.cooldownRemaining() > 0) {
        return res.json({
          success: true,
          requiresPasswordSetup: true,
          message: 'A verification code was already sent to your email.',
          data: {
            email: user.email,
            expiresInMinutes: OTP_EXPIRY_MINUTES,
            resendAfterSeconds: latest.cooldownRemaining()
          }
        });
      }

      const { record, otp } = await PasswordResetOtp.issueForUser(user);
      const emailResult = await emailService.sendPasswordResetOtp(user, otp, OTP_EXPIRY_MINUTES);
      if (!emailResult.success) {
        await PasswordResetOtp.deleteOne({ _id: record._id });
        return res.status(503).json({
          success: false,
          message: 'Unable to send the verification code right now. Please try again later.'
        });
      }

      return res.json({
        success: true,
        requiresPasswordSetup: true,
        message: 'A verification code was sent to your email. Enter it to set your new password.',
        data: {
          email: user.email,
          expiresInMinutes: OTP_EXPIRY_MINUTES,
          resendAfterSeconds: RESEND_COOLDOWN_SECONDS
        }
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user._id);

    // Check if this is the admin user based on role
    const isAdminUser = user.role === 'admin';

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        },
        token,
        redirectTo: isAdminUser ? 'admin' : 'home'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return success and let the client remove the token
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Email a one-time verification code so a password can be reset
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const user = await User.findByEmail(email);

    // Unknown or deactivated accounts get the same answer as valid ones
    if (!user || user.status === 'inactive') {
      return resetCodeSentResponse(res);
    }

    // Inside the resend cooldown, quietly skip sending. Answering differently
    // here would give away that the address is registered - the existing code
    // is still valid and the client is already counting down.
    const latest = await PasswordResetOtp.findLatestForEmail(user.email);
    if (latest && !latest.consumedAt && latest.cooldownRemaining() > 0) {
      return resetCodeSentResponse(res);
    }

    const { record, otp } = await PasswordResetOtp.issueForUser(user);

    const emailResult = await emailService.sendPasswordResetOtp(user, otp, OTP_EXPIRY_MINUTES);
    if (!emailResult.success) {
      // Nothing was delivered, so do not leave a code sitting in the database
      await PasswordResetOtp.deleteOne({ _id: record._id });
      return res.status(503).json({
        success: false,
        message: 'Unable to send the verification code right now. Please try again later.'
      });
    }

    resetCodeSentResponse(res);

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending the verification code'
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Check a verification code and hand back a short-lived reset token
// @access  Public
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('otp').trim().isLength({ min: OTP_LENGTH, max: OTP_LENGTH }).withMessage(`Code must be ${OTP_LENGTH} digits`)
    .isNumeric().withMessage('Code must contain digits only')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: `Please enter the ${OTP_LENGTH}-digit code from your email`,
        errors: errors.array()
      });
    }

    const { email, otp } = req.body;

    const record = await PasswordResetOtp.findLatestForEmail(email);
    if (!record || record.consumedAt) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code for this email. Please request a new one.'
      });
    }

    if (record.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'This verification code has expired. Please request a new one.'
      });
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new code.'
      });
    }

    const isValid = await record.compareOtp(otp);
    if (!isValid) {
      record.attempts += 1;
      await record.save();

      const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect verification code. Please request a new code.'
      });
    }

    const user = await User.findById(record.user);
    if (!user || user.status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'This account is no longer available.'
      });
    }

    record.verifiedAt = new Date();
    await record.save();

    res.json({
      success: true,
      message: 'Code verified. You can now set a new password.',
      data: {
        resetToken: generateResetToken(user._id, record._id),
        expiresInMinutes: OTP_EXPIRY_MINUTES
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying the code'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Set a new password using a verified reset token
// @access  Public
router.post('/reset-password', [
  body('resetToken').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirmPassword').notEmpty().withMessage('Please confirm your new password')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { resetToken, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'This password reset session has expired. Please start again.'
      });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // The code must still be the verified, unused one issued for this session
    const record = await PasswordResetOtp.findById(decoded.otpId);
    if (!record || !record.verifiedAt || record.consumedAt || record.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'This password reset session is no longer valid. Please start again.'
      });
    }

    const user = await User.findById(decoded.id).select('+password');
    if (!user || user.status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'This account is no longer available.'
      });
    }

    const wasFirstSetup = Boolean(user.mustChangePassword);

    // Assigning the plain value is safe - the User model hashes on save
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Burn the code so the same session cannot reset the password twice
    record.consumedAt = new Date();
    await record.save();

    if (wasFirstSetup) {
      await user.updateLastLogin();
      const token = generateToken(user._id);
      return res.json({
        success: true,
        message: 'Password set successfully. You are now logged in.',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          },
          token,
          redirectTo: user.role === 'admin' ? 'admin' : 'home'
        }
      });
    }

    res.json({
      success: true,
      message: 'Password updated successfully. You can now log in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating the password'
    });
  }
});

module.exports = router;
