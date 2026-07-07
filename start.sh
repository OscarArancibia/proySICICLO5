#!/bin/bash
set -e

echo "Starting EduGestión..."

if [ "$PROCESS_TYPE" = "backend" ]; then
  echo "🚀 Starting BACKEND service..."
  cd backend
  npm install
  npm start
elif [ "$PROCESS_TYPE" = "frontend" ]; then
  echo "🚀 Starting FRONTEND service..."
  cd Frontend
  npm install
  npm run build
  npm start
else
  echo "🚀 Starting both Frontend and Backend concurrently (All-in-One)..."
  
  echo "Installing backend dependencies..."
  cd backend
  npm install
  
  echo "Installing frontend dependencies..."
  cd ../Frontend
  npm install
  npm run build
  
  echo "Starting services..."
  cd ../backend
  PORT=5001 npm start &
  
  cd ../Frontend
  npm start
fi
