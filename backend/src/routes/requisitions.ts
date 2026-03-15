import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import emailService from '../services/email';

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
    
    // Send email notification - non-blocking (fire and forget)
    emailService.sendRequisitionRequest(staff.staff_name, req.body)
      .then(() => console.log('Requisition email sent'))
      .catch((err: any) => console.error('Email failed (non-blocking):', err));

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

// Get my requisitions
router.get('/my-requests', async (req: any, res) => {
  // Use staffId if available (for job roles), otherwise fall back to userId
  const staffId = req.user?.staffId || req.user?.userId;
  const userEmail = req.user?.email;
  
  try {
    // For managers/admins without staff records: show all requests they created OR all requests
    const isManager = ['admin', 'manager'].includes(req.user?.role);
    
    let result;
    if (isManager && !req.user?.staffId) {
      // Manager without staff record - show ALL requests
      result = await query(`
        SELECT r.*, 
          s.staff_name as requester_name, 
          d.staff_name as driver_name,
          v.registration_num
        FROM requisitions r
        JOIN staff s ON r.requested_by = s.id
        LEFT JOIN staff d ON r.driver_id = d.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        ORDER BY r.created_at DESC
      `);
    } else {
      // Staff member - show only their requests
      result = await query(`
        SELECT r.*, 
          s.staff_name as requester_name, 
          d.staff_name as driver_name,
          v.registration_num
        FROM requisitions r
        JOIN staff s ON r.requested_by = s.id
        LEFT JOIN staff d ON r.driver_id = d.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.requested_by = ?
        ORDER BY r.created_at DESC
      `, [staffId]);
    }
    
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
  const userRole = req.user?.role;
  const isManager = ['admin', 'manager'].includes(userRole);
  
  try {
    let result;
    
    if (isManager) {
      // Managers see ALL pending requests (no department filter)
      result = await query(`
        SELECT r.*, s.staff_name, s.email, s.department
        FROM requisitions r
        JOIN staff s ON r.requested_by = s.id
        WHERE r.status = 'pending'
        ORDER BY r.created_at DESC
      `);
    } else {
      // HODs and others see only their department's pending requests
      result = await query(`
        SELECT r.*, s.staff_name, s.email, s.department
        FROM requisitions r
        JOIN staff s ON r.requested_by = s.id
        WHERE r.status = 'pending' AND s.department = ?
        ORDER BY r.created_at DESC
      `, [userDept]);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// Get pending allocations (approved but not yet allocated)
router.get('/pending-allocations', async (req: any, res) => {
  try {
    const result = await query(`
      SELECT r.*, s.staff_name as requester_name, s.department
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      WHERE r.status = 'approved' AND r.vehicle_id IS NULL
      ORDER BY r.created_at DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get pending allocations error:', error);
    res.status(500).json({ error: 'Failed to fetch pending allocations' });
  }
});

// Get my assignments (for drivers)
router.get('/my-assignments', async (req: any, res) => {
  const userId = req.user?.userId;
  
  try {
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name,
        v.registration_num, v.make_model
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.driver_id = ?
      ORDER BY r.travel_date DESC
    `, [userId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Approve/Reject requisition
router.post('/:id/approve', async (req: any, res) => {
  const { id } = req.params;
  const { status, reason } = req.body; // status: 'approved' or 'rejected'
  const approverId = req.user?.userId;
  
  console.log('Approve request:', { id, status, approverId, user: req.user });

  if (!approverId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // First check if requisition exists and is pending
    const checkResult = await query('SELECT * FROM requisitions WHERE id = ?', [id]);
    if (checkResult.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    if (checkResult[0].status !== 'pending') {
      return res.status(400).json({ error: 'Requisition is not pending' });
    }

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
      // Non-blocking email
      emailService.sendApprovalNotification(result[0].staff_name, status, reason)
        .catch((err: any) => console.error('Email failed:', err));
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
  const allocatedBy = req.user?.userId;

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
      // Non-blocking email
      emailService.sendVehicleAllocated(
        result[0].staff_name, 
        result[0].registration_num,
        result[0].driver_name
      ).catch((err: any) => console.error('Email failed:', err));
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
      // Non-blocking email
      emailService.sendInspectionNotification(
        result[0].registration_num,
        result[0].driver_name,
        passed
      ).catch((err: any) => console.error('Email failed:', err));
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
  const closedBy = req.user?.userId;

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
      // Non-blocking email
      emailService.sendTripCompleted(
        result[0].staff_name,
        result[0].registration_num,
        distance
      ).catch((err: any) => console.error('Email failed:', err));
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

// ========== SECURITY GATE MANAGEMENT ==========

// Get vehicles ready for departure (allocated and inspected)
router.get('/security/ready-for-departure', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name, s.department,
        v.registration_num, v.make_model,
        d.staff_name as driver_name, d.phone as driver_phone
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.status IN ('allocated', 'ready_for_departure')
        AND r.inspection_passed = true
      ORDER BY r.travel_date, r.travel_time
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get ready for departure error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Get active trips (departed but not returned)
router.get('/security/active-trips', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name, s.department,
        v.registration_num, v.make_model,
        d.staff_name as driver_name, d.phone as driver_phone,
        sec.staff_name as security_name
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      LEFT JOIN staff sec ON r.security_cleared_by = sec.id
      WHERE r.status = 'departed'
      ORDER BY r.departed_at DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get active trips error:', error);
    res.status(500).json({ error: 'Failed to fetch active trips' });
  }
});

// Security check-out (vehicle leaving)
router.post('/:id/security-checkout', async (req: any, res) => {
  const { id } = req.params;
  const { starting_odometer } = req.body;
  const securityId = req.user?.userId;

  if (!starting_odometer) {
    return res.status(400).json({ error: 'Starting odometer reading required' });
  }

  try {
    // Update requisition
    await query(`
      UPDATE requisitions 
      SET 
        starting_odometer = ?,
        security_cleared_by = ?,
        security_cleared_at = CURRENT_TIMESTAMP,
        departed_at = CURRENT_TIMESTAMP,
        status = 'departed'
      WHERE id = ?
    `, [starting_odometer, securityId, id]);

    // Get details for response
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name,
        v.registration_num, 
        d.staff_name as driver_name
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = ?
    `, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Update vehicle status to 'On Trip'
    await query(`
      UPDATE vehicles 
      SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [result[0].vehicle_id]);

    res.json({ 
      message: 'Vehicle checked out successfully', 
      trip: result[0],
      departed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Security checkout error:', error);
    res.status(500).json({ error: 'Failed to check out vehicle' });
  }
});

// Security check-in (vehicle returning)
router.post('/:id/security-checkin', async (req: any, res) => {
  const { id } = req.params;
  const { ending_odometer, notes } = req.body;
  const securityId = req.user?.userId;

  if (!ending_odometer) {
    return res.status(400).json({ error: 'Ending odometer reading required' });
  }

  try {
    // Get trip details first
    const tripData = await query('SELECT * FROM requisitions WHERE id = ?', [id]);
    if (tripData.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const trip = tripData[0];
    const distance = ending_odometer - (trip.starting_odometer || 0);
    
    // Calculate trip duration in minutes
    const departedAt = new Date(trip.departed_at);
    const returnedAt = new Date();
    const durationMinutes = Math.round((returnedAt.getTime() - departedAt.getTime()) / (1000 * 60));

    // Update requisition
    await query(`
      UPDATE requisitions 
      SET 
        ending_odometer = ?,
        distance_km = ?,
        trip_duration_minutes = ?,
        returned_at = CURRENT_TIMESTAMP,
        security_notes = ?,
        status = 'returned'
      WHERE id = ?
    `, [ending_odometer, distance, durationMinutes, notes || '', id]);

    // Update vehicle status back to 'Active' and mileage
    await query(`
      UPDATE vehicles 
      SET status = 'Active', current_mileage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [ending_odometer, trip.vehicle_id]);

    // Get full details for response
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name,
        v.registration_num, 
        d.staff_name as driver_name
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = ?
    `, [id]);

    res.json({ 
      message: 'Vehicle checked in successfully', 
      trip: result[0],
      distance_km: distance,
      duration_minutes: durationMinutes,
      returned_at: returnedAt.toISOString()
    });
  } catch (error) {
    console.error('Security checkin error:', error);
    res.status(500).json({ error: 'Failed to check in vehicle' });
  }
});

// Get driver's trip history with productivity metrics
router.get('/driver/:driverId/trip-history', async (req, res) => {
  const { driverId } = req.params;
  
  try {
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name,
        v.registration_num,
        (r.trip_duration_minutes / 60.0) as duration_hours
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.driver_id = ? AND r.status = 'returned'
      ORDER BY r.returned_at DESC
    `, [driverId]);
    
    // Calculate productivity metrics
    const totalTrips = result.length;
    const totalDurationMinutes = result.reduce((sum: number, trip: any) => 
      sum + (trip.trip_duration_minutes || 0), 0);
    const totalDistance = result.reduce((sum: number, trip: any) => 
      sum + (trip.distance_km || 0), 0);
    const avgTripDuration = totalTrips > 0 ? totalDurationMinutes / totalTrips : 0;
    
    res.json({
      trips: result,
      summary: {
        total_trips: totalTrips,
        total_duration_hours: (totalDurationMinutes / 60).toFixed(2),
        total_distance_km: totalDistance.toFixed(2),
        avg_trip_duration_minutes: avgTripDuration.toFixed(0),
        avg_speed_kmh: totalDurationMinutes > 0 ? 
          ((totalDistance / totalDurationMinutes) * 60).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Get driver trip history error:', error);
    res.status(500).json({ error: 'Failed to fetch trip history' });
  }
});

export default router;
