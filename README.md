# NKMovieHUB 🎬

A full-stack movie rating and review application built with React.js frontend and Node.js backend.

## 🏠 Home Page

![NKMovieHUB Home Page](Screenshot%202025-10-15%20at%2016.37.15.png)

## 🚀 Features

- **User Authentication**: Secure login and registration system with JWT tokens
- **Movie Management**: Add, view, and manage movies with admin controls
- **TV Show Management**: Complete TV show library with episodes, seasons, and admin controls
- **Rating System**: Rate movies and TV shows with 5-star ratings and user feedback
- **Advanced Search & Filters**: Search by title, filter by genre and year with real-time results
- **Dynamic Slideshow**: Auto-rotating movie wallpapers with manual navigation controls
- **Contact System**: User contact form with email notifications and admin management
- **Email Integration**: Automated email confirmations and admin replies via Gmail SMTP
- **Cloudinary Integration**: Professional image hosting and optimization for posters and thumbnails
- **Admin Dashboard**: Comprehensive administrative interface for managing users, movies, TV shows, and contacts
- **Contact Management**: Admin panel for viewing, replying to, and managing user inquiries
- **Responsive Design**: Modern UI that works seamlessly on all devices
- **Real-time Updates**: Live search results and dynamic content updates
- **Episode Management**: Add and manage episodes for TV shows with individual URLs

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
- Cloudinary (Image Hosting & Optimization)
- Express Validator (Input Validation)
- bcrypt (Password Hashing)
- bcryptjs
- CORS Support

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
│   │   │   ├── TVShowGrid.jsx       # TV Show display grid
│   │   │   ├── MovieDetail.jsx      # Movie detail page
│   │   │   ├── TVShowDetail.jsx     # TV Show detail page
│   │   │   ├── MoviePlayer.jsx      # Video player component
│   │   │   ├── AdminDashboard.jsx   # Admin panel
│   │   │   ├── AddMovie.jsx         # Add movie form
│   │   │   ├── AddTVShow.jsx        # Add TV show form
│   │   │   └── ...
│   │   ├── context/       # Authentication context
│   │   └── ...
├── server/                 # Node.js backend
│   ├── models/            # MongoDB models
│   │   ├── Contact.js     # Contact message model
│   │   ├── Movie.js       # Movie model
│   │   ├── TVShow.js      # TV Show model
│   │   ├── User.js        # User model
│   │   └── Rating.js      # Rating model
│   ├── routes/            # API routes
│   │   ├── contacts.js    # Contact management routes
│   │   ├── movies.js      # Movie management routes
│   │   ├── tvshows.js     # TV Show management routes
│   │   ├── auth.js        # Authentication routes
│   │   └── users.js       # User management routes
│   ├── services/          # External services
│   │   └── emailService.js # Email notification service
│   ├── middleware/        # Authentication middleware
│   ├── seedDatabase.js    # Database seeding script
│   ├── seedMovies.js      # Movie seeding script
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
   - Copy `server/config.env.example` to `server/config.env` or edit existing `server/config.env`
   - Update the MongoDB connection string and JWT secret
   - Configure email settings (optional):
     ```env
     EMAIL_USER=your-gmail@gmail.com
     EMAIL_PASS=your-16-character-app-password
     ```
   - Configure Cloudinary settings (optional, fallback values provided):
     ```env
     CLOUDINARY_CLOUD_NAME=your-cloud-name
     CLOUDINARY_API_KEY=your-api-key
     CLOUDINARY_API_SECRET=your-api-secret
     ```
   - Note: Email and Cloudinary services are optional. The app includes fallback configurations.

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
- **Browse TV Shows**: Explore TV shows with episode management
- **Search & Filter**: Search by title, filter by genre and year for movies/TV shows
- **Rate Content**: Give 1-5 star ratings and leave reviews for movies and TV shows
- **Watch Content**: Access movie players and TV show episodes
- **Contact Support**: Send inquiries and messages through the contact form

### For Admins
- **Admin Dashboard**: Access comprehensive admin panel at `/admin`
- **User Management**: View and manage all registered users
- **Movie Management**: Add, edit, and remove movies from the database
- **TV Show Management**: Add, edit, and remove TV shows with episode management
- **Content Upload**: Upload images for movies and TV shows via Cloudinary
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

## 🎬 Movie Features

### Dynamic Slideshow
- **Auto-rotating Wallpapers**: Beautiful movie-themed background images
- **Manual Navigation**: Click arrows or indicators to manually navigate
- **Responsive Design**: Adapts to different screen sizes
- **Smooth Transitions**: CSS transitions for seamless slide changes
- **Welcome Content**: Overlay text with app branding and features

### Movie Rating System
- **Star Ratings**: 1-5 star rating system
- **User Reviews**: Leave written reviews alongside ratings
- **Rating History**: Track your rating history
- **Average Ratings**: Display average ratings from all users
- **Real-time Updates**: Ratings update immediately after submission

## 📺 TV Show Features

### TV Show Management
- **Episode Management**: Add and manage individual episodes with titles and URLs
- **Seasons Support**: Organize shows by number of seasons
- **Episode Count**: Track total number of episodes
- **Complete Library**: Browse TV shows with full metadata

### TV Show Rating System
- **Unified Rating System**: Same 1-5 star rating as movies
- **Show-specific Ratings**: Track ratings per TV show
- **Average Ratings**: Display average ratings from all users
- **User Reviews**: Leave written reviews for TV shows

## 📄 License

This project is currently in development. Once published, contributions will be welcome.

## 🎯 Key Highlights

- **Full-Stack Application**: Complete React frontend with Node.js/Express backend
- **MongoDB Integration**: Robust database with Mongoose ODM
- **Cloud Storage**: Professional image hosting with Cloudinary
- **Email Services**: Automated email notifications via Nodemailer
- **Role-Based Access**: Admin and user roles with proper authorization
- **Real-Time Features**: Live search, filtering, and content updates
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Secure Authentication**: JWT-based authentication with password hashing
- **RESTful API**: Well-structured API endpoints with proper HTTP methods
- **Production Ready**: Environment-based configuration and error handling

## 👨‍💻 Author

**Nimash Kithmal**
- GitHub: [@nimashkithmal](https://github.com/nimashkithmal)
