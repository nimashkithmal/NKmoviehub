# NKMovieHUB - Complete Setup Guide

This guide will help you set up and run the NKMovieHUB application with both backend and frontend components.

## 🏗️ Project Structure

```
NKMovieHUB/
├── client/          # React frontend
├── server/          # Node.js backend
└── SETUP.md         # This file
```

## 🚀 Quick Start

### 1. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On macOS (if installed via Homebrew)
brew services start mongodb-community

# On Windows/Linux, start MongoDB service
# or run mongod in a terminal
```

### 2. Backend Setup
```bash
cd server

# Install dependencies
npm install

# Seed the database with initial users
npm run seed

# Start the development server
npm run dev
```

The backend will start on `http://localhost:5001`

### 3. Frontend Setup
```bash
cd client

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will start on `http://localhost:3000`

## 🔐 Authentication System

### Admin User
- **Email**: admin@gmail.com
- **Password**: 123456
- **Access**: AdminDashboard component
- **Route**: `/admin`

### Regular User
- **Email**: user@gmail.com
- **Password**: 123456
- **Access**: Home component
- **Route**: `/`

## 📊 Database Schema

### User Model
```javascript
{
  name: String (required, 2-50 chars),
  email: String (required, unique, validated),
  password: String (required, min 6 chars, hashed),
  role: String (enum: 'user', 'admin'),
  status: String (enum: 'active', 'inactive'),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - User logout (protected)

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/profile` - Get user profile (protected)
- `PUT /api/users/profile` - Update user profile (protected)

### Health Check
- `GET /api/health` - Server status

## 🧪 Testing

### Test Backend
```bash
cd server
npm test
```

This will test:
- Health check endpoint
- Admin login (admin@gmail.com / 12345)
- Regular user login (user@gmail.com / 123456)
- Invalid login rejection

### Test Frontend
1. Open `http://localhost:3000`
2. Try logging in with both admin and regular user credentials
3. Verify redirects work correctly:
   - Admin → AdminDashboard
   - Regular user → Home

## 🔧 Configuration

### Backend Environment Variables
File: `server/config.env`
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/NKmovie
JWT_SECRET=nkmoviehub_secret_key_2024
NODE_ENV=development
```

### Frontend Configuration
The frontend is configured to connect to `http://localhost:5001` for API calls.

## 🛠️ Development Commands

### Backend
```bash
cd server
npm run dev      # Start development server with nodemon
npm run seed     # Seed database with initial users
npm test         # Run backend tests
npm start        # Start production server
```

### Frontend
```bash
cd client
npm start        # Start development server
npm build        # Build for production
npm test         # Run tests
npm eject        # Eject from Create React App
```

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `config.env`
   - Verify MongoDB port (default: 27017)

2. **Port Already in Use**
   - Change PORT in `config.env`
   - Kill processes using the port
   - Use different ports for frontend/backend

3. **JWT Errors**
   - Ensure JWT_SECRET is set in `config.env`
   - Check token expiration

4. **CORS Issues**
   - Backend has CORS enabled for development
   - Frontend should connect to `http://localhost:5001`

5. **Login Redirect Issues**
   - Verify admin credentials: admin@gmail.com / 12345
   - Check browser console for errors
   - Ensure routes are properly configured

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in `config.env`.

## 📱 Features

### ✅ Implemented
- User authentication (login/register)
- Role-based access control
- Protected routes
- JWT token management
- Password hashing
- Input validation
- Database integration
- Admin/User routing logic

### 🔄 Future Enhancements
- Password reset functionality
- Email verification
- User profile management
- Movie management system
- Search and filtering
- User preferences

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:
1. Check the troubleshooting section
2. Review console logs
3. Verify all services are running
4. Check database connectivity
5. Ensure all dependencies are installed

---

**Happy Coding! 🎬✨** 