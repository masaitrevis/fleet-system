import { Router, Request, Response } from 'express';
import { authenticateToken, authenticateApiKey } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/errorHandler';
import { query } from '../../../database';
import { emitWebhookEvent } from '../../../services/webhook';

const router = Router();

// Use either JWT or API key authentication
const auth = (req: any, res: any, next: any) => {
  // Try API key first, then fall back to JWT
  authenticateApiKey(req, res, (err: any) => {
    if (err || !req.user) {
      return authenticateToken(req, res, next);
    }
    next();
  });
};

// Apply auth to all API v1 routes
router.use(auth);

// ==================== VEHICLES ====================

/**
 * @swagger
 * /api/v1/vehicles:
 *   get:
 *     summary: List all vehicles
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 */
router.get('/vehicles', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  let sql = `
    SELECT v.*, 
      (SELECT COUNT(*) FROM accidents WHERE vehicle_id = v.id) as accident_count
    FROM vehicles v
    WHERE v.deleted_at IS NULL
  `;
  const params: any[] = [];
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (v.company_id = $1 OR v.company_id IS NULL)`;
    params.push(companyId);
  }
  
  sql += ` ORDER BY v.created_at DESC`;
  
  const vehicles = await query(sql, params);
  res.json({ data: vehicles, count: vehicles.length });
}));

/**
 * @swagger
 * /api/v1/vehicles/{id}:
 *   get:
 *     summary: Get vehicle details
 *     tags: [Vehicles]
 */
router.get('/vehicles/:id', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  let sql = `SELECT * FROM vehicles WHERE id = $1 AND deleted_at IS NULL`;
  const params: any[] = [id];
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (company_id = $2 OR company_id IS NULL)`;
    params.push(companyId);
  }
  
  const vehicles = await query(sql, params);
  
  if (vehicles.length === 0) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  
  res.json({ data: vehicles[0] });
}));

// ==================== DRIVERS ====================

/**
 * @swagger
 * /api/v1/drivers:
 *   get:
 *     summary: List all drivers
 *     tags: [Drivers]
 */
router.get('/drivers', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  let sql = `
    SELECT s.*, 
      (SELECT COUNT(*) FROM routes WHERE driver1_id = s.id) as total_trips,
      (SELECT COALESCE(AVG(km_per_liter), 0) FROM fuel_records fr 
       JOIN vehicles v ON v.id = fr.vehicle_id 
       WHERE v.assigned_driver = s.id) as avg_fuel_efficiency
    FROM staff s
    WHERE s.role = 'Driver' AND s.deleted_at IS NULL
  `;
  const params: any[] = [];
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (s.company_id = $1 OR s.company_id IS NULL)`;
    params.push(companyId);
  }
  
  sql += ` ORDER BY s.staff_name`;
  
  const drivers = await query(sql, params);
  res.json({ data: drivers, count: drivers.length });
}));

/**
 * @swagger
 * /api/v1/drivers/{id}/performance:
 *   get:
 *     summary: Get driver performance metrics
 *     tags: [Drivers]
 */
router.get('/drivers/:id/performance', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const companyId = req.user?.companyId;
  
  // Get driver stats
  const [routes, fuel, accidents, behavior] = await Promise.all([
    query(`
      SELECT COUNT(*) as total, 
        COALESCE(SUM(actual_km), 0) as total_km,
        COALESCE(AVG(variance), 0) as avg_variance
      FROM routes WHERE driver1_id = $1
    `, [id]),
    query(`
      SELECT COALESCE(AVG(km_per_liter), 0) as efficiency
      FROM fuel_records fr
      JOIN vehicles v ON v.id = fr.vehicle_id
      WHERE v.assigned_driver = $1
    `, [id]),
    query(`SELECT COUNT(*) as count FROM accidents WHERE driver_id = $1`, [id]),
    query(`
      SELECT * FROM driver_behavior_scores 
      WHERE driver_id = $1 
      ORDER BY score_date DESC LIMIT 1
    `, [id])
  ]);
  
  res.json({
    data: {
      routes: routes[0],
      fuel_efficiency: fuel[0]?.efficiency || 0,
      accidents: parseInt(accidents[0]?.count || 0),
      behavior: behavior[0] || null
    }
  });
}));

// ==================== INVENTORY ====================

/**
 * @swagger
 * /api/v1/inventory:
 *   get:
 *     summary: List inventory items
 *     tags: [Inventory]
 */
router.get('/inventory', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  const { low_stock } = req.query;
  
  let sql = `
    SELECT i.*, c.name as category_name,
      CASE 
        WHEN i.reorder_level IS NOT NULL AND i.current_stock <= i.reorder_level 
        THEN true 
        ELSE false 
      END as is_low_stock
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON c.id = i.category_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (i.company_id = $${paramIndex} OR i.company_id IS NULL)`;
    params.push(companyId);
    paramIndex++;
  }
  
  if (low_stock === 'true') {
    sql += ` AND i.reorder_level IS NOT NULL AND i.current_stock <= i.reorder_level`;
  }
  
  sql += ` ORDER BY i.name`;
  
  const items = await query(sql, params);
  
  // Emit webhook for low stock if any found
  if (low_stock === 'true' && items.length > 0) {
    await emitWebhookEvent('inventory.low_stock', {
      company_id: companyId,
      items: items.map((i: any) => ({ id: i.id, name: i.name, stock: i.current_stock })),
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({ data: items, count: items.length });
}));

/**
 * @swagger
 * /api/v1/inventory/categories:
 *   get:
 *     summary: List inventory categories
 *     tags: [Inventory]
 */
router.get('/inventory/categories', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  let sql = `SELECT * FROM inventory_categories WHERE 1=1`;
  const params: any[] = [];
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (company_id = $1 OR company_id IS NULL)`;
    params.push(companyId);
  }
  
  sql += ` ORDER BY name`;
  
  const categories = await query(sql, params);
  res.json({ data: categories });
}));

