import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { query } from '../database';

const router = Router();

// Generate inspection number
function generateInspectionNumber(type: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const typePrefix = type.toUpperCase().replace('_', '');
  return `INS-${typePrefix}-${year}-${random}`;
}

// ============================================
// INSPECTION CATEGORIES
// ============================================

// Get all inspection categories
router.get('/categories', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT * FROM inspection_categories 
      WHERE is_active = TRUE 
      ORDER BY display_order
    `);
    res.json(result);
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ============================================
// INSPECTION ITEMS
// ============================================

// Get inspection items with optional filters
router.get('/items', authenticateToken, async (req: AuthRequest, res) => {
  const { category_id, inspection_type, is_critical } = req.query;
  
  try {
    let queryStr = `
      SELECT i.*, c.category_name, c.category_code
      FROM inspection_items i
      JOIN inspection_categories c ON i.category_id = c.id
      WHERE i.is_active = TRUE
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (category_id) {
      queryStr += ` AND i.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }
    
    if (inspection_type) {
      queryStr += ` AND $${paramIndex} = ANY(i.inspection_type)`;
      params.push(inspection_type);
      paramIndex++;
    }
    
    if (is_critical === 'true') {
      queryStr += ` AND i.is_critical = TRUE`;
    }
    
    queryStr += ` ORDER BY c.display_order, i.display_order`;
    
    const result = await query(queryStr, params);
    res.json(result);
  } catch (error: any) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to fetch inspection items' });
  }
});

// Get inspection checklist for a specific inspection type
router.get('/checklist/:type', authenticateToken, async (req: AuthRequest, res) => {
  const { type } = req.params;
  
  try {
    const result = await query(`
      SELECT i.*, c.category_name, c.category_code
      FROM inspection_items i
      JOIN inspection_categories c ON i.category_id = c.id
      WHERE i.is_active = TRUE
        AND $1 = ANY(i.inspection_type)
      ORDER BY c.display_order, i.display_order
    `, [type]);
    
    // Group by category
    const grouped = result.reduce((acc: any, item: any) => {
      const catCode = item.category_code;
      if (!acc[catCode]) {
        acc[catCode] = {
          category_name: item.category_name,
          category_code: catCode,
          items: []
        };
      }
      acc[catCode].items.push(item);
      return acc;
    }, {});
    
    res.json({
      inspection_type: type,
      total_items: result.length,
      categories: Object.values(grouped)
    });
  } catch (error: any) {
    console.error('Get checklist error:', error);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// ============================================
// VEHICLE INSPECTIONS
// ============================================

// Get all inspections with filtering
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  const { 
    vehicle_id, driver_id, inspection_type, status, 
    from_date, to_date, overall_result, page = '1', limit = '50' 
  } = req.query;
  
  try {
    let queryStr = `
      SELECT 
        i.*,
        v.registration_num, v.make_model, v.department,
        d.staff_name as driver_name,
        ins.staff_name as inspector_name,
        r.route_name, r.route_date,
        req.request_no, req.place_of_departure, req.destination
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      LEFT JOIN staff ins ON i.inspected_by = ins.id
      LEFT JOIN routes r ON i.route_id = r.id
      LEFT JOIN requisitions req ON i.requisition_id = req.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (vehicle_id) {
      queryStr += ` AND i.vehicle_id = $${paramIndex}`;
      params.push(vehicle_id);
      paramIndex++;
    }
    
    if (driver_id) {
      queryStr += ` AND i.driver_id = $${paramIndex}`;
      params.push(driver_id);
      paramIndex++;
    }
    
    if (inspection_type) {
      queryStr += ` AND i.inspection_type = $${paramIndex}`;
      params.push(inspection_type);
      paramIndex++;
    }
    
    if (status) {
      queryStr += ` AND i.inspection_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (overall_result) {
      queryStr += ` AND i.overall_result = $${paramIndex}`;
      params.push(overall_result);
      paramIndex++;
    }
    
    if (from_date) {
      queryStr += ` AND i.created_at >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }
    
    if (to_date) {
      queryStr += ` AND i.created_at <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }
    
    queryStr += ` ORDER BY i.created_at DESC`;
    
    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await query(queryStr, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM vehicle_inspections i 
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countIndex = 1;
    
    if (vehicle_id) {
      countQuery += ` AND i.vehicle_id = $${countIndex}`;
      countParams.push(vehicle_id);
      countIndex++;
    }
    if (driver_id) {
      countQuery += ` AND i.driver_id = $${countIndex}`;
      countParams.push(driver_id);
      countIndex++;
    }
    if (inspection_type) {
      countQuery += ` AND i.inspection_type = $${countIndex}`;
      countParams.push(inspection_type);
      countIndex++;
    }
    if (status) {
      countQuery += ` AND i.inspection_status = $${countIndex}`;
      countParams.push(status);
      countIndex++;
    }
    if (overall_result) {
      countQuery += ` AND i.overall_result = $${countIndex}`;
      countParams.push(overall_result);
      countIndex++;
    }
    
    const countResult = await query(countQuery, countParams);
    
    res.json({
      inspections: result,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult[0].total),
        pages: Math.ceil(parseInt(countResult[0].total) / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error('Get inspections error:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// Get single inspection with full details
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  
  try {
    // Get inspection header
    const inspection = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model, v.department, v.current_mileage,
        v.year_of_manufacture, v.ownership,
        d.staff_name as driver_name, d.phone as driver_phone, d.email as driver_email,
        d.license_number, d.license_expiry,
        ins.staff_name as inspector_name, ins.phone as inspector_phone,
        sup.staff_name as supervisor_name,
        r.route_name, r.route_date, r.target_km, r.actual_km,
        req.request_no, req.place_of_departure, req.destination, req.purpose,
        req.num_passengers, req.passenger_names,
        a.assignment_date, a.start_time, a.end_time
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      LEFT JOIN staff ins ON i.inspected_by = ins.id
      LEFT JOIN staff sup ON i.created_by = sup.id
      LEFT JOIN routes r ON i.route_id = r.id
      LEFT JOIN requisitions req ON i.requisition_id = req.id
      LEFT JOIN driver_assignments a ON i.assignment_id = a.id
      WHERE i.id = $1
    `, [id]);
    
    if (inspection.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    
    // Get inspection results
    const results = await query(`
      SELECT 
        ir.*,
        i.item_code, i.item_name, i.description, i.is_critical, i.requires_photo,
        c.category_name, c.category_code
      FROM inspection_results ir
      JOIN inspection_items i ON ir.item_id = i.id
      JOIN inspection_categories c ON i.category_id = c.id
      WHERE ir.inspection_id = $1
      ORDER BY c.display_order, i.display_order
    `, [id]);
    
    // Get defects
    const defects = await query(`
      SELECT 
        d.*,
        s.staff_name as resolved_by_name
      FROM inspection_defects d
      LEFT JOIN staff s ON d.resolved_by = s.id
      WHERE d.inspection_id = $1
      ORDER BY d.created_at DESC
    `, [id]);
    
    // Get photos
    const photos = await query(`
      SELECT * FROM inspection_photos
      WHERE inspection_id = $1
      ORDER BY taken_at DESC
    `, [id]);
    
    res.json({
      ...inspection[0],
      results,
      defects,
      photos
    });
  } catch (error: any) {
    console.error('Get inspection error:', error);
    res.status(500).json({ error: 'Failed to fetch inspection details' });
  }
});

