import { Router, Request, Response } from 'express';
import { query } from '../database';
import * as aiService from '../services/ai';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Role-based access control for company analytics
const canViewCompanyAnalytics = (role?: string): boolean => {
  const allowedRoles = ['admin', 'fleet_manager', 'high_staff', 'manager', 'transport_supervisor'];
  return allowedRoles.includes(role?.toLowerCase() || '');
};

// Get company analytics (admin/managers only)
router.get('/company', authenticateToken, asyncHandler(async (req: any, res: Response) => {
  const userRole = req.user?.role;
  
  if (!canViewCompanyAnalytics(userRole)) {
    return res.status(403).json({ error: 'Access denied. Requires admin, fleet_manager, or high_staff role.' });
  }

  try {
    // Vehicle stats
    const vehicleRes = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'Under Maintenance' THEN 1 END) as maintenance,
        COUNT(CASE WHEN status = 'Retired' THEN 1 END) as retired
      FROM vehicles 
      WHERE deleted_at IS NULL
    `);
    
    const totalVehicles = parseInt(vehicleRes[0]?.total || 0);
    const activeVehicles = parseInt(vehicleRes[0]?.active || 0);
    const maintenanceVehicles = parseInt(vehicleRes[0]?.maintenance || 0);
    const retiredVehicles = parseInt(vehicleRes[0]?.retired || 0);

    // Driver stats
    const driverRes = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active
      FROM staff 
      WHERE role = 'Driver'
    `);
    const totalDrivers = parseInt(driverRes[0]?.total || 0);
    const activeDrivers = parseInt(driverRes[0]?.active || 0);

    // Fleet utilization (vehicles with recent routes)
    const utilizationRes = await query(`
      SELECT COUNT(DISTINCT vehicle_id) as count
      FROM routes
      WHERE route_date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    const utilizedVehicles = parseInt(utilizationRes[0]?.count || 0);
    const fleetUtilization = totalVehicles > 0 ? Math.round((utilizedVehicles / totalVehicles) * 100) : 0;

    // Training stats
    const trainingRes = await query(`
      SELECT 
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN status = 'passed' THEN 1 END) as completed
      FROM training_enrollments
    `);
    const totalEnrollments = parseInt(trainingRes[0]?.total_enrollments || 0);
    const coursesCompleted = parseInt(trainingRes[0]?.completed || 0);

    // Monthly fuel consumption
    const fuelRes = await query(`
      SELECT COALESCE(SUM(liters), 0) as total
      FROM fuel_records
      WHERE fuel_date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const monthlyFuelConsumption = parseFloat(fuelRes[0]?.total || 0);

    // Monthly maintenance cost
    const maintenanceRes = await query(`
      SELECT COALESCE(SUM(cost), 0) as total
      FROM repairs
      WHERE date_in >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const monthlyMaintenanceCost = parseFloat(maintenanceRes[0]?.total || 0);

    // Accidents this month
    const accidentRes = await query(`
      SELECT COUNT(*) as count
      FROM accidents
      WHERE accident_date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const accidentsThisMonth = parseInt(accidentRes[0]?.count || 0);

    // Vehicle status breakdown for pie chart
    const vehicleStatusBreakdown = [
      { name: 'Active', value: activeVehicles },
      { name: 'Maintenance', value: maintenanceVehicles },
      { name: 'Retired', value: retiredVehicles },
      { name: 'Other', value: totalVehicles - activeVehicles - maintenanceVehicles - retiredVehicles }
    ].filter(s => s.value > 0);

    // Training progress for last 6 months
    const months = [];
    const trainingProgress = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString('default', { month: 'short' });
      months.push(monthName);
      
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthTraining = await query(`
        SELECT 
          COUNT(*) as enrolled,
          COUNT(CASE WHEN status = 'passed' THEN 1 END) as completed
        FROM training_enrollments
        WHERE enrolled_at >= $1 AND enrolled_at <= $2
      `, [monthStart, monthEnd]);
      
      trainingProgress.push({
        month: monthName,
        enrolled: parseInt(monthTraining[0]?.enrolled || 0),
        completed: parseInt(monthTraining[0]?.completed || 0)
      });
    }

    // Fuel efficiency by vehicle
    const fuelEfficiencyRes = await query(`
      SELECT 
        v.registration_num as vehicle,
        COALESCE(AVG(fr.km_per_liter), 0) as efficiency
      FROM vehicles v
      LEFT JOIN fuel_records fr ON fr.vehicle_id = v.id
      WHERE v.deleted_at IS NULL
      GROUP BY v.id, v.registration_num
      HAVING AVG(fr.km_per_liter) > 0
      ORDER BY efficiency DESC
      LIMIT 10
    `);
    
    const fuelEfficiency = fuelEfficiencyRes.map((r: any) => ({
      vehicle: r.vehicle,
      efficiency: parseFloat(r.efficiency || 0)
    }));

    res.json({
      totalVehicles,
      activeVehicles,
      maintenanceVehicles,
      totalDrivers,
      activeDrivers,
      fleetUtilization,
      coursesCompleted,
      totalEnrollments,
      monthlyFuelConsumption,
      monthlyMaintenanceCost,
      accidentsThisMonth,
      vehicleStatusBreakdown,
      trainingProgress,
      fuelEfficiency
    });
  } catch (error: any) {
    console.error('Company analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch company analytics: ' + error.message });
  }
}));

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