// ==================== TRAINING COURSES ====================

/**
 * @swagger
 * /api/v1/courses:
 *   get:
 *     summary: List training courses
 *     tags: [Training]
 */
router.get('/courses', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  let sql = `SELECT * FROM training_courses WHERE 1=1`;
  const params: any[] = [];
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (company_id = $1 OR company_id IS NULL)`;
    params.push(companyId);
  }
  
  sql += ` ORDER BY mandatory DESC, course_name`;
  
  const courses = await query(sql, params);
  res.json({ data: courses, count: courses.length });
}));

/**
 * @swagger
 * /api/v1/courses/{id}/enrollments:
 *   get:
 *     summary: Get course enrollment statistics
 *     tags: [Training]
 */
router.get('/courses/:id/enrollments', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  
  const stats = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'passed' THEN 1 END) as passed,
      COUNT(CASE WHEN status = 'enrolled' THEN 1 END) as in_progress,
      COALESCE(AVG(quiz_score), 0) as avg_score
    FROM training_enrollments
    WHERE course_id = $1
  `, [id]);
  
  res.json({ data: stats[0] });
}));

// ==================== ALERTS ====================

/**
 * @swagger
 * /api/v1/alerts:
 *   get:
 *     summary: Get system alerts
 *     tags: [Alerts]
 */
router.get('/alerts', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  const { type, severity } = req.query;
  
  let sql = `SELECT * FROM risk_alerts WHERE 1=1`;
  const params: any[] = [];
  let paramIndex = 1;
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (company_id = $${paramIndex} OR company_id IS NULL)`;
    params.push(companyId);
    paramIndex++;
  }
  
  if (type) {
    sql += ` AND type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }
  
  if (severity) {
    sql += ` AND severity = $${paramIndex}`;
    params.push(severity);
    paramIndex++;
  }
  
  sql += ` AND (resolved_at IS NULL OR resolved_at > CURRENT_DATE - INTERVAL '7 days')`;
  sql += ` ORDER BY created_at DESC`;
  
  const alerts = await query(sql, params);
  res.json({ data: alerts, count: alerts.length });
}));

// ==================== INVOICES ====================

/**
 * @swagger
 * /api/v1/invoices:
 *   get:
 *     summary: List invoices
 *     tags: [Invoices]
 */
router.get('/invoices', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  const { status } = req.query;
  
  let sql = `
    SELECT i.*, c.name as customer_name
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;
  
  if (userRole !== 'admin' && companyId) {
    sql += ` AND (i.company_id = $${paramIndex} OR i.company_id IS NULL)`;
    params.push(companyId);
    paramIndex++;
  }
  
  if (status) {
    sql += ` AND i.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  
  sql += ` ORDER BY i.created_at DESC`;
  
  const invoices = await query(sql, params);
  res.json({ data: invoices, count: invoices.length });
}));

