import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all repairs
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, v.registration_num, s.staff_name as driver_name
      FROM repairs r
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      LEFT JOIN staff s ON s.id = r.driver_id
      ORDER BY r.date_in DESC
    `);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repairs' });
  }
});

// Get defective vehicles (from failed inspections)
router.get('/defective-vehicles', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        v.id,
        v.registration_num,
        v.make_model,
        v.defect_notes,
        v.defect_reported_at,
        s.staff_name as reported_by_name,
        jc.id as job_card_id,
        jc.job_card_number,
        jc.status as job_card_status
      FROM vehicles v
      LEFT JOIN job_cards jc ON jc.vehicle_id = v.id AND jc.status IN ('Pending', 'In Progress')
      LEFT JOIN staff s ON s.id = jc.reported_by
      WHERE v.status = 'Defective'
      ORDER BY v.defect_reported_at DESC
    `);
    res.json(result);
  } catch (error: any) {
    console.error('Get defective vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch defective vehicles' });
  }
});

// Create repair record
router.post('/', async (req, res) => {
  const {
    date_in, vehicle_id, preventative_maintenance, breakdown_description,
    odometer_reading, driver_id, assigned_technician, repairs_start_time,
    target_repair_hours, garage_name, cost
  } = req.body;

  try {
    const id = uuidv4();
    await query(`
      INSERT INTO repairs (
        id, date_in, vehicle_id, preventative_maintenance, breakdown_description,
        odometer_reading, driver_id, assigned_technician, repairs_start_time,
        target_repair_hours, garage_name, cost, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'In Progress')
    `, [
      id, date_in, vehicle_id, preventative_maintenance, breakdown_description,
      odometer_reading, driver_id, assigned_technician, repairs_start_time,
      target_repair_hours, garage_name, cost
    ]);

    // Update vehicle status
    await query(`
      UPDATE vehicles SET status = 'Under Maintenance', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [vehicle_id]);

    const result = await query('SELECT * FROM repairs WHERE id = $1', [id]);
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create repair record' });
  }
});

// Complete repair
router.put('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { date_out, repairs_end_time, actual_repair_hours } = req.body;

  try {
    // Get target hours and vehicle_id
    const repairData = await query('SELECT target_repair_hours, vehicle_id FROM repairs WHERE id = $1', [id]);
    const target = repairData[0]?.target_repair_hours;
    const vehicleId = repairData[0]?.vehicle_id;
    
    // Calculate productivity
    const productivity = target && actual_repair_hours > 0 ? (target / actual_repair_hours).toFixed(2) : null;

    await query(`
      UPDATE repairs 
      SET date_out = $1, repairs_end_time = $2, actual_repair_hours = $3,
          productivity_ratio = $4, status = 'Completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [date_out, repairs_end_time, actual_repair_hours, productivity, id]);

    // Update vehicle status back to Active and clear defects
    await query(`
      UPDATE vehicles 
      SET status = 'Active', 
          defect_notes = NULL, 
          defect_reported_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [vehicleId]);

    const result = await query('SELECT * FROM repairs WHERE id = $1', [id]);
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete repair' });
  }
});

// ========== JOB CARDS ==========

// Get all job cards
router.get('/job-cards', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        jc.*,
        v.registration_num,
        v.make_model,
        r.staff_name as reported_by_name,
        a.staff_name as approved_by_name,
        t.staff_name as technician_name
      FROM job_cards jc
      LEFT JOIN vehicles v ON v.id = jc.vehicle_id
      LEFT JOIN staff r ON r.id = jc.reported_by
      LEFT JOIN staff a ON a.id = jc.approved_by
      LEFT JOIN staff t ON t.id = jc.assigned_technician
      ORDER BY jc.created_at DESC
    `);
    res.json(result);
  } catch (error: any) {
    console.error('Get job cards error:', error);
    res.status(500).json({ error: 'Failed to fetch job cards' });
  }
});

// Get single job card
router.get('/job-cards/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await query(`
      SELECT 
        jc.*,
        v.registration_num,
        v.make_model,
        v.current_mileage,
        r.staff_name as reported_by_name,
        a.staff_name as approved_by_name,
        t.staff_name as technician_name
      FROM job_cards jc
      LEFT JOIN vehicles v ON v.id = jc.vehicle_id
      LEFT JOIN staff r ON r.id = jc.reported_by
      LEFT JOIN staff a ON a.id = jc.approved_by
      LEFT JOIN staff t ON t.id = jc.assigned_technician
      WHERE jc.id = $1
    `, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }
    
    res.json(result[0]);
  } catch (error: any) {
    console.error('Get job card error:', error);
    res.status(500).json({ error: 'Failed to fetch job card' });
  }
});

// Create job card from defect
router.post('/job-cards', async (req: any, res) => {
  const {
    vehicle_id,
    defect_description,
    repair_type,
    service_provider,
    priority = 'Medium',
    estimated_cost
  } = req.body;
  
  const reported_by = req.user?.staffId;

  if (!vehicle_id || !defect_description) {
    return res.status(400).json({ error: 'Vehicle and defect description are required' });
  }

  try {
    // Generate unique job card number
    const year = new Date().getFullYear();
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const jobCardNumber = `JB-${randomCode}-${year}`;
    
    const id = uuidv4();
    await query(`
      INSERT INTO job_cards (
        id, job_card_number, vehicle_id, defect_description, repair_type,
        service_provider, priority, estimated_cost, reported_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')
    `, [
      id, jobCardNumber, vehicle_id, defect_description, repair_type,
      service_provider, priority, estimated_cost, reported_by
    ]);

    // Update vehicle status to Defective if not already
    await query(`
      UPDATE vehicles 
      SET status = 'Defective', 
          defect_notes = $1,
          defect_reported_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [defect_description, vehicle_id]);

    const result = await query(`
      SELECT jc.*, v.registration_num, r.staff_name as reported_by_name
      FROM job_cards jc
      LEFT JOIN vehicles v ON v.id = jc.vehicle_id
      LEFT JOIN staff r ON r.id = jc.reported_by
      WHERE jc.id = $1
    `, [id]);
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create job card error:', error);
    res.status(500).json({ error: 'Failed to create job card: ' + error.message });
  }
});