// Create new inspection
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const {
    vehicle_id,
    driver_id,
    route_id,
    requisition_id,
    assignment_id,
    inspection_type,
    trip_purpose,
    estimated_distance_km,
    route_from,
    route_to,
    starting_odometer,
    scheduled_at,
    weather_condition,
    road_condition,
    temperature_celsius,
    notes
  } = req.body;
  
  // Validate required fields
  if (!vehicle_id || !inspection_type) {
    return res.status(400).json({ error: 'Vehicle ID and inspection type are required' });
  }
  
  try {
    const id = uuidv4();
    const inspectionNumber = generateInspectionNumber(inspection_type);
    
    await query(`
      INSERT INTO vehicle_inspections (
        id, inspection_number, vehicle_id, driver_id, route_id, requisition_id, assignment_id,
        inspection_type, inspection_status, trip_purpose, estimated_distance_km,
        route_from, route_to, starting_odometer, scheduled_at,
        weather_condition, road_condition, temperature_celsius, notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      id, inspectionNumber, vehicle_id, driver_id || null, route_id || null, 
      requisition_id || null, assignment_id || null,
      inspection_type, 'pending', trip_purpose || null, estimated_distance_km || null,
      route_from || null, route_to || null, starting_odometer || null, 
      scheduled_at || null, weather_condition || null, road_condition || null, 
      temperature_celsius || null, notes || null,
      req.user?.userId
    ]);
    
    // Fetch the created inspection
    const result = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.id = $1
    `, [id]);
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create inspection error:', error);
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

// Update inspection
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const allowedFields = [
    'driver_id', 'route_id', 'requisition_id', 'assignment_id',
    'trip_purpose', 'estimated_distance_km', 'route_from', 'route_to',
    'starting_odometer', 'ending_odometer', 'distance_traveled',
    'scheduled_at', 'started_at', 'completed_at',
    'weather_condition', 'road_condition', 'temperature_celsius',
    'overall_result', 'defects_summary', 'notes',
    'driver_signature', 'inspector_signature', 'supervisor_signature', 'signed_at'
  ];
  
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    fields.push(`updated_by = $${paramIndex}`);
    values.push(req.user?.userId);
    values.push(id);
    
    await query(`
      UPDATE vehicle_inspections 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex + 1}
    `, values);
    
    const result = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.id = $1
    `, [id]);
    
    res.json(result[0]);
  } catch (error: any) {
    console.error('Update inspection error:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// Start inspection
router.post('/:id/start', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { inspected_by } = req.body;
  
  try {
    await query(`
      UPDATE vehicle_inspections 
      SET inspection_status = 'in_progress',
          started_at = CURRENT_TIMESTAMP,
          inspected_by = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND inspection_status = 'pending'
    `, [inspected_by || req.user?.userId, id]);
    
    const result = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.id = $1
    `, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    
    res.json(result[0]);
  } catch (error: any) {
    console.error('Start inspection error:', error);
    res.status(500).json({ error: 'Failed to start inspection' });
  }
});