/**
 * @swagger
 * /api/v1/invoices/{id}:
 *   get:
 *     summary: Get invoice details
 *     tags: [Invoices]
 */
router.get('/invoices/:id', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  
  const [invoices, items] = await Promise.all([
    query(`SELECT * FROM invoices WHERE id = $1`, [id]),
    query(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [id])
  ]);
  
  if (invoices.length === 0) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  res.json({ 
    data: { 
      ...invoices[0], 
      items 
    } 
  });
}));

// ==================== MAINTENANCE ====================

/**
 * @swagger
 * /api/v1/maintenance:
 *   get:
 *     summary: Get maintenance schedule and alerts
 *     tags: [Maintenance]
 */
router.get('/maintenance', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  // Get overdue maintenance
  let overdueSql = `
    SELECT v.id, v.registration_num, v.next_service_due, v.current_mileage
    FROM vehicles v
    WHERE v.next_service_due <= CURRENT_DATE
    AND v.status = 'Active'
    AND v.deleted_at IS NULL
  `;
  const params: any[] = [];
  
  if (userRole !== 'admin' && companyId) {
    overdueSql += ` AND (v.company_id = $1 OR v.company_id IS NULL)`;
    params.push(companyId);
  }
  
  const overdue = await query(overdueSql, params);
  
  // Get upcoming maintenance (next 30 days)
  let upcomingSql = `
    SELECT v.id, v.registration_num, v.next_service_due, v.current_mileage
    FROM vehicles v
    WHERE v.next_service_due > CURRENT_DATE
    AND v.next_service_due <= CURRENT_DATE + INTERVAL '30 days'
    AND v.status = 'Active'
    AND v.deleted_at IS NULL
  `;
  
  if (userRole !== 'admin' && companyId) {
    upcomingSql += ` AND (v.company_id = $1 OR v.company_id IS NULL)`;
  }
  
  const upcoming = await query(upcomingSql, params);
  
  // Emit webhook if maintenance is overdue
  if (overdue.length > 0) {
    await emitWebhookEvent('maintenance.overdue', {
      company_id: companyId,
      vehicles: overdue.map((v: any) => ({ id: v.id, registration: v.registration_num })),
      count: overdue.length,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    data: {
      overdue: { count: overdue.length, vehicles: overdue },
      upcoming: { count: upcoming.length, vehicles: upcoming }
    }
  });
}));

// ==================== DASHBOARD SUMMARY ====================

/**
 * @swagger
 * /api/v1/dashboard:
 *   get:
 *     summary: Get dashboard summary
 *     tags: [Dashboard]
 */
router.get('/dashboard', asyncHandler(async (req: any, res: Response) => {
  const companyId = req.user?.companyId;
  const userRole = req.user?.role;
  
  const companyFilter = userRole !== 'admin' && companyId 
    ? 'AND (company_id = $1 OR company_id IS NULL)' 
    : '';
  const params = companyId && userRole !== 'admin' ? [companyId] : [];
  
  const [
    vehicles,
    drivers,
    pendingRepairs,
    lowStock,
    activeAlerts
  ] = await Promise.all([
    query(`SELECT COUNT(*) as count FROM vehicles WHERE deleted_at IS NULL ${companyFilter}`, params),
    query(`SELECT COUNT(*) as count FROM staff WHERE role = 'Driver' AND deleted_at IS NULL ${companyFilter}`, params),
    query(`SELECT COUNT(*) as count FROM repairs WHERE status IN ('Pending', 'In Progress') ${companyFilter}`, params),
    query(`SELECT COUNT(*) as count FROM inventory_items WHERE current_stock <= reorder_level ${companyFilter}`, params),
    query(`SELECT COUNT(*) as count FROM risk_alerts WHERE resolved_at IS NULL ${companyFilter}`, params)
  ]);
  
  res.json({
    data: {
      vehicles: parseInt(vehicles[0]?.count || 0),
      drivers: parseInt(drivers[0]?.count || 0),
      pendingRepairs: parseInt(pendingRepairs[0]?.count || 0),
      lowStockItems: parseInt(lowStock[0]?.count || 0),
      activeAlerts: parseInt(activeAlerts[0]?.count || 0)
    }
  });
}));

export default router;