// Approve job card (manager)
router.post('/job-cards/:id/approve', async (req: any, res) => {
  const { id } = req.params;
  const approved_by = req.user?.staffId;
  const userRole = req.user?.role;
  
  // Only managers can approve
  if (!['admin', 'manager', 'transport_supervisor'].includes(userRole)) {
    return res.status(403).json({ error: 'Only managers can approve job cards' });
  }

  try {
    await query(`
      UPDATE job_cards 
      SET status = 'Approved', 
          approved_by = $1, 
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [approved_by, id]);

    const result = await query(`
      SELECT jc.*, v.registration_num, r.staff_name as reported_by_name, a.staff_name as approved_by_name
      FROM job_cards jc
      LEFT JOIN vehicles v ON v.id = jc.vehicle_id
      LEFT JOIN staff r ON r.id = jc.reported_by
      LEFT JOIN staff a ON a.id = jc.approved_by
      WHERE jc.id = $1
    `, [id]);
    
    res.json({ message: 'Job card approved', job_card: result[0] });
  } catch (error: any) {
    console.error('Approve job card error:', error);
    res.status(500).json({ error: 'Failed to approve job card' });
  }
});

// Assign technician and start work
router.post('/job-cards/:id/assign', async (req: any, res) => {
  const { id } = req.params;
  const { assigned_technician, target_hours } = req.body;

  try {
    await query(`
      UPDATE job_cards 
      SET assigned_technician = $1,
          target_hours = $2,
          status = 'In Progress',
          started_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [assigned_technician, target_hours, id]);

    res.json({ message: 'Technician assigned' });
  } catch (error: any) {
    console.error('Assign technician error:', error);
    res.status(500).json({ error: 'Failed to assign technician' });
  }
});

