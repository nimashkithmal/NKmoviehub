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
    // Nothing was delivered, so do not leave a half-started invitation behind
    if (isNewRecord) {
      await PendingAdmin.deleteOne({ _id: pending._id });
    }
    return { sent: false, failed: true };
  }

  return { sent: true, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
};

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, restrictToAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await User.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalUsers: total,
          usersPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics (admin only)
// @access  Private/Admin
router.get('/stats', protect, restrictToAdmin, async (req, res) => {
  try {
    const stats = await User.getStats();
    
    // Get additional stats
    const newUsersThisMonth = await User.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });
    
    const activeUsers = await User.countDocuments({ status: 'active' });
    const inactiveUsers = await User.countDocuments({ status: 'inactive' });
    
    res.json({
      success: true,
      data: {
        ...stats,
        newUsersThisMonth,
        inactiveUsers,
        activeUsers
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private/Admin
router.get('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
});

// @route   POST /api/users
// @desc    Create a new user (admin only)
// @access  Private/Admin
router.post('/', protect, restrictToAdmin, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').isIn(['user', 'admin']).withMessage('Role must be either user or admin')
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

    const { name, email, password, role = 'user' } = req.body;

    // Admin accounts only come from the verified flow, so this route cannot
    // be used to skip the emailed code
    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts must be created through admin management, which verifies the email address first.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating user'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put('/:id', protect, restrictToAdmin, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Role must be either user or admin'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be either active or inactive')
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

    const { name, email, role, status } = req.body;

    // Promoting an existing account would bypass the verified admin flow
    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts must be created through admin management, which verifies the email address first.'
      });
    }

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    // Check if email is being updated and if it already exists
    if (email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: req.params.id } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
});

// @route   PATCH /api/users/:id/status
// @desc    Toggle user status (admin only)
// @access  Private/Admin
router.patch('/:id/status', protect, restrictToAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    user.status = newStatus;
    await user.save();

    res.json({
      success: true,
      message: `User status updated to ${newStatus}`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }
      }
    });

  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status'
    });
  }
});

// @route   POST /api/users/admins
// @desc    Start creating an admin by emailing a verification code. No account
//          is created here - see POST /api/users/admins/verify
// @access  Private/Admin
router.post('/admins', protect, restrictToAdmin, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
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

    const { name, email, password } = req.body;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Hold the details aside and email a code - the admin account itself is
    // only created once that code comes back verified
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
    // Check for validation errors
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
    // Check for validation errors
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

    // Someone may have taken this address while the code was in flight
    const existingUser = await User.findByEmail(pending.email);
    if (existingUser) {
      await PendingAdmin.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Email is confirmed, so the admin account can finally be created
    const admin = new User({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      role: 'admin'
    });
    // The password is already a bcrypt hash - do not hash it twice
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
