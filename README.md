# Fleet Management System

Complete professional fleet management system with authentication, charts, reports, and real-time updates.

## Features

- ✅ **JWT Authentication** with role-based access (Admin/Manager/Viewer)
- ✅ **Fleet Management** - Vehicles, drivers, routes, fuel tracking
- ✅ **Interactive Charts** - Pie, Bar, Line charts using Recharts
- ✅ **Report Exports** - Excel, CSV, PDF export functionality
- ✅ **Real-time Updates** - WebSocket notifications
- ✅ **Excel Import** - Bulk import from your master data template
- ✅ **Responsive UI** - Modern dashboard with Tailwind CSS

## Tech Stack

- **Backend:** Node.js + Express + TypeScript + SQLite
- **Frontend:** React + TypeScript + Tailwind CSS + Recharts
- **Real-time:** Socket.io
- **Auth:** JWT with bcrypt

## Quick Start

### Prerequisites
- Node.js v18+ (install from https://nodejs.org)
- npm (comes with Node.js)

### Step 1: Extract the archive
```bash
tar -xzvf fleet-system.tar.gz
cd fleet-system
```

### Step 2: Start the Backend
```bash
cd backend
npm install
npm run dev
```
The backend will start on http://localhost:3001

### Step 3: Start the Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
The frontend will start on http://localhost:5173

### Step 4: Open in browser
Go to: http://localhost:5173

### Default Login
- **Email:** admin@fleet.local
- **Password:** admin123

## Project Structure

```
fleet-system/
├── backend/
│   ├── src/
│   │   ├── database/     # SQLite database setup
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Auth middleware
│   │   └── index.ts      # Server entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # Auth context
│   │   └── App.tsx       # Main app
│   └── package.json
└── fleet.db              # SQLite database (auto-created)
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| POST /api/auth/login | Login |
| POST /api/auth/register | Register new user |
| GET /api/vehicles | List all vehicles |
| POST /api/vehicles | Create vehicle (Admin/Manager) |
| GET /api/staff | List all staff |
| POST /api/staff | Create staff (Admin/Manager) |
| GET /api/routes | List all routes |
| POST /api/routes | Create route |
| GET /api/fuel | List fuel records |
| POST /api/fuel | Create fuel record |
| GET /api/repairs | List repairs |
| POST /api/repairs | Create repair |
| POST /api/upload | Excel import |
| GET /api/dashboard/stats | Dashboard statistics |

## Excel Import Format

Your Excel file should have these sheets:
- **Fleet** - Vehicle inventory
- **Staff** - Drivers and personnel
- **Routes** - Route assignments
- **TOTAL FUEL TEMPLATE** - Fuel records
- **Repairs Template** - Maintenance records

## Troubleshooting

### Port already in use
```bash
# Kill processes on ports 3001 or 5173
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Database issues
Delete `fleet.db` and restart - it will auto-recreate.

### Missing dependencies
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

## Production Deployment

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Update backend to serve static files

3. Use PostgreSQL instead of SQLite for production

4. Set proper environment variables

## Support

For issues or questions, refer to the code comments or create an issue.

---

**Built with ❤️ by Kimi Claw**# Trigger deploy