// Complete job card
router.post('/job-cards/:id/complete', async (req: any, res) => {
  const { id } = req.params;
  const { actual_hours, actual_cost, repair_notes } = req.body;

  try {
    const jobCardResult = await query('SELECT * FROM job_cards WHERE id = $1', [id]);
    if (jobCardResult.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }
    
    const jobCard = jobCardResult[0];

    await query(`
      UPDATE job_cards 
      SET actual_hours = $1,
          actual_cost = $2,
          repair_notes = $3,
          status = 'Completed',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [actual_hours, actual_cost, repair_notes, id]);

    // Update vehicle status back to Active
    await query(`
      UPDATE vehicles 
      SET status = 'Active', 
          defect_notes = NULL, 
          defect_reported_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [jobCard.vehicle_id]);

    res.json({ message: 'Job card completed' });
  } catch (error: any) {
    console.error('Complete job card error:', error);
    res.status(500).json({ error: 'Failed to complete job card' });
  }
});

// Cancel job card
router.post('/job-cards/:id/cancel', async (req: any, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  try {
    const jobCardResult = await query('SELECT * FROM job_cards WHERE id = $1', [id]);
    if (jobCardResult.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }
    
    const jobCard = jobCardResult[0];

    await query(`
      UPDATE job_cards 
      SET status = 'Cancelled',
          cancellation_reason = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [cancellation_reason, id]);

    // Update vehicle status - check if there are other pending job cards
    const otherPending = await query(`
      SELECT COUNT(*) as count FROM job_cards 
      WHERE vehicle_id = $1 AND status IN ('Pending', 'In Progress') AND id != $2
    `, [jobCard.vehicle_id, id]);
    
    if (parseInt(otherPending[0]?.count || 0) === 0) {
      await query(`
        UPDATE vehicles 
        SET status = 'Active', 
            defect_notes = NULL, 
            defect_reported_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [jobCard.vehicle_id]);
    }

    res.json({ message: 'Job card cancelled' });
  } catch (error: any) {
    console.error('Cancel job card error:', error);
    res.status(500).json({ error: 'Failed to cancel job card' });
  }
});

// Convert job card to repair record
router.post('/job-cards/:id/convert-to-repair', async (req: any, res) => {
  const { id } = req.params;

  try {
    const jobCardResult = await query(`
      SELECT jc.*, v.registration_num
      FROM job_cards jc
      LEFT JOIN vehicles v ON v.id = jc.vehicle_id
      WHERE jc.id = $1
    `, [id]);
    
    if (jobCardResult.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }
    
    const jobCard = jobCardResult[0];

    // Create repair record from job card
    const repairId = uuidv4();
    await query(`
      INSERT INTO repairs (
        id, date_in, vehicle_id, breakdown_description,
        assigned_technician, target_repair_hours, garage_name, cost, status
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, 'In Progress')
    `, [
      repairId, 
      jobCard.vehicle_id, 
      jobCard.defect_description,
      jobCard.assigned_technician,
      jobCard.target_hours,
      jobCard.service_provider,
      jobCard.estimated_cost
    ]);

    // Update job card status
    await query(`
      UPDATE job_cards 
      SET status = 'Converted',
          converted_to_repair_id = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [repairId, id]);

    // Update vehicle status
    await query(`
      UPDATE vehicles 
      SET status = 'Under Maintenance', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [jobCard.vehicle_id]);

    res.json({ 
      message: 'Job card converted to repair record', 
      repair_id: repairId 
    });
  } catch (error: any) {
    console.error('Convert job card error:', error);
    res.status(500).json({ error: 'Failed to convert job card' });
  }
});

export default router;