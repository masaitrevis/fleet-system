# NextBotics Fleet Pro - Demo Data Seeder

## Overview
This module provides a comprehensive demo data seeder for the NextBotics Fleet Pro system. It creates a complete demo environment with sample company, users, vehicles, drivers, fuel transactions, and more.

## API Endpoint

### GET `/api/seed-demo`
Creates demo data if it doesn't exist, or returns existing demo credentials.

**Response (First Run):**
```json
{
  "success": true,
  "message": "Demo data created successfully",
  "alreadySeeded": false,
  "credentials": [
    {
      "email": "admin@nextfleet.com",
      "password": "Admin123!",
      "role": "admin",
      "staffName": "Alex Administrator"
    },
    {
      "email": "manager@nextfleet.com",
      "password": "Manager123!",
      "role": "manager",
      "staffName": "Morgan Manager"
    },
    {
      "email": "staff@nextfleet.com",
      "password": "Staff123!",
      "role": "viewer",
      "staffName": "Sam Staff"
    },
    {
      "email": "driver@nextfleet.com",
      "password": "Driver123!",
      "role": "viewer",
      "staffName": "David Driver"
    },
    {
      "email": "supervisor@nextfleet.com",
      "password": "Supervisor123!",
      "role": "manager",
      "staffName": "Sarah Supervisor"
    }
  ],
  "company": {
    "name": "NextFleet Logistics",
    "slug": "nextfleet-logistics",
    "email": "info@nextfleet.com",
    "phone": "+1 (555) 123-4567",
    "address": "123 Fleet Street, Logistics City, LC 12345"
  },
  "summary": {
    "users": 5,
    "vehicles": 10,
    "drivers": 10,
    "fuelTransactions": 15,
    "assignments": 5,
    "trips": 3,
    "inventoryItems": 20,
    "invoices": 5,
    "alerts": 10,
    "documents": 5,
    "suppliers": 3
  }
}
```

**Response (Already Seeded):**
```json
{
  "success": true,
  "message": "Demo data already exists",
  "alreadySeeded": true,
  "credentials": [...],
  "company": {...}
}
```

### POST `/api/seed-demo`
Force reseed demo data (optional - clears existing and recreates).

**Request Body:**
```json
{
  "force": true
}
```

## Demo Users

| Email | Password | Role | Name |
|-------|----------|------|------|
| admin@nextfleet.com | Admin123! | admin | Alex Administrator |
| manager@nextfleet.com | Manager123! | manager | Morgan Manager |
| staff@nextfleet.com | Staff123! | viewer | Sam Staff |
| driver@nextfleet.com | Driver123! | viewer | David Driver |
| supervisor@nextfleet.com | Supervisor123! | manager | Sarah Supervisor |

## Seeded Data

### 1. Company
- **Name:** NextFleet Logistics
- **Slug:** nextfleet-logistics

### 2. Users (5)
- 1 Admin user
- 2 Manager users
- 2 Staff/Driver users

### 3. Vehicles (10)
- Toyota Hilux Double Cab (2022) - Active
- Ford Ranger XLT (2023) - Active
- Mercedes Sprinter 316 (2021) - Active
- Isuzu NPR 400 (2022) - In Service
- Mitsubishi Fuso Canter (2023) - Active
- Toyota Land Cruiser (2021) - Active
- Nissan Navara Pro-4X (2023) - Active
- Volvo FM 370 (2022) - In Service
- Hino 300 Series (2021) - Defect
- Toyota Coaster (2023) - Active

### 4. Drivers (8 additional + 2 from staff)
- All with license numbers, classes, and expiry dates
- Safety scores between 85-100

### 5. Fuel Transactions (15)
- Randomized fuel records across all vehicles
- Various fuel stations
- Mileage and consumption data

### 6. Assignments/Routes (5)
- Mix of completed and active routes
- Driver-vehicle assignments
- Target vs actual consumption tracking

### 7. Trips/Requisitions (3)
- Completed trips with inspection data
- Odometer readings
- Various purposes (Client Meeting, Delivery, etc.)

### 8. Inventory Items (20)
- Engine oil, filters, brake parts
- Tires, batteries, electrical components
- Fluids and maintenance supplies

### 9. Invoices (5)
- Various statuses (Paid, Sent, Overdue)
- Labor and parts breakdowns
- Tax calculations

### 10. Alerts (10)
- Maintenance reminders
- License expirations
- Fuel variance alerts
- Safety incidents
- System notifications

### 11. Documents (5)
- Insurance certificates
- Vehicle licenses
- Annual inspections
- GPS tracking subscriptions
- Extended warranties

### 12. Suppliers (3)
- AutoParts Kenya Ltd
- Toyota Kenya
- TotalEnergies Kenya

## Usage Instructions

1. **Start the backend server:**
   ```bash
   cd fleet-system/backend
   npm run dev
   ```

2. **Call the seed endpoint:**
   ```bash
   curl http://localhost:3001/api/seed-demo
   ```

3. **Login with demo credentials:**
   Use any of the provided email/password combinations to access the system.

## Notes

- The seeder checks if demo data already exists to prevent duplicates
- Demo users are tagged with `@nextfleet.com` emails for easy identification
- All passwords are hashed using bcrypt before storage
- Vehicle mileage and service dates are randomized within realistic ranges
- Fuel consumption data is calculated based on realistic KM/L ratios