// Complete inspection
router.post('/:id/complete', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { 
    overall_result, 
    ending_odometer, 
    defects_summary, 
    next_inspection_due,
    notes 
  } = req.body;
  
  try {
    // Calculate distance traveled
    const inspection = await query('SELECT starting_odometer FROM vehicle_inspections WHERE id = $1', [id]);
    const distance = ending_odometer && inspection[0]?.starting_odometer 
      ? ending_odometer - inspection[0].starting_odometer 
      : null;
    
    await query(`
      UPDATE vehicle_inspections 
      SET inspection_status = 'completed',
          overall_result = $1,
          ending_odometer = $2,
          distance_traveled = $3,
          defects_summary = $4,
          next_inspection_due = $5,
          completed_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes, '') || CASE WHEN $6 IS NOT NULL THEN '\n' || $6 ELSE '' END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
    `, [overall_result, ending_odometer, distance, defects_summary, next_inspection_due, notes, id]);
    
    // Update vehicle mileage if ending odometer provided
    if (ending_odometer) {
      await query(`
        UPDATE vehicles 
        SET current_mileage = GREATEST(current_mileage, $1),
            updated_at = CURRENT_TIMESTAMP
        FROM vehicle_inspections vi
        WHERE vehicles.id = vi.vehicle_id AND vi.id = $2
      `, [ending_odometer, id]);
    }
    
    const result = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.id = $1
    `, [id]);
    
    res.json(result[0]);
  } catch (error: any) {
    console.error('Complete inspection error:', error);
    res.status(500).json({ error: 'Failed to complete inspection' });
  }
});

// Delete inspection (soft delete)
router.delete('/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  
  try {
    await query('DELETE FROM vehicle_inspections WHERE id = $1', [id]);
    res.json({ message: 'Inspection deleted successfully' });
  } catch (error: any) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ error: 'Failed to delete inspection' });
  }
});

// ============================================
// INSPECTION RESULTS
// ============================================

// Add inspection result
router.post('/:id/results', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { 
    item_id, 
    result_status, 
    severity, 
    notes, 
    measured_value, 
    expected_value,
    photo_urls 
  } = req.body;
  
  try {
    const resultId = uuidv4();
    
    await query(`
      INSERT INTO inspection_results (
        id, inspection_id, item_id, result_status, severity,
        notes, measured_value, expected_value, photo_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      resultId, id, item_id, result_status, severity || null,
      notes || null, measured_value || null, expected_value || null,
      photo_urls ? JSON.stringify(photo_urls) : null
    ]);
    
    // Update inspection defect count
    if (result_status === 'fail') {
      await query(`
        UPDATE vehicle_inspections 
        SET total_defects_found = total_defects_found + 1,
            critical_defects_found = CASE WHEN $1 = 'critical' THEN TRUE ELSE critical_defects_found END
        WHERE id = $2
      `, [severity, id]);
    }
    
    const result = await query('SELECT * FROM inspection_results WHERE id = $1', [resultId]);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Add result error:', error);
    res.status(500).json({ error: 'Failed to add inspection result' });
  }
});

