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
    const staffCheck = await query('SELECT staff_name, email, department FROM staff WHERE id = $1', [requested_by]);
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', CURRENT_TIMESTAMP)
    `, [
      id, requestNo, requested_by, place_of_departure, destination, purpose,
      travel_date, travel_time, return_date || null, return_time || null,
      num_passengers || 1, passenger_names || ''
    ]);

    // Get the created requisition
    const result = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    
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
        WHERE r.requested_by = $1
        ORDER BY r.created_at DESC
      `, [staffId]);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get all requisitions (for managers) - with optional status filter
router.get('/', async (req: any, res) => {
  try {
    const status = req.query?.status;
    
    let queryStr = `
      SELECT r.*, s.staff_name, s.email, s.department,
        d.staff_name as driver_name,
        v.registration_num
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN staff d ON r.driver_id = d.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
    `;
    
    let params: any[] = [];
    
    if (status) {
      queryStr += ` WHERE r.status = $1`;
      params.push(status);
    }
    
    queryStr += ` ORDER BY r.created_at DESC`;
    
    const result = await query(queryStr, params);
    
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
        WHERE r.status = 'pending' AND s.department = $1
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
  const staffId = req.user?.staffId;
  
  if (!staffId) {
    return res.status(400).json({ error: 'No staff record linked to your account' });
  }
  
  try {
    const result = await query(`
      SELECT r.*, 
        s.staff_name as requester_name,
        v.registration_num, v.make_model
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.driver_id = $1
      ORDER BY r.travel_date DESC
    `, [staffId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Approve/Reject requisition
router.post('/:id/approve', async (req: any, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  const userId = req.user?.userId;
  const staffId = req.user?.staffId;
  
  console.log('Approve request:', { id, status, userId, staffId, user: req.user });

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // First check if requisition exists and is pending
    const checkResult = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (checkResult.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    if (checkResult[0].status !== 'pending') {
      return res.status(400).json({ error: 'Requisition is not pending' });
    }

    // Use staffId if available (for staff users), otherwise use NULL
    const approverId = staffId || null;

    await query(`
      UPDATE requisitions 
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, approval_reason = $3
      WHERE id = $4
    `, [status, approverId, reason || '', id]);

    // Get requisition details for notification
    const result = await query(`
      SELECT r.*, s.staff_name 
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      WHERE r.id = $1
    `, [id]);

    if (result.length > 0) {
      emailService.sendApprovalNotification(result[0].staff_name, status, reason)
        .catch((err: any) => console.error('Email failed:', err));
    }

    res.json({ message: `Requisition ${status}`, requisition: result[0] });
  } catch (error: any) {
    console.error('Approve requisition error:', error);
    res.status(500).json({ error: 'Failed to update requisition: ' + (error.message || 'Unknown error') });
  }
});

// Allocate vehicle and driver (Transport Supervisor)
router.post('/:id/allocate', async (req: any, res) => {
  const { id } = req.params;
  const { vehicle_id, driver_id } = req.body;
  const userId = req.user?.userId;
  const staffId = req.user?.staffId;
  
  console.log('Allocate request:', { id, vehicle_id, driver_id, userId, staffId });

  if (!vehicle_id || !driver_id) {
    return res.status(400).json({ error: 'Vehicle and driver are required' });
  }

  try {
    // Use staffId if available, otherwise NULL
    const allocatedBy = staffId || null;
    
    await query(`
      UPDATE requisitions 
      SET vehicle_id = $1, driver_id = $2, allocated_by = $3, allocated_at = CURRENT_TIMESTAMP, status = 'allocated'
      WHERE id = $4
    `, [vehicle_id, driver_id, allocatedBy, id]);

    // Get details for notification
    const result = await query(`
      SELECT r.*, s.staff_name, v.registration_num, d.staff_name as driver_name
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = $1
    `, [id]);

    if (result.length > 0) {
      emailService.sendVehicleAllocated(
        result[0].staff_name, 
        result[0].registration_num,
        result[0].driver_name
      ).catch((err: any) => console.error('Email failed:', err));
    }

    res.json({ message: 'Vehicle allocated', requisition: result[0] });
  } catch (error: any) {
    console.error('Allocate vehicle error:', error);
    res.status(500).json({ error: 'Failed to allocate vehicle: ' + (error.message || 'Unknown error') });
  }
});

// Submit driver inspection - FLAG VEHICLE AS DEFECTIVE ON FAILURE
router.post('/:id/inspection', async (req: any, res) => {
  const { id } = req.params;
  const { 
    tires_ok, brakes_ok, lights_ok, oil_ok, coolant_ok,
    battery_ok, wipers_ok, mirrors_ok, seatbelts_ok, fuel_ok,
    defects_found, defect_photos, passed,
    starting_odometer
  } = req.body;

  try {
    // Get requisition details first
    const reqResult = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (reqResult.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    const requisition = reqResult[0];
    
    await query(`
      UPDATE requisitions 
      SET 
        inspection_tires = $1, inspection_brakes = $2, inspection_lights = $3,
        inspection_oil = $4, inspection_coolant = $5, inspection_battery = $6,
        inspection_wipers = $7, inspection_mirrors = $8, inspection_seatbelts = $9,
        inspection_fuel = $10, defects_found = $11, defect_photos = $12,
        inspection_passed = $13, inspection_completed_at = CURRENT_TIMESTAMP,
        starting_odometer = $14,
        status = $15
      WHERE id = $16
    `, [
      tires_ok, brakes_ok, lights_ok, oil_ok, coolant_ok,
      battery_ok, wipers_ok, mirrors_ok, seatbelts_ok, fuel_ok,
      defects_found || '', JSON.stringify(defect_photos || []),
      passed, starting_odometer || null,
      passed ? 'ready_for_departure' : 'inspection_failed',
      id
    ]);

    // If inspection failed, flag the vehicle as defective
    if (!passed && requisition.vehicle_id) {
      await query(`
        UPDATE vehicles 
        SET status = 'Defective', 
            defect_notes = $1,
            defect_reported_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [defects_found || 'Vehicle failed pre-trip inspection', requisition.vehicle_id]);
      
      // Create a job card entry for the defective vehicle
      const jobCardId = uuidv4();
      const year = new Date().getFullYear();
      const jobCardNumber = `JB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${year}`;
      
      await query(`
        INSERT INTO job_cards (
          id, job_card_number, vehicle_id, defect_description, 
          reported_by, reported_at, status, source_type, source_id
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'Pending', 'inspection', $6)
      `, [
        jobCardId, 
        jobCardNumber, 
        requisition.vehicle_id,
        defects_found || 'Vehicle failed pre-trip inspection',
        requisition.driver_id,
        id
      ]);
    }

    // Get details for notification
    const result = await query(`
      SELECT r.*, v.registration_num, d.staff_name as driver_name
      FROM requisitions r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = $1
    `, [id]);

    if (result.length > 0) {
      // Non-blocking email
      emailService.sendInspectionNotification(
        result[0].registration_num,
        result[0].driver_name,
        passed
      ).catch((err: any) => console.error('Email failed:', err));
      
      // Send maintenance notification if inspection failed
      if (!passed) {
        emailService.sendMaintenanceNotification(
          result[0].registration_num,
          result[0].driver_name,
          defects_found || 'Vehicle failed pre-trip inspection'
        ).catch((err: any) => console.error('Maintenance email failed:', err));
      }
    }

    res.json({ 
      message: 'Inspection submitted', 
      passed, 
      requisition: result[0],
      vehicle_flagged: !passed
    });
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
    const reqData = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (reqData.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const distance = ending_odometer - (reqData[0].starting_odometer || 0);

    await query(`
      UPDATE requisitions 
      SET 
        ending_odometer = $1, 
        distance_km = $2,
        closed_by = $3,
        closed_at = CURRENT_TIMESTAMP,
        status = 'completed'
      WHERE id = $4
    `, [ending_odometer, distance, closedBy, id]);

    // Get details for notification
    const result = await query(`
      SELECT r.*, s.staff_name, v.registration_num
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = $1
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
      SET driver_rating = $1, driver_rating_comment = $2, rated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [rating, comment || '', id]);

    res.json({ message: 'Driver rated' });
  } catch (error) {
    console.error('Rate driver error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// ========== INSPECTION FAILURE HANDLING ==========

// Retry inspection - reset from inspection_failed to allocated
router.post('/:id/retry-inspection', async (req: any, res) => {
  const { id } = req.params;
  
  try {
    // Verify trip is in inspection_failed status
    const checkResult = await query('SELECT * FROM requisitions WHERE id = $1 AND status = $2', [id, 'inspection_failed']);
    if (checkResult.length === 0) {
      return res.status(400).json({ error: 'Trip not in inspection_failed status' });
    }

    // Reset status to allocated and clear inspection data
    await query(`
      UPDATE requisitions 
      SET 
        status = 'allocated',
        inspection_passed = null,
        inspection_completed_at = null,
        defects_found = null,
        inspection_tires = null,
        inspection_brakes = null,
        inspection_lights = null,
        inspection_oil = null,
        inspection_coolant = null,
        inspection_battery = null,
        inspection_wipers = null,
        inspection_mirrors = null,
        inspection_seatbelts = null,
        inspection_fuel = null,
        starting_odometer = null
      WHERE id = $1
    `, [id]);

    res.json({ message: 'Inspection reset - ready for retry' });
  } catch (error) {
    console.error('Retry inspection error:', error);
    res.status(500).json({ error: 'Failed to reset inspection' });
  }
});

// Reallocate vehicle after inspection failure
router.post('/:id/reallocate', async (req: any, res) => {
  const { id } = req.params;
  const { vehicle_id, driver_id } = req.body;
  const staffId = req.user?.staffId;
  
  if (!vehicle_id || !driver_id) {
    return res.status(400).json({ error: 'Vehicle and driver required' });
  }

  try {
    // Verify trip is in inspection_failed status
    const checkResult = await query('SELECT * FROM requisitions WHERE id = $1 AND status = $2', [id, 'inspection_failed']);
    if (checkResult.length === 0) {
      return res.status(400).json({ error: 'Trip not in inspection_failed status' });
    }

    const allocatedBy = staffId || null;

    // Update with new vehicle/driver and reset inspection
    await query(`
      UPDATE requisitions 
      SET 
        vehicle_id = $1,
        driver_id = $2,
        allocated_by = $3,
        allocated_at = CURRENT_TIMESTAMP,
        status = 'allocated',
        inspection_passed = null,
        inspection_completed_at = null,
        defects_found = null,
        inspection_tires = null,
        inspection_brakes = null,
        inspection_lights = null,
        inspection_oil = null,
        inspection_coolant = null,
        inspection_battery = null,
        inspection_wipers = null,
        inspection_mirrors = null,
        inspection_seatbelts = null,
        inspection_fuel = null,
        starting_odometer = null
      WHERE id = $4
    `, [vehicle_id, driver_id, allocatedBy, id]);

    // Get updated details
    const result = await query(`
      SELECT r.*, v.registration_num, d.staff_name as driver_name
      FROM requisitions r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = $1
    `, [id]);

    res.json({ message: 'Vehicle reallocated', requisition: result[0] });
  } catch (error) {
    console.error('Reallocate error:', error);
    res.status(500).json({ error: 'Failed to reallocate vehicle' });
  }
});

// Get dashboard stats
router.get('/stats', async (req: any, res) => {
  const userId = req.user?.userId;
  const staffId = req.user?.staffId;
  const userRole = req.user?.role;
  const isManager = ['admin', 'manager'].includes(userRole);
  const isDriver = userRole === 'driver';
  
  try {
    // Base query conditions
    const today = new Date().toISOString().split('T')[0];
    
    // Total requests (for user's scope)
    let totalRequestsQuery = 'SELECT COUNT(*) as count FROM requisitions';
    let totalRequestsParams: any[] = [];
    
    if (!isManager && staffId) {
      totalRequestsQuery += ' WHERE requested_by = $1';
      totalRequestsParams.push(staffId);
    }
    
    const totalRequests = await query(totalRequestsQuery, totalRequestsParams);
    
    // Pending approvals
    let pendingApprovalsQuery = `SELECT COUNT(*) as count FROM requisitions r WHERE r.status = 'pending'`;
    let pendingApprovalsParams: any[] = [];
    
    if (!isManager && req.user?.department) {
      pendingApprovalsQuery += ` AND EXISTS (SELECT 1 FROM staff s WHERE s.id = r.requested_by AND s.department = $1)`;
      pendingApprovalsParams.push(req.user.department);
    }
    
    const pendingApprovals = await query(pendingApprovalsQuery, pendingApprovalsParams);
    
    // Pending allocations
    const pendingAllocations = await query(`
      SELECT COUNT(*) as count FROM requisitions WHERE status = 'approved' AND vehicle_id IS NULL
    `);
    
    // My assignments (for drivers)
    let myAssignmentsQuery = `SELECT COUNT(*) as count FROM requisitions WHERE status IN ('allocated', 'ready_for_departure', 'departed')`;
    let myAssignmentsParams: any[] = [];
    
    if (isDriver && staffId) {
      myAssignmentsQuery += ' AND driver_id = $1';
      myAssignmentsParams.push(staffId);
    } else if (!isManager) {
      myAssignmentsQuery += ' AND driver_id = $1';
      myAssignmentsParams.push(staffId || 'NONE');
    }
    
    const myAssignments = await query(myAssignmentsQuery, myAssignmentsParams);
    
    // Completed today
    let completedTodayQuery = `SELECT COUNT(*) as count FROM requisitions WHERE status = 'completed' AND DATE(closed_at) = CURRENT_DATE`;
    let completedTodayParams: any[] = [];
    
    if (!isManager && staffId) {
      completedTodayQuery += ' AND requested_by = $1';
      completedTodayParams.push(staffId);
    }
    
    const completedToday = await query(completedTodayQuery, completedTodayParams);
    
    res.json({
      totalRequests: parseInt(totalRequests[0]?.count || 0),
      pendingApprovals: parseInt(pendingApprovals[0]?.count || 0),
      pendingAllocations: parseInt(pendingAllocations[0]?.count || 0),
      myAssignments: parseInt(myAssignments[0]?.count || 0),
      completedToday: parseInt(completedToday[0]?.count || 0)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get active trips (driver view)
router.get('/active-trips', async (req: any, res) => {
  const staffId = req.user?.staffId;
  const userRole = req.user?.role;
  const isManager = ['admin', 'manager'].includes(userRole);
  
  try {
    let queryStr = `
      SELECT r.*, 
        s.staff_name as requester_name, s.department,
        v.registration_num, v.make_model,
        d.staff_name as driver_name
      FROM requisitions r
      JOIN staff s ON r.requested_by = s.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.status IN ('ready_for_departure', 'departed')
    `;
    
    let params: any[] = [];
    
    // Non-managers only see their own trips
    if (!isManager && staffId) {
      queryStr += ` AND (r.requested_by = $1 OR r.driver_id = $1)`;
      params.push(staffId);
    }
    
    queryStr += ` ORDER BY r.travel_date DESC, r.travel_time DESC`;
    
    const result = await query(queryStr, params);
    res.json(result);
  } catch (error) {
    console.error('Active trips error:', error);
    res.status(500).json({ error: 'Failed to fetch active trips' });
  }
});

// Mark trip as departed (Driver)
router.post('/:id/depart', async (req: any, res) => {
  const { id } = req.params;
  const { starting_odometer } = req.body;
  const staffId = req.user?.staffId;
  
  try {
    // Verify trip is allocated to this driver
    const checkResult = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (checkResult.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    const trip = checkResult[0];
    
    if (trip.status !== 'ready_for_departure') {
      return res.status(400).json({ error: 'Trip is not ready for departure' });
    }
    
    if (trip.driver_id !== staffId) {
      return res.status(403).json({ error: 'Not authorized - not assigned to this trip' });
    }

    await query(`
      UPDATE requisitions 
      SET 
        status = 'departed',
        departed_at = CURRENT_TIMESTAMP,
        starting_odometer = $1
      WHERE id = $2
    `, [starting_odometer || trip.starting_odometer, id]);

    // Update vehicle status
    await query(`
      UPDATE vehicles 
      SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [trip.vehicle_id]);

    const result = await query(`
      SELECT r.*, v.registration_num, d.staff_name as driver_name
      FROM requisitions r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      WHERE r.id = $1
    `, [id]);

    res.json({ message: 'Trip marked as departed', trip: result[0] });
  } catch (error) {
    console.error('Depart error:', error);
    res.status(500).json({ error: 'Failed to mark departure' });
  }
});

// Mark trip as completed (Driver)
router.post('/:id/complete', async (req: any, res) => {
  const { id } = req.params;
  const { ending_odometer, notes } = req.body;
  const staffId = req.user?.staffId;
  
  if (!ending_odometer) {
    return res.status(400).json({ error: 'Ending odometer required' });
  }
  
  try {
    const checkResult = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (checkResult.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }
    
    const trip = checkResult[0];
    
    if (trip.status !== 'departed') {
      return res.status(400).json({ error: 'Trip has not departed yet' });
    }
    
    if (trip.driver_id !== staffId) {
      return res.status(403).json({ error: 'Not authorized - not assigned to this trip' });
    }

    const distance = ending_odometer - (trip.starting_odometer || 0);

    await query(`
      UPDATE requisitions 
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        ending_odometer = $1,
        distance_km = $2,
        completion_notes = $3
      WHERE id = $4
    `, [ending_odometer, distance, notes || '', id]);

    // Update vehicle mileage and status
    await query(`
      UPDATE vehicles 
      SET 
        status = 'Active', 
        current_mileage = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [ending_odometer, trip.vehicle_id]);

    const result = await query(`
      SELECT r.*, v.registration_num, d.staff_name as driver_name, s.staff_name as requester_name
      FROM requisitions r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN staff d ON r.driver_id = d.id
      JOIN staff s ON r.requested_by = s.id
      WHERE r.id = $1
    `, [id]);

    // Send notification email
    emailService.sendTripCompleted(
      result[0].requester_name,
      result[0].registration_num,
      distance
    ).catch((err: any) => console.error('Email failed:', err));

    res.json({ 
      message: 'Trip completed successfully', 
      trip: result[0],
      distance
    });
  } catch (error) {
    console.error('Complete error:', error);
    res.status(500).json({ error: 'Failed to complete trip' });
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

// Security check-out (vehicle leaving) - NO STARTING ODOMETER, just verify and check out
router.post('/:id/security-checkout', async (req: any, res) => {
  const { id } = req.params;
  const securityId = req.user?.userId;

  try {
    // Verify the trip has been inspected and has starting odometer recorded
    const tripCheck = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (tripCheck.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const trip = tripCheck[0];
    
    if (!trip.inspection_passed) {
      return res.status(400).json({ error: 'Vehicle has not passed inspection' });
    }
    
    if (!trip.starting_odometer) {
      return res.status(400).json({ error: 'Starting odometer not recorded. Complete inspection first.' });
    }

    // Update requisition - Security just verifies and checks out
    await query(`
      UPDATE requisitions 
      SET 
        security_cleared_by = $1,
        security_cleared_at = CURRENT_TIMESTAMP,
        departed_at = CURRENT_TIMESTAMP,
        status = 'departed'
      WHERE id = $2
    `, [securityId, id]);

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
      WHERE r.id = $1
    `, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Update vehicle status to 'On Trip'
    await query(`
      UPDATE vehicles 
      SET status = 'On Trip', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
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
    const tripData = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (tripData.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const distance = ending_odometer - (tripData[0].starting_odometer || 0);

    await query(`
      UPDATE requisitions 
      SET 
        ending_odometer = $1,
        distance_km = $2,
        return_notes = $3,
        returned_at = CURRENT_TIMESTAMP,
        status = 'returned'
      WHERE id = $4
    `, [ending_odometer, distance, notes || '', id]);

    // Update vehicle status back to Active
    await query(`
      UPDATE vehicles 
      SET status = 'Active', current_mileage = current_mileage + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [distance, tripData[0].vehicle_id]);

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
      WHERE r.id = $1
    `, [id]);

    res.json({ 
      message: 'Vehicle checked in successfully', 
      trip: result[0],
      distance,
      returned_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Security checkin error:', error);
    res.status(500).json({ error: 'Failed to check in vehicle' });
  }
});

export default router;
