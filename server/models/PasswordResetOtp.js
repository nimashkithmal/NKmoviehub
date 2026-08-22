const mongoose = require('mongoose');
const otp = require('../utils/otp');

// How long a code stays valid, and how often a new one may be requested
const {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFY_ATTEMPTS
} = otp;

const passwordResetOtpSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  // Only the hash of the code is stored - the plain code exists in the email only
  otpHash: {
    type: String,
    required: true,
    select: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  consumedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Look-ups are always "newest code for this email"
passwordResetOtpSchema.index({ email: 1, createdAt: -1 });

// Let MongoDB drop expired codes on its own
passwordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

passwordResetOtpSchema.virtual('isExpired').get(function() {
  return this.expiresAt.getTime() <= Date.now();
});

passwordResetOtpSchema.virtual('isUsable').get(function() {
  return !this.consumedAt && !this.isExpired && this.attempts < MAX_VERIFY_ATTEMPTS;
});

/**
 * Seconds the caller still has to wait before a new code may be sent,
 * 0 when a new code can be requested right away.
 */
passwordResetOtpSchema.methods.cooldownRemaining = function() {
  return otp.cooldownRemaining(this.createdAt);
};

passwordResetOtpSchema.methods.compareOtp = function(candidateOtp) {
  return otp.compareOtp(candidateOtp, this.otpHash);
};

passwordResetOtpSchema.statics.generateOtp = otp.generateOtp;

/**
 * Issue a fresh code for a user. Any earlier code is retired first so only the
 * most recent one can ever be used.
 */
passwordResetOtpSchema.statics.issueForUser = async function(user) {
  await this.updateMany(
    { user: user._id, consumedAt: null },
    { consumedAt: new Date() }
  );

  const code = otp.generateOtp();

  const record = await this.create({
    user: user._id,
    email: user.email,
    otpHash: await otp.hashOtp(code),
    expiresAt: otp.otpExpiryDate()
  });

  return { record, otp: code };
};

// Most recent code for an email, whatever its state
passwordResetOtpSchema.statics.findLatestForEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() })
    .sort({ createdAt: -1 })
    .select('+otpHash');
};

const PasswordResetOtp = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);

module.exports = PasswordResetOtp;
module.exports.OTP_LENGTH = OTP_LENGTH;
module.exports.OTP_EXPIRY_MINUTES = OTP_EXPIRY_MINUTES;
module.exports.RESEND_COOLDOWN_SECONDS = RESEND_COOLDOWN_SECONDS;
module.exports.MAX_VERIFY_ATTEMPTS = MAX_VERIFY_ATTEMPTS;
