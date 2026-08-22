const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const otp = require('../utils/otp');

/**
 * A registration that has been submitted but not yet confirmed by email.
 *
 * Nothing here is a real account: the User document is only created once the
 * emailed code has been verified, so an unverified address never ends up in
 * the users collection.
 */
const pendingRegistrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Already hashed - the plain password is never written to the database
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
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
  // When the current code was issued, which drives the resend cooldown
  otpSentAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Let MongoDB drop abandoned registrations on its own
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

pendingRegistrationSchema.virtual('isExpired').get(function() {
  return this.expiresAt.getTime() <= Date.now();
});

pendingRegistrationSchema.methods.cooldownRemaining = function() {
  return otp.cooldownRemaining(this.otpSentAt);
};

pendingRegistrationSchema.methods.compareOtp = function(candidateOtp) {
  return otp.compareOtp(candidateOtp, this.otpHash);
};

/**
 * Attach a freshly generated code to this pending registration and return the
 * plain code so it can be emailed.
 */
pendingRegistrationSchema.methods.issueOtp = async function() {
  const code = otp.generateOtp();

  this.otpHash = await otp.hashOtp(code);
  this.otpSentAt = new Date();
  this.expiresAt = otp.otpExpiryDate();
  this.attempts = 0;
  await this.save();

  return code;
};

/**
 * Start (or restart) a pending registration for an email address. Re-submitting
 * the form replaces the stored details, so the newest submission is the one
 * that gets created after verification.
 */
pendingRegistrationSchema.statics.startFor = async function({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase();

  let pending = await this.findOne({ email: normalizedEmail }).select('+otpHash +passwordHash');

  if (pending) {
    pending.name = name;
    pending.passwordHash = passwordHash;
    return pending;
  }

  // otpHash/otpSentAt/expiresAt are filled in by issueOtp right after this
  pending = new this({
    name,
    email: normalizedEmail,
    passwordHash,
    otpHash: 'pending',
    otpSentAt: new Date(),
    expiresAt: otp.otpExpiryDate()
  });

  return pending;
};

pendingRegistrationSchema.statics.findForEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+otpHash +passwordHash');
};

const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);

module.exports = PendingRegistration;
