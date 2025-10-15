# NKMovieHUB 🎬

A full-stack movie rating and review application built with React.js frontend and Node.js backend.

## 🏠 Home Page

![NKMovieHUB Home Page](Screenshot%202025-10-15%20at%2016.37.15.png)

## 🚀 Features

- **User Authentication**: Secure login and registration system with JWT tokens
- **Movie Management**: Add, view, and manage movies with admin controls
- **Rating System**: Rate movies and leave reviews with user feedback
- **Advanced Search & Filters**: Search by title, filter by genre and year with real-time results
- **Dynamic Slideshow**: Auto-rotating movie wallpapers with manual navigation controls
- **Contact System**: User contact form with email notifications and admin management
- **Email Integration**: Automated email confirmations and admin replies via Gmail SMTP
- **Admin Dashboard**: Comprehensive administrative interface for managing users, movies, and contacts
- **Contact Management**: Admin panel for viewing, replying to, and managing user inquiries
- **Responsive Design**: Modern UI that works seamlessly on all devices
- **Real-time Updates**: Live search results and dynamic content updates

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
- Nodemailer (Email Service)
- Express Validator (Input Validation)
- bcrypt (Password Hashing)

## 📁 Project Structure

```
NKMovieHUB/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ContactForm.jsx      # Contact form component
│   │   │   ├── ContactManagement.jsx # Admin contact management
│   │   │   ├── ContactSection.jsx   # Contact page section
│   │   │   ├── Home.jsx             # Home page with slideshow
│   │   │   ├── MovieGrid.jsx        # Movie display grid
│   │   │   ├── AdminDashboard.jsx   # Admin panel
│   │   │   └── ...
│   │   ├── context/       # Authentication context
│   │   └── ...
├── server/                 # Node.js backend
│   ├── models/            # MongoDB models
│   │   ├── Contact.js     # Contact message model
│   │   ├── Movie.js       # Movie model
│   │   ├── User.js        # User model
│   │   └── Rating.js      # Rating model
│   ├── routes/            # API routes
│   │   ├── contacts.js    # Contact management routes
│   │   ├── movies.js      # Movie management routes
│   │   ├── auth.js        # Authentication routes
│   │   └── users.js       # User management routes
│   ├── services/          # External services
│   │   └── emailService.js # Email notification service
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
   # When the repository is published, use:
   # git clone https://github.com/nimashkithmal/NKMovieHUB.git
   # cd NKMovieHUB
   
   # For now, if you have access to the repository:
   git clone <repository-url>
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
   - Configure email settings (optional):
     ```env
     EMAIL_USER=your-gmail@gmail.com
     EMAIL_PASS=your-16-character-app-password
     ```
   - Note: Email service is optional. Contact system works without email configuration.

5. **Start the application**

   **Option 1: Using startup scripts (Recommended)**
   ```bash
   # For Unix/Linux/macOS
   ./start.sh
   
   # For Windows
   start.bat
   ```

   **Option 2: Manual startup**
   ```bash
   # Terminal 1 - Start backend (from server directory)
   cd server
   npm start
   
   # Terminal 2 - Start frontend (from client directory)
   cd client
   npm start
   ```

   The application will be available at:
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:5001

6. **Seed the database (Optional)**
   ```bash
   cd server
   npm run seed
   ```
   This creates default admin and user accounts:
   - **Admin**: admin@gmail.com / 12345
   - **User**: user@gmail.com / 123456

## 📱 Usage

### For Users
- **Register/Login**: Create an account or sign in to access full features
- **Browse Movies**: View all available movies with advanced search and filters
- **Search & Filter**: Search by movie title, filter by genre and year
- **Rate Movies**: Give ratings and leave reviews for movies you've watched
- **Contact Support**: Send inquiries and messages through the contact form

### For Admins
- **Admin Dashboard**: Access comprehensive admin panel at `/admin`
- **User Management**: View and manage all registered users
- **Movie Management**: Add, edit, and remove movies from the database
- **Contact Management**: View, reply to, and manage user inquiries
- **Email Integration**: Send automated replies to user contacts
- **Statistics**: View contact statistics and system metrics

## 🔧 Configuration

The application uses environment variables for configuration. See `server/config.env` for required variables.

### Required Environment Variables
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/NKmovie
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

### Optional Email Configuration
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
```

**Note**: Email service is optional. The contact system will work without email configuration, but users won't receive confirmation emails or admin replies via email.

## 📧 Contact System Features

### User Contact Form
- **Form Validation**: Comprehensive client-side and server-side validation
- **Email Notifications**: Automatic confirmation emails (if email service is configured)
- **Character Limits**: Name (100), Subject (200), Message (2000 characters)
- **Real-time Feedback**: Visual validation indicators and error messages

### Admin Contact Management
- **Dashboard View**: Statistics cards showing total, new, and replied contacts
- **Search & Filter**: Search contacts by name, email, subject, or message content
- **Status Management**: Mark contacts as new, read, replied, or closed
- **Reply System**: Send replies to users with automatic email notifications
- **Contact History**: View complete conversation history with timestamps
- **Bulk Operations**: Manage multiple contacts efficiently

### Email Integration
- **Gmail SMTP**: Configured for Gmail with App Password authentication
- **HTML Templates**: Beautiful, responsive email templates
- **Confirmation Emails**: Automatic confirmation when users submit contact forms
- **Reply Notifications**: Send replies directly to user email addresses
- **Error Handling**: Graceful fallback when email service is unavailable

## 🎬 Movie Features

### Dynamic Slideshow
- **Auto-rotating Wallpapers**: Beautiful movie-themed background images
- **Manual Navigation**: Click arrows or indicators to manually navigate
- **Responsive Design**: Adapts to different screen sizes
- **Smooth Transitions**: CSS transitions for seamless slide changes
- **Welcome Content**: Overlay text with app branding and features

### Advanced Search & Filtering
- **Real-time Search**: Search movies by title with instant results
- **Genre Filtering**: Filter movies by multiple genres
- **Year Filtering**: Filter movies by release year
- **URL Parameters**: Search and filter states preserved in URL
- **Combined Filters**: Use search and filters together for precise results
- **Clear Filters**: Easy reset functionality for all filters

### Movie Rating System
- **Star Ratings**: 1-5 star rating system
- **User Reviews**: Leave written reviews alongside ratings
- **Rating History**: Track your rating history
- **Average Ratings**: Display average ratings from all users
- **Real-time Updates**: Ratings update immediately after submission

## 📄 License

This project is currently in development. Once published, contributions will be welcome:

## 👨‍💻 Author

**Nimash Kithmal**
- GitHub: [@nimashkithmal](https://github.com/nimashkithmal)
