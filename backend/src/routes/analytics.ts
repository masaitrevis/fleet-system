import { Router } from 'express';
import { query } from '../database';

const router = Router();

// Get analytics summary
router.get('/summary', async (req, res) => {
  try {
    // Vehicle stats
    const vehicleRes = await query('SELECT COUNT(*) as count, status FROM vehicles GROUP BY status');
    const totalVehicles = vehicleRes.reduce((sum: number, v: any) => sum + parseInt(v.count), 0);
    const activeVehicles = vehicleRes.find((v: any) => v.status === 'Active')?.count || 0;

    // Staff stats
    const staffRes = await query('SELECT COUNT(*) as count FROM staff');
    const totalStaff = parseInt(staffRes[0]?.count || 0);
    
    const driverRes = await query("SELECT COUNT(*) as count FROM staff WHERE role = 'Driver'");
    const totalDrivers = parseInt(driverRes[0]?.count || 0);

    // Fuel stats
    const fuelRes = await query('SELECT SUM(amount) as total, AVG(km_per_liter) as avg FROM fuel_records');
    const totalFuelCost = parseFloat(fuelRes[0]?.total || 0);
    const avgConsumption = parseFloat(fuelRes[0]?.avg || 0);

    // Repair stats
    const repairRes = await query('SELECT COUNT(*) as count, status FROM repairs GROUP BY status');
    const pendingRepairs = repairRes.find((r: any) => r.status === 'Pending')?.count || 0;
    const completedRepairs = repairRes.find((r: any) => r.status === 'Completed')?.count || 0;

    res.json({
      totalVehicles,
      activeVehicles,
      totalStaff,
      totalDrivers,
      totalFuelCost,
      avgConsumption,
      pendingRepairs,
      completedRepairs
    });
  } catch (error: any) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get driver KPIs
router.get('/driver-kpis', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        s.id,
        s.staff_name as name,
        COUNT(r.id) as trips,
        COALESCE(AVG(r.actual_km / NULLIF(r.actual_fuel, 0)), 0) as fuel_efficiency,
        COALESCE(AVG(CASE WHEN r.variance <= 0 THEN 100 ELSE 100 - (r.variance * 5) END), 85) as on_time_performance,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.created_at)) as experience,
        COALESCE(AVG(r.variance), 0) as variance
      FROM staff s
      LEFT JOIN routes r ON r.driver1_id = s.id
      WHERE s.role = 'Driver'
      GROUP BY s.id, s.staff_name, s.created_at
      ORDER BY trips DESC
      LIMIT 20
    `);

    // Calculate rating (0-100)
    const drivers = result.map((d: any) => ({
      ...d,
      fuel_efficiency: parseFloat(d.fuel_efficiency || 0),
      on_time_performance: Math.min(100, Math.max(0, parseFloat(d.on_time_performance || 85))),
      experience: parseInt(d.experience || 0),
      variance: parseFloat(d.variance || 0),
      rating: Math.min(100, Math.round(
        (parseFloat(d.fuel_efficiency || 10) * 5) + 
        (parseFloat(d.on_time_performance || 85) * 0.3) +
        (parseInt(d.experience || 0) * 2) -
        (Math.abs(parseFloat(d.variance || 0)) * 2)
      ))
    }));

    res.json(drivers);
  } catch (error: any) {
    console.error('Driver KPIs error:', error);
    res.status(500).json({ error: 'Failed to fetch driver KPIs' });
  }
});

// Get maintenance productivity
router.get('/maintenance-productivity', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        preventative_maintenance as category,
        COUNT(*) as count,
        COALESCE(AVG(cost), 0) as avg_cost,
        COALESCE(AVG(CASE WHEN actual_repair_hours > 0 THEN target_repair_hours / actual_repair_hours ELSE 1 END), 1) as productivity
      FROM repairs
      WHERE preventative_maintenance IS NOT NULL
      GROUP BY preventative_maintenance
      ORDER BY count DESC
    `);

    res.json(result.map((r: any) => ({
      ...r,
      count: parseInt(r.count),
      avgCost: parseFloat(r.avg_cost),
      productivity: parseFloat(r.productivity)
    })));
  } catch (error: any) {
    console.error('Maintenance productivity error:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance data' });
  }
});

// Get fleet summary
router.get('/fleet-summary', async (req, res) => {
  try {
    const totalRes = await query('SELECT COUNT(*) as count FROM vehicles');
    const activeRes = await query("SELECT COUNT(*) as count FROM vehicles WHERE status = 'Active'");
    const maintenanceRes = await query(`
      SELECT COUNT(*) as count FROM vehicles 
      WHERE next_service_due <= CURRENT_DATE + INTERVAL '30 days'
    `);
    const fuelRes = await query('SELECT AVG(km_per_liter) as avg FROM fuel_records');

    res.json({
      totalVehicles: parseInt(totalRes[0]?.count || 0),
      activeVehicles: parseInt(activeRes[0]?.count || 0),
      maintenanceDue: parseInt(maintenanceRes[0]?.count || 0),
      avgFuelConsumption: parseFloat(fuelRes[0]?.avg || 0)
    });
  } catch (error: any) {
    console.error('Fleet summary error:', error);
    res.status(500).json({ error: 'Failed to fetch fleet summary' });
  }
});

export default router;
