const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const emailUser = String(process.env.EMAIL_USER || '').trim();
const emailPass = String(process.env.EMAIL_PASS || '').replace(/\s/g, '');

const verifyEmailConfig = async () => {
  if (!emailUser || !emailPass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must both be configured');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  try {
    await transporter.verify();
    console.log(`Gmail SMTP authentication verified for ${emailUser}`);
  } finally {
    transporter.close();
  }
};

verifyEmailConfig().catch((error) => {
  const detail = String(error?.message || 'Email authentication failed');
  if (error?.responseCode === 535 || /535[ -]5\.7\.8|BadCredentials|Username and Password not accepted/i.test(detail)) {
    console.error('Gmail authentication failed: EMAIL_USER and EMAIL_PASS do not match or the App Password is no longer valid.');
  } else {
    console.error(`Gmail SMTP verification failed: ${detail}`);
  }
  process.exit(1);
});