// Batch add inspection results
router.post('/:id/results/batch', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { results } = req.body;
  
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'Results array is required' });
  }
  
  try {
    let totalDefects = 0;
    let hasCritical = false;
    
    for (const result of results) {
      const resultId = uuidv4();
      
      await query(`
        INSERT INTO inspection_results (
          id, inspection_id, item_id, result_status, severity,
          notes, measured_value, expected_value, photo_urls
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (inspection_id, item_id) DO UPDATE SET
          result_status = EXCLUDED.result_status,
          severity = EXCLUDED.severity,
          notes = EXCLUDED.notes,
          measured_value = EXCLUDED.measured_value,
          expected_value = EXCLUDED.expected_value,
          photo_urls = EXCLUDED.photo_urls
      `, [
        resultId, id, result.item_id, result.result_status, result.severity || null,
        result.notes || null, result.measured_value || null, result.expected_value || null,
        result.photo_urls ? JSON.stringify(result.photo_urls) : null
      ]);
      
      if (result.result_status === 'fail') {
        totalDefects++;
        if (result.severity === 'critical') hasCritical = true;
      }
    }
    
    // Update inspection totals
    await query(`
      UPDATE vehicle_inspections 
      SET total_defects_found = $1,
          critical_defects_found = $2
      WHERE id = $3
    `, [totalDefects, hasCritical, id]);
    
    res.json({ 
      message: 'Results saved successfully',
      total_results: results.length,
      defects_found: totalDefects,
      has_critical: hasCritical
    });
  } catch (error: any) {
    console.error('Batch add results error:', error);
    res.status(500).json({ error: 'Failed to save inspection results' });
  }
});

// ============================================
// INSPECTION DEFECTS
// ============================================

// Add defect
router.post('/:id/defects', authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    result_id,
    defect_description,
    defect_category,
    severity,
    component_area,
    position_on_vehicle,
    photo_urls
  } = req.body;
  
  try {
    const defectId = uuidv4();
    
    await query(`
      INSERT INTO inspection_defects (
        id, inspection_id, result_id, defect_description, defect_category,
        severity, component_area, position_on_vehicle, photo_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      defectId, id, result_id || null, defect_description, defect_category || null,
      severity, component_area || null, position_on_vehicle || null,
      photo_urls ? JSON.stringify(photo_urls) : null
    ]);
    
    const result = await query('SELECT * FROM inspection_defects WHERE id = $1', [defectId]);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Add defect error:', error);
    res.status(500).json({ error: 'Failed to add defect' });
  }
});

// Update defect status
router.put('/defects/:defectId', authenticateToken, async (req: AuthRequest, res) => {
  const { defectId } = req.params;
  const { status, resolution_notes } = req.body;
  
  try {
    await query(`
      UPDATE inspection_defects 
      SET status = $1,
          resolution_notes = COALESCE(resolution_notes, '') || CASE WHEN $2 IS NOT NULL THEN '\n' || $2 ELSE '' END,
          resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
          resolved_by = CASE WHEN $1 = 'resolved' THEN $3 ELSE resolved_by END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [status, resolution_notes, req.user?.userId, defectId]);
    
    const result = await query(`
      SELECT d.*, s.staff_name as resolved_by_name
      FROM inspection_defects d
      LEFT JOIN staff s ON d.resolved_by = s.id
      WHERE d.id = $1
    `, [defectId]);
    
    res.json(result[0]);
  } catch (error: any) {
    console.error('Update defect error:', error);
    res.status(500).json({ error: 'Failed to update defect' });
  }
});

// ============================================
// INSPECTION DASHBOARD & STATS
// ============================================

