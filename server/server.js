const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
const path = require('path');
dotenv.config({ path: path.join(__dirname, 'config.env') });

// Debug environment variables
console.log('🔍 Environment variables debug:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
console.log('Config file path:', path.join(__dirname, 'config.env'));

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Fallback: manually set environment variables if dotenv fails
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  process.env.CLOUDINARY_CLOUD_NAME = 'dmjhodvge';
  process.env.CLOUDINARY_API_KEY = '869289811975563';
  process.env.CLOUDINARY_API_SECRET = '0N4n4B6JfqHrY_Pev2vEbn8P80U';
  console.log('⚠️  Using fallback Cloudinary environment variables');
}

// Fallback: manually set email environment variables if dotenv fails
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  process.env.EMAIL_USER = 'qwe730375@gmail.com';
  process.env.EMAIL_PASS = 'rvwp miid gpqr clri';
  console.log('⚠️  Using fallback email environment variables');
}

// Import routes after environment variables are set
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const movieRoutes = require('./routes/movies');
const tvShowRoutes = require('./routes/tvshows');
const contactRoutes = require('./routes/contacts');
const bannerRoutes = require('./routes/banners');
const collectionRoutes = require('./routes/collections');
const notificationRoutes = require('./routes/notifications');
const discoveryRoutes = require('./routes/discovery');
const analyticsRoutes = require('./routes/analytics');
const embedRoutes = require('./routes/embed');
const seoRoutes = require('./routes/seo');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
  console.log(`📊 Database: ${process.env.MONGODB_URI}`);
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/tvshows', tvShowRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/embed', embedRoutes);
app.use('/api/seo', seoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'NKMovieHUB Server is running',
    timestamp: new Date().toISOString(),
    database: 'Connected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Missing'}`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing'}`);
}); 