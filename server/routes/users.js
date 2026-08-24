const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const PendingAdmin = require('../models/PendingAdmin');
const emailService = require('../services/emailService');
const { protect, restrictToAdmin } = require('../middleware/auth');
const {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFY_ATTEMPTS
} = require('../utils/otp');

const router = express.Router();

/**
 * Email the verification code for a pending admin. Inside the resend cooldown
 * the existing code stays valid and no new mail goes out.
 */
const sendAdminCode = async (pending, invitedByName) => {
  const isNewRecord = pending.isNew;

  if (!isNewRecord && pending.cooldownRemaining() > 0) {
    await pending.save();
    return { sent: false, resendAfterSeconds: pending.cooldownRemaining() };
  }

  const code = await pending.issueOtp();
  const emailResult = await emailService.sendAdminInviteOtp(
    pending,
    code,
    OTP_EXPIRY_MINUTES,
    invitedByName
  );

  if (!emailResult.success) {
    if (isNewRecord) {
      await PendingAdmin.deleteOne({ _id: pending._id });
    }
    return { sent: false, failed: true };
  }

  return { sent: true, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
};

// @route   GET /api/users/admins
// @desc    List administrator accounts
// @access  Private/Admin
router.get('/admins', protect, restrictToAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { admins }
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching administrators'
    });
  }
});

// @route   PATCH /api/users/admins/:id/status
// @desc    Activate or deactivate another admin (not yourself)
// @access  Private/Admin
router.patch('/admins/:id/status', protect, restrictToAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentId = req.user._id.toString();

    if (targetId === currentId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const admin = await User.findById(targetId);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found'
      });
    }

    admin.status = admin.status === 'active' ? 'inactive' : 'active';
    await admin.save();

    res.json({
      success: true,
      message: admin.status === 'active'
        ? `${admin.name} is now active`
        : `${admin.name} has been deactivated`,
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          status: admin.status
        }
      }
    });
  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating administrator status'
    });
  }
});

// @route   POST /api/users/admins
// @desc    Start creating an admin by emailing a verification code
// @access  Private/Admin
router.post('/admins', protect, restrictToAdmin, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    const pending = await PendingAdmin.startFor({ name, email, password, invitedBy: req.user.id });
    const result = await sendAdminCode(pending, req.user.name);

    if (result.failed) {
      return res.status(503).json({
        success: false,
        message: 'Unable to send the verification code right now. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: `We sent a ${OTP_LENGTH}-digit verification code to ${pending.email}.`,
      data: {
        email: pending.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        resendAfterSeconds: result.resendAfterSeconds
      }
    });
  } catch (error) {
    console.error('Start admin creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while starting admin creation'
    });
  }
});

// @route   POST /api/users/admins/resend
// @desc    Send a fresh verification code for an admin being created
// @access  Private/Admin
router.post('/admins/resend', protect, restrictToAdmin, [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
        errors: errors.array()
      });
    }

    const pending = await PendingAdmin.findForEmail(req.body.email);
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No admin creation in progress for this email. Please start again.'
      });
    }

    const cooldown = pending.cooldownRemaining();
    if (cooldown > 0) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldown} seconds before requesting another code.`,
        data: { resendAfterSeconds: cooldown }
      });
    }

    const result = await sendAdminCode(pending, req.user.name);
    if (result.failed) {
      return res.status(503).json({
        success: false,
        message: 'Unable to send the verification code right now. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'A new verification code has been sent.',
      data: {
        email: pending.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        resendAfterSeconds: result.resendAfterSeconds
      }
    });
  } catch (error) {
    console.error('Resend admin code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending the verification code'
    });
  }
});

// @route   POST /api/users/admins/verify
// @desc    Confirm the emailed code and create the admin account
// @access  Private/Admin
router.post('/admins/verify', protect, restrictToAdmin, [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('otp').trim().isLength({ min: OTP_LENGTH, max: OTP_LENGTH }).withMessage(`Code must be ${OTP_LENGTH} digits`)
    .isNumeric().withMessage('Code must contain digits only')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: `Please enter the ${OTP_LENGTH}-digit code from the email`,
        errors: errors.array()
      });
    }

    const { email, otp } = req.body;

    const pending = await PendingAdmin.findForEmail(email);
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No admin creation in progress for this email. Please start again.'
      });
    }

    if (pending.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'This verification code has expired. Please request a new one.'
      });
    }

    if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new code.'
      });
    }

    const isValid = await pending.compareOtp(otp);
    if (!isValid) {
      pending.attempts += 1;
      await pending.save();

      const remaining = MAX_VERIFY_ATTEMPTS - pending.attempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect verification code. Please request a new code.'
      });
    }

    const existingUser = await User.findByEmail(pending.email);
    if (existingUser) {
      await PendingAdmin.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    const admin = new User({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      role: 'admin'
    });
    admin.$locals.skipPasswordHash = true;
    await admin.save();

    await PendingAdmin.deleteOne({ _id: pending._id });

    console.log(`Admin ${admin.email} created by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Email verified and admin account created successfully',
      data: {
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
          createdAt: admin.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Verify admin creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating the admin account'
    });
  }
});

module.exports = router;