// Get inspection dashboard stats
router.get('/dashboard/stats', authenticateToken, async (req: AuthRequest, res) => {
  const { period = '30' } = req.query;
  
  try {
    const days = parseInt(period as string);
    
    // Overall stats
    const stats = await query(`
      SELECT 
        COUNT(*) as total_inspections,
        COUNT(CASE WHEN overall_result = 'pass' THEN 1 END) as passed,
        COUNT(CASE WHEN overall_result = 'fail' THEN 1 END) as failed,
        COUNT(CASE WHEN overall_result = 'conditional' THEN 1 END) as conditional,
        COUNT(CASE WHEN critical_defects_found = TRUE THEN 1 END) as with_critical_defects,
        AVG(CASE WHEN overall_result IS NOT NULL THEN total_defects_found END) as avg_defects,
        COUNT(CASE WHEN inspection_type = 'pre_trip' THEN 1 END) as pre_trip_count,
        COUNT(CASE WHEN inspection_type = 'post_trip' THEN 1 END) as post_trip_count,
        COUNT(CASE WHEN inspection_type = 'periodic' THEN 1 END) as periodic_count
      FROM vehicle_inspections
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `);
    
    // Defects by category
    const defectsByCategory = await query(`
      SELECT 
        c.category_name,
        c.category_code,
        COUNT(*) as defect_count
      FROM inspection_defects d
      JOIN vehicle_inspections i ON d.inspection_id = i.id
      JOIN inspection_results ir ON d.result_id = ir.id
      JOIN inspection_items it ON ir.item_id = it.id
      JOIN inspection_categories c ON it.category_id = c.id
      WHERE i.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY c.category_name, c.category_code
      ORDER BY defect_count DESC
    `);
    
    // Inspections by vehicle (top 10)
    const byVehicle = await query(`
      SELECT 
        v.registration_num,
        v.make_model,
        COUNT(*) as inspection_count,
        COUNT(CASE WHEN i.overall_result = 'fail' THEN 1 END) as failures
      FROM vehicle_inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY v.id, v.registration_num, v.make_model
      ORDER BY inspection_count DESC
      LIMIT 10
    `);
    
    // Pending inspections (scheduled)
    const pending = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.inspection_status IN ('pending', 'in_progress')
      ORDER BY i.scheduled_at ASC NULLS LAST
      LIMIT 20
    `);
    
    // Overdue inspections
    const overdue = await query(`
      SELECT 
        v.id as vehicle_id,
        v.registration_num,
        v.make_model,
        v.current_mileage,
        s.next_date as scheduled_inspection_date,
        s.next_mileage_threshold,
        s.schedule_type
      FROM inspection_schedules s
      JOIN vehicles v ON s.vehicle_id = v.id
      WHERE s.is_active = TRUE
        AND (
          (s.next_date IS NOT NULL AND s.next_date < CURRENT_DATE)
          OR (s.next_mileage_threshold IS NOT NULL AND v.current_mileage >= s.next_mileage_threshold)
        )
      ORDER BY s.next_date ASC
      LIMIT 20
    `);
    
    res.json({
      period: days,
      summary: stats[0],
      defects_by_category: defectsByCategory,
      by_vehicle: byVehicle,
      pending_inspections: pending,
      overdue_inspections: overdue
    });
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get vehicle inspection history
router.get('/vehicle/:vehicleId/history', authenticateToken, async (req: AuthRequest, res) => {
  const { vehicleId } = req.params;
  const { limit = '10' } = req.query;
  
  try {
    const history = await query(`
      SELECT 
        i.*,
        d.staff_name as driver_name,
        ins.staff_name as inspector_name
      FROM vehicle_inspections i
      LEFT JOIN staff d ON i.driver_id = d.id
      LEFT JOIN staff ins ON i.inspected_by = ins.id
      WHERE i.vehicle_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2
    `, [vehicleId, limit]);
    
    // Get inspection trends
    const trends = await query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as inspection_count,
        COUNT(CASE WHEN overall_result = 'pass' THEN 1 END) as passes,
        COUNT(CASE WHEN overall_result = 'fail' THEN 1 END) as failures,
        AVG(total_defects_found) as avg_defects
      FROM vehicle_inspections
      WHERE vehicle_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `, [vehicleId]);
    
    // Get common defects for this vehicle
    const commonDefects = await query(`
      SELECT 
        d.defect_category,
        COUNT(*) as occurrence_count,
        MAX(d.created_at) as last_occurrence
      FROM inspection_defects d
      JOIN vehicle_inspections i ON d.inspection_id = i.id
      WHERE i.vehicle_id = $1
      GROUP BY d.defect_category
      ORDER BY occurrence_count DESC
      LIMIT 5
    `, [vehicleId]);
    
    res.json({
      history,
      trends,
      common_defects: commonDefects,
      total_inspections: history.length
    });
  } catch (error: any) {
    console.error('Get vehicle history error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle inspection history' });
  }
});

