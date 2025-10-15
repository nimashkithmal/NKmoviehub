const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'closed'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  adminReply: {
    message: {
      type: String,
      trim: true,
      maxlength: [2000, 'Reply message cannot exceed 2000 characters']
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    repliedAt: {
      type: Date
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better search performance
contactSchema.index({ email: 1, status: 1, createdAt: -1 });
contactSchema.index({ subject: 'text', message: 'text' });

// Static method to get contact statistics
contactSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalContacts: { $sum: 1 },
        newContacts: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
        readContacts: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
        repliedContacts: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
        closedContacts: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        urgentContacts: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } }
      }
    }
  ]);

  return stats[0] || {
    totalContacts: 0,
    newContacts: 0,
    readContacts: 0,
    repliedContacts: 0,
    closedContacts: 0,
    urgentContacts: 0
  };
};

// Instance method to mark as read
contactSchema.methods.markAsRead = function() {
  this.status = 'read';
  return this.save();
};

// Instance method to add admin reply
contactSchema.methods.addAdminReply = function(replyMessage, adminId) {
  this.adminReply = {
    message: replyMessage,
    repliedBy: adminId,
    repliedAt: new Date()
  };
  this.status = 'replied';
  return this.save();
};

module.exports = mongoose.model('Contact', contactSchema);
