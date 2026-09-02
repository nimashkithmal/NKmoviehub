const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { protect, restrictToAdmin, restrictToSuperAdmin } = require('../middleware/auth');
const { generateTempPassword, isSuperAdmin } = require('../constants/adminAccess');

const router = express.Router();

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
      data: {
        admins,
        canInviteAdmins: isSuperAdmin(req.user)
      }
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
// @desc    Invite a new admin with a temporary password emailed to them
// @access  Private/Super Admin
router.post('/admins', protect, restrictToSuperAdmin, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
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

    const { name, email } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    if (normalizedEmail === String(req.user.email).trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'This email is already your administrator account.'
      });
    }

    const existingUser = await User.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    const tempPassword = generateTempPassword();
    const admin = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      password: tempPassword,
      role: 'admin',
      mustChangePassword: true
    });
    await admin.save();

    const emailResult = await emailService.sendAdminWelcomeEmail(
      admin,
      tempPassword,
      req.user.name
    );

    if (!emailResult.success) {
      await User.deleteOne({ _id: admin._id });
      return res.status(400).json({
        success: false,
        message: emailResult.error || 'Could not email the temporary password. Check the address and try again.'
      });
    }

    console.log(`Admin invite sent to ${admin.email} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `Admin invite sent to ${admin.email}. They must log in with the temporary password emailed to them.`,
      data: {
        admin: {
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
    console.error('Invite admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while inviting the administrator'
    });
  }
});

module.exports = router;
