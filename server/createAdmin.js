/**
 * Create an admin account, or reset an existing account to admin with a new
 * password. The password is hashed by the User model before it is stored.
 *
 * Credentials are read from the environment so they never live in the repo:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' node createAdmin.js
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='NK Admin' node createAdmin.js
 */
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config({ path: './config.env' });

const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'NK Movie Hub Admin' } = process.env;

const createAdmin = async () => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
    process.exitCode = 1;
    return;
  }

  if (ADMIN_PASSWORD.length < 6) {
    console.error('Password must be at least 6 characters long.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findByEmail(ADMIN_EMAIL);

    if (existing) {
      // Assigning the plain value is safe - the model hashes it on save
      existing.password = ADMIN_PASSWORD;
      existing.role = 'admin';
      existing.status = 'active';
      await existing.save();
      console.log(`✅ Updated existing account ${existing.email} (role: admin, password reset)`);
    } else {
      const admin = new User({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        status: 'active'
      });
      await admin.save();
      console.log(`✅ Created admin account ${admin.email}`);
    }

    const admins = await User.find({ role: 'admin' }).select('name email status');
    console.log('\nAdmin accounts:');
    admins.forEach((a) => console.log(`  - ${a.email} (${a.name}, ${a.status})`));
  } catch (error) {
    console.error('Failed to create admin:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
