# VaultLife Authentication Module

Full-stack authentication system with React.js frontend and Node.js/Express backend connected to PostgreSQL via Docker.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL 15 (via Docker)
- **Auth**: JWT tokens + OTP (email/SMS)

## Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker & Docker Compose

### 2. Start PostgreSQL via Docker
```bash
docker-compose up -d postgres
```

### 3. Backend Setup
```bash
cd backend
npm install
cp .env.example .env    # Fill in your values
npm run migrate         # Run DB migrations
npm run dev
```

### 4. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 5. Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- API Health: http://localhost:4000/api/health

## Features
- **New User Registration**: Name, email, phone, password
- **Existing User Login**: Username/email + password → OTP verification
- **OTP Channels**: Email (nodemailer) or SMS (Twilio/MSG91)
- **JWT Authentication**: Access token (15m) + Refresh token (7d)
- **PostgreSQL**: Full schema with migrations
