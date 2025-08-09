# NKMovieHUB 🎬

A full-stack movie rating and review application built with React.js frontend and Node.js backend.

## 🚀 Features

- **User Authentication**: Secure login and registration system
- **Movie Management**: Add, view, and manage movies
- **Rating System**: Rate movies and leave reviews
- **Admin Dashboard**: Administrative interface for managing users and content
- **Responsive Design**: Modern UI that works on all devices

## 🛠️ Tech Stack

### Frontend
- React.js
- CSS3
- Context API for state management

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication

## 📁 Project Structure

```
NKMovieHUB/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # Authentication context
│   │   └── ...
├── server/                 # Node.js backend
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── middleware/        # Authentication middleware
│   └── ...
└── ...
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nimashkithmal/NKmoviehub.git
   cd NKMovieHUB
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Environment Setup**
   - Copy `server/config.env.example` to `server/config.env`
   - Update the MongoDB connection string and JWT secret

5. **Start the application**
   ```bash
   # Start backend (from server directory)
   npm start
   
   # Start frontend (from client directory)
   npm start
   ```

## 📱 Usage

- **Register/Login**: Create an account or sign in
- **Browse Movies**: View all available movies
- **Rate Movies**: Give ratings and leave reviews
- **Admin Access**: Manage users and content (admin only)

## 🔧 Configuration

The application uses environment variables for configuration. See `server/config.env` for required variables.

## 📝 API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/movies` - Get all movies
- `POST /api/movies` - Add new movie (admin only)
- `POST /api/movies/:id/rate` - Rate a movie

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Nimash Kithmal**
- GitHub: [@nimashkithmal](https://github.com/nimashkithmal)

## 🙏 Acknowledgments

- React.js community
- Node.js community
- MongoDB documentation 