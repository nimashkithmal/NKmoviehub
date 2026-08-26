const express = require('express');
const Notification = require('../models/Notification');
const { protect, restrictToAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/notifications
// @desc    List admin notifications (newest first)
// @access  Private/Admin
router.get('/', protect, restrictToAdmin, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const notifications = await Notification.find()
      .populate('movie', 'title year')
      .populate('question', 'question answer answeredAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ read: false });

    res.json({
      success: true,
      data: { notifications, unreadCount }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Unread notification count for navbar badge
// @access  Private/Admin
router.get('/unread-count', protect, restrictToAdmin, async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ read: false });
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
});

// @route   PATCH /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private/Admin
router.patch('/read-all', protect, restrictToAdmin, async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { $set: { read: true } });
    res.json({
      success: true,
      data: { unreadCount: 0 }
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications'
    });
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Mark one notification as read
// @access  Private/Admin
router.patch('/:id/read', protect, restrictToAdmin, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    ).populate('movie', 'title year');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const unreadCount = await Notification.countDocuments({ read: false });
    res.json({
      success: true,
      data: { notification, unreadCount }
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
});

module.exports = router;
