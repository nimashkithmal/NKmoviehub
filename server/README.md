# NKMovieHUB Backend Server

This is the backend server for the NKMovieHUB application, built with Node.js, Express, and MongoDB.

## Features

- User authentication with JWT tokens
- User registration and login
- Role-based access control (admin/user)
- MongoDB integration with Mongoose
- Password hashing with bcrypt
- Input validation with express-validator
- CORS enabled for frontend integration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or cloud instance)
- npm or yarn package manager

## Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (or use the existing `config.env`):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/NKmovie
   JWT_SECRET=nkmoviehub_secret_key_2024
   NODE_ENV=development
   ```

## Database Setup

1. Make sure MongoDB is running on your system
2. Create the database (it will be created automatically when you first connect)
3. Seed the database with initial users:

   ```bash
   npm run seed
   ```

   This will create:
   - **Admin User**: admin@gmail.com / 12345
   - **Regular User**: user@gmail.com / 123456

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on port 5000 (or the port specified in your environment variables).

## API Endpoints

### Authentication Routes (`/api/auth`)

- **POST** `/register` - Register a new user
- **POST** `/login` - User login
- **GET** `/me` - Get current user profile (protected)
- **POST** `/logout` - User logout (protected)

### User Routes (`/api/users`)

- **GET** `/` - Get all users (admin only)
- **GET** `/profile` - Get user profile (protected)
- **PUT** `/profile` - Update user profile (protected)

## Authentication Logic

The system implements special logic for the admin user:

- **admin@gmail.com** with password **12345** → Redirects to `/admin` (AdminDashboard)
- Any other valid email/password → Redirects to `/` (Home)

## Database Schema

### User Model
- `name`: String (required, 2-50 characters)
- `email`: String (required, unique, validated)
- `password`: String (required, min 6 characters, hashed)
- `role`: String (enum: 'user', 'admin', default: 'user')
- `status`: String (enum: 'active', 'inactive', default: 'active')
- `lastLogin`: Date
- `createdAt`, `updatedAt`: Timestamps

## Security Features

- Password hashing with bcrypt (cost factor: 12)
- JWT token-based authentication
- Input validation and sanitization
- Protected routes with middleware
- Role-based access control

## Error Handling

The server includes comprehensive error handling:
- Validation errors
- Database connection errors
- Authentication errors
- General server errors

## Health Check

Visit `http://localhost:5001/api/health` to check if the server is running properly.

## Troubleshooting

1. **MongoDB Connection Error**: Make sure MongoDB is running and accessible
2. **Port Already in Use**: Change the PORT in your environment variables
3. **JWT Errors**: Ensure JWT_SECRET is properly set
4. **Validation Errors**: Check that all required fields are provided in requests

## Development

- The server uses nodemon for development (auto-restart on file changes)
- CORS is enabled for frontend development
- Environment variables are loaded from `config.env` 