/**
 * Shared one-time-code primitives, used by both the password reset and the
 * registration email verification flows so the security-critical parts live in
 * a single place.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Cryptographically secure numeric code - crypto.randomInt is uniform, unlike
 * Math.random(), and is not predictable from previously issued codes.
 */
const generateOtp = () => {
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
};

// Only the hash is ever stored - the plain code exists in the email only
const hashOtp = (otp) => bcrypt.hash(otp, 12);

const compareOtp = (candidateOtp, otpHash) => bcrypt.compare(candidateOtp, otpHash);

const otpExpiryDate = () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

/**
 * Seconds still to wait before a new code may be sent, 0 when one can be
 * requested right away.
 */
const cooldownRemaining = (issuedAt) => {
  const elapsed = (Date.now() - issuedAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
};

module.exports = {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFY_ATTEMPTS,
  generateOtp,
  hashOtp,
  compareOtp,
  otpExpiryDate,
  cooldownRemaining
};
