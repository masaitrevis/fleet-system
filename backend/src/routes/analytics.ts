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
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