// ============================================
// INTEGRATION WITH OTHER MODULES
// ============================================

// Create inspection from requisition/trip
router.post('/from-requisition/:requisitionId', authenticateToken, async (req: AuthRequest, res) => {
  const { requisitionId } = req.params;
  const { inspection_type = 'pre_trip' } = req.body;
  
  try {
    // Get requisition details
    const requisition = await query(`
      SELECT 
        r.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM requisitions r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = $1
    `, [requisitionId]);
    
    if (requisition.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    const reqData = requisition[0];
    
    // Create inspection
    const id = uuidv4();
    const inspectionNumber = generateInspectionNumber(inspection_type);
    
    await query(`
      INSERT INTO vehicle_inspections (
        id, inspection_number, vehicle_id, driver_id, requisition_id,
        inspection_type, inspection_status, trip_purpose,
        route_from, route_to, starting_odometer, notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      id, inspectionNumber, reqData.vehicle_id, reqData.driver_id, requisitionId,
      inspection_type, 'pending', reqData.purpose,
      reqData.place_of_departure, reqData.destination, 
      reqData.starting_odometer || null,
      `Created from requisition ${reqData.request_no}`,
      req.user?.userId
    ]);
    
    // Update requisition with inspection reference
    await query(`
      UPDATE requisitions 
      SET inspection_id = $1,
          inspection_status = 'pending'
      WHERE id = $2
    `, [id, requisitionId]);
    
    const result = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.id = $1
    `, [id]);
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create from requisition error:', error);
    res.status(500).json({ error: 'Failed to create inspection from requisition' });
  }
});

// Create inspection from route
router.post('/from-route/:routeId', authenticateToken, async (req: AuthRequest, res) => {
  const { routeId } = req.params;
  const { inspection_type = 'post_trip' } = req.body;
  
  try {
    // Get route details
    const route = await query(`
      SELECT 
        r.*,
        v.registration_num, v.make_model,
        d1.staff_name as driver1_name,
        d2.staff_name as driver2_name
      FROM routes r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d1 ON r.driver1_id = d1.id
      LEFT JOIN staff d2 ON r.driver2_id = d2.id
      WHERE r.id = $1
    `, [routeId]);
    
    if (route.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    const routeData = route[0];
    
    // Create inspection
    const id = uuidv4();
    const inspectionNumber = generateInspectionNumber(inspection_type);
    
    await query(`
      INSERT INTO vehicle_inspections (
        id, inspection_number, vehicle_id, driver_id, route_id,
        inspection_type, inspection_status, route_from, route_to,
        starting_odometer, ending_odometer, distance_traveled,
        estimated_distance_km, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      id, inspectionNumber, routeData.vehicle_id, routeData.driver1_id, routeId,
      inspection_type, 'pending', routeData.route_from, routeData.route_to,
      routeData.start_mileage || null, routeData.end_mileage || null,
      routeData.actual_km || null, routeData.target_km || null,
      `Created from route ${routeData.route_name || routeId}`,
      req.user?.userId
    ]);
    
    const result = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN staff d ON i.driver_id = d.id
      WHERE i.id = $1
    `, [id]);
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create from route error:', error);
    res.status(500).json({ error: 'Failed to create inspection from route' });
  }
});

// Get inspections pending for a driver
router.get('/my-pending/:driverId', authenticateToken, async (req: AuthRequest, res) => {
  const { driverId } = req.params;
  
  try {
    const inspections = await query(`
      SELECT 
        i.*,
        v.registration_num, v.make_model,
        r.route_name, r.route_date,
        req.request_no, req.place_of_departure, req.destination,
        req.travel_date, req.travel_time
      FROM vehicle_inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN routes r ON i.route_id = r.id
      LEFT JOIN requisitions req ON i.requisition_id = req.id
      WHERE i.driver_id = $1
        AND i.inspection_status IN ('pending', 'in_progress')
      ORDER BY i.scheduled_at ASC NULLS LAST, i.created_at DESC
    `, [driverId]);
    
    res.json(inspections);
  } catch (error: any) {
    console.error('Get pending inspections error:', error);
    res.status(500).json({ error: 'Failed to fetch pending inspections' });
  }
});

export default router;
