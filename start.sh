#!/bin/bash

echo "🎬 Starting NKMovieHUB Application..."
echo "======================================"

# Check if MongoDB is running
echo "🔍 Checking MongoDB status..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   On macOS: brew services start mongodb-community"
    echo "   On Windows/Linux: Start MongoDB service"
    echo ""
    echo "Press Enter to continue anyway, or Ctrl+C to exit..."
    read
else
    echo "✅ MongoDB is running"
fi

# Start backend
echo ""
echo "🚀 Starting Backend Server..."
cd server

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Seed database
echo "🌱 Seeding database..."
npm run seed

# Start backend in background
echo "🔥 Starting backend server on port 5001..."
npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo ""
echo "🌐 Starting Frontend..."
cd ../client

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend
echo "🔥 Starting frontend server on port 3000..."
npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 NKMovieHUB is starting up!"
echo "======================================"
echo "📱 Frontend: http://localhost:3000 (or 3001 if 3000 is busy)"
echo "🔧 Backend:  http://localhost:5001"
echo "📊 Health:   http://localhost:5001/api/health"
echo ""
echo "🔐 Demo Accounts:"
echo "   Admin: admin@gmail.com / 123456"
echo "   User:  user@gmail.com / 123456"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait 