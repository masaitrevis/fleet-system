import { Router } from 'express';
import { query } from '../database';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    // Fleet overview
    const fleetStats = await query(`
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_vehicles,
        COUNT(CASE WHEN status = 'Under Maintenance' OR status = 'Maintenance' THEN 1 END) as maintenance_vehicles,
        COALESCE(SUM(current_mileage), 0) as total_mileage
      FROM vehicles
    `);

    // Staff count
    const staffStats = await query('SELECT COUNT(*) as total_staff FROM staff');

    // Today's routes - PostgreSQL syntax
    const todayRoutes = await query(`
      SELECT COUNT(*) as today_routes,
        COALESCE(SUM(actual_km), 0) as today_km,
        COALESCE(SUM(actual_fuel), 0) as today_fuel
      FROM routes 
      WHERE route_date = CURRENT_DATE
    `);

    // Fuel this month - PostgreSQL syntax
    const monthlyFuel = await query(`
      SELECT COALESCE(SUM(amount), 0) as monthly_cost,
        COALESCE(SUM(quantity_liters), 0) as monthly_liters
      FROM fuel_records 
      WHERE fuel_date >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Pending repairs
    const repairsStats = await query(`
      SELECT COUNT(*) as pending_repairs,
        COALESCE(SUM(cost), 0) as repair_costs
      FROM repairs 
      WHERE status != 'Completed'
    `);

    // Top fuel consumers (last 30 days) - PostgreSQL syntax
    const topConsumers = await query(`
      SELECT v.registration_num, 
        SUM(f.quantity_liters) as total_fuel,
        SUM(f.amount) as total_cost
      FROM fuel_records f
      JOIN vehicles v ON v.id = f.vehicle_id
      WHERE f.fuel_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY v.registration_num
      ORDER BY total_fuel DESC
      LIMIT 5
    `);

    // Maintenance due (within 1000km or 30 days) - PostgreSQL syntax
    const maintenanceDue = await query(`
      SELECT registration_num, make_model, current_mileage, 
        last_service_date, next_service_due
      FROM vehicles
      WHERE status = 'Active'
      AND (
        next_service_due <= CURRENT_DATE + INTERVAL '30 days'
        OR (major_service_interval - (current_mileage % major_service_interval)) <= 1000
      )
      LIMIT 10
    `);

    res.json({
      fleet: fleetStats[0],
      staff: staffStats[0],
      today: todayRoutes[0],
      monthlyFuel: monthlyFuel[0],
      repairs: repairsStats[0],
      topConsumers,
      maintenanceDue
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
  }
});

export default router;