// Get driver summary (for driver dashboard)
router.get('/driver-summary', async (req: any, res) => {
  const staffId = req.user?.staffId;
  
  if (!staffId) {
    return res.status(400).json({ error: 'No staff ID found' });
  }
  
  try {
    // Get trips completed
    const tripsResult = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as pending,
        COALESCE(SUM(actual_km), 0) as total_distance,
        COALESCE(AVG(actual_km / NULLIF(actual_fuel, 0)), 0) as fuel_efficiency
      FROM routes 
      WHERE driver1_id = $1
    `, [staffId]);
    
    // Get incidents count
    const incidentsResult = await query(`
      SELECT COUNT(*) as count 
      FROM accidents 
      WHERE driver_id = $1 AND accident_date >= CURRENT_DATE - INTERVAL '1 year'
    `, [staffId]);
    
    // Calculate safety score
    const accidentCount = parseInt(incidentsResult[0]?.count || 0);
    const safetyScore = Math.max(0, 100 - (accidentCount * 15));
    
    res.json({
      trips_completed: parseInt(tripsResult[0]?.completed || 0),
      trips_pending: parseInt(tripsResult[0]?.pending || 0),
      safety_score: safetyScore,
      fuel_efficiency: parseFloat(tripsResult[0]?.fuel_efficiency || 0),
      incidents: accidentCount,
      total_distance: parseFloat(tripsResult[0]?.total_distance || 0)
    });
  } catch (error: any) {
    console.error('Driver summary error:', error);
    res.status(500).json({ error: 'Failed to fetch driver summary' });
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

// ========== AI ANALYTICS GENERATOR ==========

// AI Analytics query endpoint
router.post('/ai-query', async (req: any, res) => {
  const { query: userQuery, chart_type = 'auto' } = req.body;
  
  if (!userQuery) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  try {
    // Parse the natural language query to determine intent
    const parsedQuery = parseAnalyticsQuery(userQuery.toLowerCase());
    
    // Generate SQL and fetch data based on intent
    const result = await generateAnalyticsResponse(parsedQuery, chart_type);
    
    res.json(result);
  } catch (error: any) {
    console.error('AI Analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to process analytics query',
      message: error.message 
    });
  }
});

// Parse natural language query
function parseAnalyticsQuery(query: string) {
  const keywords = {
    fuel: ['fuel', 'consumption', 'liters', 'gas', 'diesel', 'mileage'],
    maintenance: ['repair', 'maintenance', 'service', 'fix', 'broken'],
    accidents: ['accident', 'incident', 'crash', 'collision', 'safety'],
    vehicles: ['vehicle', 'car', 'truck', 'fleet', 'automobile'],
    drivers: ['driver', 'staff', 'employee', 'personnel'],
    costs: ['cost', 'expense', 'spend', 'price', 'money', 'budget'],
    performance: ['performance', 'efficiency', 'productivity', 'rating'],
    trends: ['trend', 'over time', 'monthly', 'weekly', 'yearly', 'history']
  };
  
  const detectedTopics: string[] = [];
  
  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(word => query.includes(word))) {
      detectedTopics.push(topic);
    }
  }
  
  // Detect time range
  let timeRange = '30 days';
  if (query.includes('year') || query.includes('annual')) timeRange = '1 year';
  else if (query.includes('month')) timeRange = '30 days';
  else if (query.includes('week')) timeRange = '7 days';
  else if (query.includes('all time') || query.includes('ever')) timeRange = 'all';
  
  // Detect aggregation
  let aggregation = 'sum';
  if (query.includes('average') || query.includes('avg')) aggregation = 'avg';
  if (query.includes('count') || query.includes('number')) aggregation = 'count';
  if (query.includes('max') || query.includes('highest')) aggregation = 'max';
  if (query.includes('min') || query.includes('lowest')) aggregation = 'min';
  
  // Detect grouping
  let groupBy = null;
  if (query.includes('by vehicle') || query.includes('per vehicle')) groupBy = 'vehicle';
  if (query.includes('by driver') || query.includes('per driver')) groupBy = 'driver';
  if (query.includes('by month') || query.includes('monthly')) groupBy = 'month';
  if (query.includes('by department') || query.includes('per department')) groupBy = 'department';
  
  return {
    originalQuery: query,
    topics: detectedTopics,
    timeRange,
    aggregation,
    groupBy
  };
}

// Generate analytics response based on parsed query
async function generateAnalyticsResponse(parsedQuery: any, requestedChartType: string) {
  const { topics, timeRange, aggregation, groupBy } = parsedQuery;
  
  // Default to fuel analysis if no topics detected
  const primaryTopic = topics[0] || 'fuel';
  
  let sql = '';
  let params: any[] = [];
  let chartType = requestedChartType === 'auto' ? 'bar' : requestedChartType;
  let title = '';
  let description = '';
  
  // Build query based on topic
  switch (primaryTopic) {
    case 'fuel':
      if (groupBy === 'vehicle') {
        sql = `
          SELECT v.registration_num as label, 
                 SUM(f.quantity_liters) as value,
                 AVG(f.km_per_liter) as efficiency
          FROM fuel_records f
          JOIN vehicles v ON v.id = f.vehicle_id
          ${timeRange !== 'all' ? "WHERE f.fuel_date >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
          GROUP BY v.registration_num
          ORDER BY value DESC
          LIMIT 10
        `;
        title = 'Fuel Consumption by Vehicle';
        description = `Total fuel consumed per vehicle over the last ${timeRange}`;
      } else if (groupBy === 'month') {
        sql = `
          SELECT TO_CHAR(f.fuel_date, 'YYYY-MM') as label,
                 SUM(f.quantity_liters) as value,
                 SUM(f.amount) as cost
          FROM fuel_records f
          ${timeRange !== 'all' ? "WHERE f.fuel_date >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
          GROUP BY TO_CHAR(f.fuel_date, 'YYYY-MM')
          ORDER BY label
        `;
        title = 'Monthly Fuel Consumption';
        description = `Fuel consumption trend over ${timeRange}`;
        chartType = 'line';
      } else {
        sql = `
          SELECT v.registration_num as label, 
                 SUM(f.${aggregation === 'avg' ? 'km_per_liter' : 'quantity_liters'}) as value
          FROM fuel_records f
          JOIN vehicles v ON v.id = f.vehicle_id
          ${timeRange !== 'all' ? "WHERE f.fuel_date >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
          GROUP BY v.registration_num
          ORDER BY value DESC
          LIMIT 10
        `;
        title = 'Fuel Analysis';
        description = `Fuel ${aggregation} by vehicle`;
      }
      break;
      
    case 'maintenance':
      if (groupBy === 'vehicle') {
        sql = `
          SELECT v.registration_num as label,
                 COUNT(*) as value,
                 SUM(r.cost) as total_cost
          FROM repairs r
          JOIN vehicles v ON v.id = r.vehicle_id
          ${timeRange !== 'all' ? "WHERE r.date_in >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
          GROUP BY v.registration_num
          ORDER BY value DESC
          LIMIT 10
        `;
        title = 'Maintenance Frequency by Vehicle';
        description = `Number of repairs per vehicle over ${timeRange}`;
      } else {
        sql = `
          SELECT preventative_maintenance as label,
                 COUNT(*) as value,
                 AVG(cost) as avg_cost
          FROM repairs
          ${timeRange !== 'all' ? "WHERE date_in >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
          GROUP BY preventative_maintenance
          ORDER BY value DESC
        `;
        title = 'Maintenance by Type';
        description = `Repair frequency by maintenance type`;
        chartType = 'pie';
      }
      break;
      
    case 'costs':
      sql = `
        SELECT 'Fuel' as label, SUM(amount) as value
        FROM fuel_records
        ${timeRange !== 'all' ? "WHERE fuel_date >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
        UNION ALL
        SELECT 'Repairs', SUM(cost)
        FROM repairs
        ${timeRange !== 'all' ? "WHERE date_in >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
        UNION ALL
        SELECT 'Total', 
          (SELECT COALESCE(SUM(amount), 0) FROM fuel_records ${timeRange !== 'all' ? "WHERE fuel_date >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}) +
          (SELECT COALESCE(SUM(cost), 0) FROM repairs ${timeRange !== 'all' ? "WHERE date_in >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''})
      `;
      title = 'Cost Breakdown';
      description = `Total operational costs over ${timeRange}`;
      chartType = 'pie';
      break;
      
    case 'accidents':
      sql = `
        SELECT accident_type as label,
               COUNT(*) as value
        FROM accidents
        ${timeRange !== 'all' ? "WHERE accident_date >= CURRENT_DATE - INTERVAL '" + timeRange + "'" : ''}
        GROUP BY accident_type
        ORDER BY value DESC
      `;
      title = 'Accidents by Type';
      description = `Accident distribution over ${timeRange}`;
      chartType = 'pie';
      break;
      
    case 'vehicles':
      sql = `
        SELECT status as label,
               COUNT(*) as value
        FROM vehicles
        GROUP BY status
        ORDER BY value DESC
      `;
      title = 'Vehicle Status Distribution';
      description = 'Current vehicle status breakdown';
      chartType = 'pie';
      break;
      
    default:
      sql = `
        SELECT 'Total Vehicles' as label, COUNT(*) as value FROM vehicles
        UNION ALL
        SELECT 'Active Vehicles', COUNT(*) FROM vehicles WHERE status = 'Active'
        UNION ALL
        SELECT 'Total Staff', COUNT(*) FROM staff
        UNION ALL
        SELECT 'Total Drivers', COUNT(*) FROM staff WHERE role = 'Driver'
      `;
      title = 'Fleet Overview';
      description = 'General fleet statistics';
  }
  
  // Execute query
  const result = await query(sql, params);
  
  // Format data for charts
  const chartData = result.map((row: any) => ({
    label: row.label,
    value: parseFloat(row.value) || 0,
    ...row
  }));
  
  // Generate insights
  const insights = generateInsights(chartData, primaryTopic, aggregation);
  
  return {
    title,
    description,
    chart_type: chartType,
    data: chartData,
    insights,
    query_details: {
      topics,
      time_range: timeRange,
      aggregation,
      group_by: groupBy
    }
  };
}

// Generate insights from data
function generateInsights(data: any[], topic: string, aggregation: string) {
  if (data.length === 0) return ['No data available for analysis'];
  
  const insights: string[] = [];
  const values = data.map(d => d.value);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  
  // Top performer
  const topItem = data.find(d => d.value === max);
  if (topItem) {
    insights.push(`${topItem.label} has the highest ${topic} ${aggregation} at ${max.toFixed(2)}`);
  }
  
  // Average insight
  insights.push(`Average ${topic} ${aggregation} across all items: ${avg.toFixed(2)}`);
  
  // Trends for multiple data points
  if (data.length > 2) {
    const aboveAvg = data.filter(d => d.value > avg).length;
    const belowAvg = data.filter(d => d.value < avg).length;
    insights.push(`${aboveAvg} items above average, ${belowAvg} items below average`);
  }
  
  // Topic-specific insights
  if (topic === 'fuel' && avg > 0) {
    if (avg < 8) {
      insights.push('⚠️ Low fuel efficiency detected. Consider vehicle maintenance checks.');
    } else if (avg > 12) {
      insights.push('✅ Good fuel efficiency across the fleet.');
    }
  }
  
  if (topic === 'maintenance' && max > 5) {
    insights.push('⚠️ Some vehicles require frequent repairs. Consider replacement evaluation.');
  }
  
  return insights;
}

// Get available AI analytics queries suggestions
router.get('/ai-suggestions', async (req, res) => {
  const suggestions = [
    { query: 'Show fuel consumption by vehicle', chart_type: 'bar' },
    { query: 'Monthly fuel costs trend', chart_type: 'line' },
    { query: 'Maintenance costs by vehicle', chart_type: 'bar' },
    { query: 'Breakdown of operational costs', chart_type: 'pie' },
    { query: 'Accidents by type this year', chart_type: 'pie' },
    { query: 'Vehicle status distribution', chart_type: 'pie' },
    { query: 'Fuel efficiency by driver', chart_type: 'bar' },
    { query: 'Repair frequency by vehicle', chart_type: 'bar' },
    { query: 'Average fuel consumption last month', chart_type: 'bar' },
    { query: 'Total maintenance costs this year', chart_type: 'line' }
  ];
  
  res.json(suggestions);
});

// AI-powered natural language query
router.post('/ai-query',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { query: queryText } = req.body;
    
    if (!queryText) {
      return res.status(400).json({ error: 'Query text is required' });
    }
    
    const result = await aiService.processAnalyticsQuery(queryText);
    
    res.json({
      ...result,
      aiEnabled: aiService.AI_ENABLED
    });
  })
);

export default router;