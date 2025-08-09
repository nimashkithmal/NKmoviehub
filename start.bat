@echo off
echo 🎬 Starting NKMovieHUB Application...
echo ======================================

echo.
echo 🚀 Starting Backend Server...
cd server

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing backend dependencies...
    npm install
)

REM Seed database
echo 🌱 Seeding database...
npm run seed

REM Start backend in background
echo 🔥 Starting backend server on port 5000...
start "Backend Server" npm run dev

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend
echo.
echo 🌐 Starting Frontend...
cd ..\client

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    npm install
)

REM Start frontend
echo 🔥 Starting frontend server on port 3000...
start "Frontend Server" npm start

echo.
echo 🎉 NKMovieHUB is starting up!
echo ======================================
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:5000
echo 📊 Health:   http://localhost:5000/api/health
echo.
echo 🔐 Demo Accounts:
echo    Admin: admin@gmail.com / 123456
echo    User:  user@gmail.com / 123456
echo.
echo Press any key to exit this window...
pause >nul 