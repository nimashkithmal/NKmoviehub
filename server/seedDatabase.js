const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB successfully');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Role:', existingAdmin.role);
      console.log('📅 Created:', existingAdmin.createdAt);
    } else {
      // Create admin user
      const adminUser = new User({
        name: 'Admin User',
        email: 'admin@gmail.com',
        password: '123456',
        role: 'admin',
        status: 'active'
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully');
      console.log('📧 Email: admin@gmail.com');
      console.log('🔑 Password: 123456');
      console.log('👤 Role: admin');
    }

    // Check if regular user exists for testing
    const existingUser = await User.findOne({ email: 'user@gmail.com' });
    
    if (!existingUser) {
      // Create a regular user for testing
      const regularUser = new User({
        name: 'Regular User',
        email: 'user@gmail.com',
        password: '123456',
        role: 'user',
        status: 'active'
      });

      await regularUser.save();
      console.log('✅ Regular user created successfully');
      console.log('📧 Email: user@gmail.com');
      console.log('🔑 Password: 123456');
      console.log('👤 Role: user');
    }

    // Display all users
    const allUsers = await User.find({}).select('-password');
    console.log('\n📊 All users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    console.log('\n🎯 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
};

// Run the seeder
seedDatabase(); 