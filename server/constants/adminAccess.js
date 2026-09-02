const crypto = require('crypto');

const getSuperAdminEmail = () =>
  String(process.env.SUPER_ADMIN_EMAIL || 'qwe730375@gmail.com').trim().toLowerCase();

const isSuperAdmin = (user) =>
  Boolean(user?.email && String(user.email).trim().toLowerCase() === getSuperAdminEmail());

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let password = '';
  for (let i = 0; i < 12; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
};

module.exports = {
  getSuperAdminEmail,
  isSuperAdmin,
  generateTempPassword
};
