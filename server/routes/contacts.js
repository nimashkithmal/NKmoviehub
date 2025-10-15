const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { protect, restrictToAdmin } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// @route   POST /api/contacts
// @desc    Create a new contact message
// @access  Public
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('subject').trim().isLength({ min: 5, max: 200 }).withMessage('Subject must be between 5 and 200 characters'),
  body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, subject, message } = req.body;

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';

    const contact = new Contact({
      name,
      email,
      subject,
      message,
      ipAddress,
      userAgent
    });

    await contact.save();

    // Send confirmation email to user
    try {
      await emailService.sendContactConfirmation(contact);
      console.log('📧 Confirmation email sent to:', contact.email);
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
      // Don't fail the contact creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Contact message sent successfully! We will get back to you soon.',
      data: { contact }
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending contact message'
    });
  }
});

// @route   GET /api/contacts
// @desc    Get all contact messages (admin only)
// @access  Private/Admin
router.get('/', protect, restrictToAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', search = '' } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get contacts with pagination
    const contacts = await Contact.find(filter)
      .populate('adminReply.repliedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Contact.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalContacts: total,
          contactsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contacts'
    });
  }
});

// @route   GET /api/contacts/stats
// @desc    Get contact statistics (admin only)
// @access  Private/Admin
router.get('/stats', protect, restrictToAdmin, async (req, res) => {
  try {
    const stats = await Contact.getStats();
    
    // Get additional stats
    const newContactsThisWeek = await Contact.countDocuments({
      status: 'new',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        ...stats,
        newContactsThisWeek
      }
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contact statistics'
    });
  }
});

// @route   GET /api/contacts/:id
// @desc    Get single contact message (admin only)
// @access  Private/Admin
router.get('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('adminReply.repliedBy', 'name email');
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      data: { contact }
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contact'
    });
  }
});

// @route   PUT /api/contacts/:id
// @desc    Update contact message (admin only)
// @access  Private/Admin
router.put('/:id', protect, restrictToAdmin, [
  body('status').optional().isIn(['new', 'read', 'replied', 'closed']).withMessage('Invalid status'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status, tags } = req.body;
    const updateData = {};
    
    if (status) updateData.status = status;
    if (tags) updateData.tags = tags;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('adminReply.repliedBy', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact message updated successfully',
      data: { contact }
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating contact'
    });
  }
});

// @route   POST /api/contacts/:id/reply
// @desc    Add admin reply to contact message
// @access  Private/Admin
router.post('/:id/reply', protect, restrictToAdmin, [
  body('message').trim().isLength({ min: 5, max: 2000 }).withMessage('Reply message must be between 5 and 2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { message } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    await contact.addAdminReply(message, req.user.id);
    await contact.populate('adminReply.repliedBy', 'name email');

    // Send reply email to user
    try {
      const adminName = contact.adminReply.repliedBy?.name || 'NK Movie Hub Admin';
      const emailResult = await emailService.sendContactReply(contact, message, adminName);
      
      if (emailResult.success) {
        console.log('📧 Reply email sent successfully to:', contact.email);
      } else {
        console.error('❌ Failed to send reply email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ Error sending reply email:', emailError);
      // Don't fail the reply if email fails
    }

    res.json({
      success: true,
      message: 'Reply sent successfully',
      data: { contact }
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding reply'
    });
  }
});

// @route   DELETE /api/contacts/:id
// @desc    Delete contact message (admin only)
// @access  Private/Admin
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact message deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting contact'
    });
  }
});

module.exports = router;
