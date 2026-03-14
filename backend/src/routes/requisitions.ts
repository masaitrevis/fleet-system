import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import emailService from '../services/email';
import smsService from '../services/sms';

const router = Router();

// Create requisition request
router.post('/', async (req, res) => {
  const {
    requested_by,
    place_of_departure,
    destination,
    purpose,
    travel_date,
    travel_time,
    return_date,
    return_time,
    num_passengers,
    passenger_names
  } = req.body;

  // Validation
  if (!requested_by || !place_of_departure || !destination || !purpose || !travel_date || !travel_time) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      fields: { requested_by, place_of_departure, destination, purpose, travel_date, travel_time }
    });
  }

  try {
    // Check if staff has email
    const staffCheck = await query('SELECT staff_name, email, department FROM staff WHERE id = ?', [requested_by]);
    if (!staffCheck || staffCheck.length === 0) {
      return res.status(400).json({ error: 'Staff not found' });
    }

    const staff = staffCheck[0];
    if (!staff.email) {
      return res.status(400).json({ 
        error: 'Staff has no email address',
        staff_name: staff.staff_name,
        message: 'Please add email in Staff section first'
      });
    }

    // Generate request number
    const date = new Date();
    const requestNo = `REQ-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const id = uuidv4();
    
    await query(`
      INSERT INTO requisitions (
        id, request_no, requested_by, place_of_departure, destination, purpose,
        travel_date, travel_time, return_date, return_time, num_passengers, passenger_names,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `, [
      id, requestNo, requested_by, place_of_departure, destination, purpose,
      travel_date, travel_time, return_date || null, return_time || null,
      num_passengers || 1, passenger_names || ''
    ]);

    // Get the created requisition
    const result = await query('SELECT * FROM requisitions WHERE id = ?', [id]);
    
    // Send notifications
    await emailService.sendRequisitionRequest(staff.staff_name, req.body);
    await smsService.sendRequisitionSMS(staff.staff_name, place_of_departure, destination);

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

// Get my requisitions
router.get('/my-requests', async (req: any, res) => {
  const userId = req.user?.id;
  
  try {
    const result = await query(`
      SELECT r.*, s.staff_name, s.email, s.department
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      WHERE r.requested_by = ?
      ORDER BY r.created_at DESC
    `, [userId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get all requisitions (for managers)
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, s.staff_name, s.email, s.department
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      ORDER BY r.created_at DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get requisitions error:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

// Get pending approvals (for departmental approvers)
router.get('/pending-approvals', async (req: any, res) => {
  const userDept = req.user?.department;
  
  try {
    const result = await query(`
      SELECT r.*, s.staff_name, s.email, s.department
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      WHERE r.status = 'pending' AND s.department = ?
      ORDER BY r.created_at DESC
    `, [userDept]);
    
    res.json(result);
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// Approve/Reject requisition
router.post('/:id/approve', async (req: any, res) => {
  const { id } = req.params;
  const { status, reason } = req.body; // status: 'approved' or 'rejected'
  const approverId = req.user?.id;

  try {
    await query(`
      UPDATE requisitions 
      SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_reason = ?
      WHERE id = ?
    `, [status, approverId, reason || '', id]);

    // Get requisition details for notification
    const result = await query(`
      SELECT r.*, s.staff_name 
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      WHERE r.id = ?
    `, [id]);

    if (result.length > 0) {
      await emailService.sendApprovalNotification(result[0].staff_name, status, reason);
      await smsService.sendApprovalSMS(status);
    }

    res.json({ message: `Requisition ${status}`, requisition: result[0] });
  } catch (error) {
    console.error('Approve requisition error:', error);
    res.status(500).json({ error: 'Failed to update requisition' });
  }
});

// Allocate vehicle and driver (Transport Supervisor)
router.post('/:id/allocate', async (req: any, res) => {
  const { id } = req.params;
  const { vehicle_id, driver_id } = req.body;
  const allocatedBy = req.user?.id;

  try {
    await query(`
      UPDATE requisitions 
      SET vehicle_id = ?, driver_id = ?, allocated_by = ?, allocated_at = CURRENT_TIMESTAMP, status = 'allocated'
      WHERE id = ?
    `, [vehicle_id, driver_id, allocatedBy, id]);

    // Get details for notification
    const result = await query(`
      SELECT r.*, s.staff_name, v.registration_num, d.staff_name as driver_name
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = ?
    `, [id]);

    if (result.length > 0) {
      await emailService.sendVehicleAllocated(
        result[0].staff_name, 
        result[0].registration_num,
        result[0].driver_name
      );
      await smsService.sendVehicleAllocatedSMS(result[0].registration_num, result[0].driver_name);
    }

    res.json({ message: 'Vehicle allocated', requisition: result[0] });
  } catch (error) {
    console.error('Allocate vehicle error:', error);
    res.status(500).json({ error: 'Failed to allocate vehicle' });
  }
});

// Submit driver inspection
router.post('/:id/inspection', async (req: any, res) => {
  const { id } = req.params;
  const { 
    tires_ok, brakes_ok, lights_ok, oil_ok, coolant_ok,
    battery_ok, wipers_ok, mirrors_ok, seatbelts_ok, fuel_ok,
    defects_found, defect_photos, passed
  } = req.body;

  try {
    await query(`
      UPDATE requisitions 
      SET 
        inspection_tires = ?, inspection_brakes = ?, inspection_lights = ?,
        inspection_oil = ?, inspection_coolant = ?, inspection_battery = ?,
        inspection_wipers = ?, inspection_mirrors = ?, inspection_seatbelts = ?,
        inspection_fuel = ?, defects_found = ?, defect_photos = ?,
        inspection_passed = ?, inspection_completed_at = CURRENT_TIMESTAMP,
        status = ?
      WHERE id = ?
    `, [
      tires_ok, brakes_ok, lights_ok, oil_ok, coolant_ok,
      battery_ok, wipers_ok, mirrors_ok, seatbelts_ok, fuel_ok,
      defects_found || '', JSON.stringify(defect_photos || []),
      passed, passed ? 'ready_for_departure' : 'inspection_failed',
      id
    ]);

    // Get details for notification
    const result = await query(`
      SELECT r.*, v.registration_num, d.staff_name as driver_name
      FROM requisitions r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = ?
    `, [id]);

    if (result.length > 0) {
      await emailService.sendInspectionNotification(
        result[0].registration_num,
        result[0].driver_name,
        passed
      );
      await smsService.sendInspectionSMS(result[0].registration_num, passed);
    }

    res.json({ message: 'Inspection submitted', passed, requisition: result[0] });
  } catch (error) {
    console.error('Inspection error:', error);
    res.status(500).json({ error: 'Failed to submit inspection' });
  }
});

// Close trip (Supervisor)
router.post('/:id/close', async (req: any, res) => {
  const { id } = req.params;
  const { ending_odometer } = req.body;
  const closedBy = req.user?.id;

  try {
    // Get starting odometer
    const reqData = await query('SELECT * FROM requisitions WHERE id = ?', [id]);
    if (reqData.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const distance = ending_odometer - (reqData[0].starting_odometer || 0);

    await query(`
      UPDATE requisitions 
      SET 
        ending_odometer = ?, 
        distance_km = ?,
        closed_by = ?,
        closed_at = CURRENT_TIMESTAMP,
        status = 'completed'
      WHERE id = ?
    `, [ending_odometer, distance, closedBy, id]);

    // Get details for notification
    const result = await query(`
      SELECT r.*, s.staff_name, v.registration_num
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `, [id]);

    if (result.length > 0) {
      await emailService.sendTripCompleted(
        result[0].staff_name,
        result[0].registration_num,
        distance
      );
      await smsService.sendTripCompletedSMS(result[0].registration_num, distance);
    }

    res.json({ message: 'Trip closed', distance, requisition: result[0] });
  } catch (error) {
    console.error('Close trip error:', error);
    res.status(500).json({ error: 'Failed to close trip' });
  }
});

// Rate driver
router.post('/:id/rate', async (req: any, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body; // rating 1-5

  try {
    await query(`
      UPDATE requisitions 
      SET driver_rating = ?, driver_rating_comment = ?, rated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [rating, comment || '', id]);

    res.json({ message: 'Driver rated' });
  } catch (error) {
    console.error('Rate driver error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

export default router;
