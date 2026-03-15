import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Generate case number
const generateCaseNumber = async () => {
  const year = new Date().getFullYear();
  const result = await query(
    "SELECT COUNT(*) as count FROM accidents WHERE EXTRACT(YEAR FROM created_at) = $1",
    [year]
  );
  const count = parseInt(result[0].count) + 1;
  return `ACC-${year}-${String(count).padStart(4, '0')}`;
};

// Get all accidents with filters
router.get('/', async (req, res) => {
  try {
    const { status, severity, driver_id, vehicle_id } = req.query;
    let sql = `
      SELECT a.*, 
        v.registration_num,
        d.staff_name as driver_name,
        r.route_name,
        reporter.staff_name as reported_by_name
      FROM accidents a
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN staff d ON d.id = a.driver_id
      LEFT JOIN routes r ON r.id = a.route_id
      LEFT JOIN staff reporter ON reporter.id = a.reported_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }
    if (severity) {
      sql += ` AND a.severity = $${paramIndex++}`;
      params.push(severity);
    }
    if (driver_id) {
      sql += ` AND a.driver_id = $${paramIndex++}`;
      params.push(driver_id);
    }
    if (vehicle_id) {
      sql += ` AND a.vehicle_id = $${paramIndex++}`;
      params.push(vehicle_id);
    }

    sql += ` ORDER BY a.accident_date DESC`;

    const result = await query(sql, params);
    res.json(result);
  } catch (error: any) {
    console.error('Get accidents error:', error);
    res.status(500).json({ error: 'Failed to fetch accidents', details: error.message });
  }
});

// Get single accident with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get accident
    const accidentResult = await query(`
      SELECT a.*, 
        v.registration_num,
        d.staff_name as driver_name,
        r.route_name,
        reporter.staff_name as reported_by_name,
        closer.staff_name as closed_by_name
      FROM accidents a
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN staff d ON d.id = a.driver_id
      LEFT JOIN routes r ON r.id = a.route_id
      LEFT JOIN staff reporter ON reporter.id = a.reported_by
      LEFT JOIN staff closer ON closer.id = a.closed_by
      WHERE a.id = $1
    `, [id]);

    if (accidentResult.length === 0) {
      return res.status(404).json({ error: 'Accident not found' });
    }

    const accident = accidentResult[0];

    // Get witnesses
    const witnesses = await query(
      'SELECT * FROM accident_witnesses WHERE accident_id = $1',
      [id]
    );

    // Get evidence
    const evidence = await query(
      'SELECT * FROM accident_evidence WHERE accident_id = $1',
      [id]
    );

    // Get investigation
    const investigationResult = await query(`
      SELECT ai.*, i.staff_name as investigator_name
      FROM accident_investigations ai
      LEFT JOIN staff i ON i.id = ai.investigator_id
      WHERE ai.accident_id = $1
    `, [id]);

    // Get root cause
    const rootCauseResult = await query(
      'SELECT * FROM accident_root_causes WHERE accident_id = $1',
      [id]
    );

    // Get CAPA
    const capa = await query(`
      SELECT c.*, s.staff_name as responsible_person_name
      FROM accident_capa c
      LEFT JOIN staff s ON s.id = c.responsible_person_id
      WHERE c.accident_id = $1
    `, [id]);

    // Get lessons
    const lessons = await query(
      'SELECT * FROM accident_lessons WHERE accident_id = $1',
      [id]
    );

    res.json({
      ...accident,
      witnesses,
      evidence,
      investigation: investigationResult[0] || null,
      rootCause: rootCauseResult[0] || null,
      capa,
      lessons
    });
  } catch (error: any) {
    console.error('Get accident error:', error);
    res.status(500).json({ error: 'Failed to fetch accident details', details: error.message });
  }
});

// Create new accident report
router.post('/', async (req, res) => {
  try {
    const {
      accident_date, gps_location, route_id, vehicle_id, driver_id,
      accident_type, severity, injuries_reported, police_notified,
      third_party_involved, weather_condition, road_condition,
      incident_description, witnesses
    } = req.body;

    const caseNumber = await generateCaseNumber();
    const id = uuidv4();

    await query(`
      INSERT INTO accidents (
        id, case_number, accident_date, gps_location, route_id, vehicle_id, driver_id,
        accident_type, severity, injuries_reported, police_notified,
        third_party_involved, weather_condition, road_condition,
        incident_description, reported_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      id, caseNumber, accident_date, gps_location, route_id, vehicle_id, driver_id,
      accident_type, severity, injuries_reported || false, police_notified || false,
      third_party_involved || false, weather_condition, road_condition,
      incident_description, (req as any).user?.userId, 'Reported'
    ]);

    // Add witnesses if provided
    if (witnesses && witnesses.length > 0) {
      for (const witness of witnesses) {
        await query(`
          INSERT INTO accident_witnesses (id, accident_id, witness_name, witness_contact, witness_statement)
          VALUES ($1, $2, $3, $4, $5)
        `, [uuidv4(), id, witness.name, witness.contact, witness.statement]);
      }
    }

    // Update driver safety score (reduce for accident)
    if (driver_id) {
      await updateDriverSafetyScore(driver_id);
    }

    const result = await query(`
      SELECT a.*, v.registration_num, d.staff_name as driver_name
      FROM accidents a
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN staff d ON d.id = a.driver_id
      WHERE a.id = $1
    `, [id]);

    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create accident error:', error);
    res.status(500).json({ error: 'Failed to create accident report', details: error.message });
  }
});

// Add investigation
router.post('/:id/investigation', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      investigator_id, investigation_date, scene_findings,
      vehicle_condition_assessment, driver_condition_assessment,
      valid_license, driver_training_compliant, speed_compliance,
      fatigue_status, alcohol_drug_test
    } = req.body;

    const investigationId = uuidv4();
    await query(`
      INSERT INTO accident_investigations (
        id, accident_id, investigator_id, investigation_date, scene_findings,
        vehicle_condition_assessment, driver_condition_assessment,
        valid_license, driver_training_compliant, speed_compliance,
        fatigue_status, alcohol_drug_test
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      investigationId, id, investigator_id, investigation_date, scene_findings,
      vehicle_condition_assessment, driver_condition_assessment,
      valid_license, driver_training_compliant, speed_compliance,
      fatigue_status, alcohol_drug_test
    ]);

    // Update accident status
    await query(
      "UPDATE accidents SET status = 'Under Investigation', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    res.status(201).json({ id: investigationId });
  } catch (error: any) {
    console.error('Add investigation error:', error);
    res.status(500).json({ error: 'Failed to add investigation', details: error.message });
  }
});

// Add root cause analysis
router.post('/:id/root-cause', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      primary_category, primary_cause, contributing_factors,
      driver_causes, vehicle_causes, environmental_causes, organizational_causes, notes
    } = req.body;

    const rootCauseId = uuidv4();
    await query(`
      INSERT INTO accident_root_causes (
        id, accident_id, primary_category, primary_cause, contributing_factors,
        driver_causes, vehicle_causes, environmental_causes, organizational_causes, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      rootCauseId, id, primary_category, primary_cause, JSON.stringify(contributing_factors || []),
      JSON.stringify(driver_causes || []), JSON.stringify(vehicle_causes || []),
      JSON.stringify(environmental_causes || []), JSON.stringify(organizational_causes || []), notes
    ]);

    // Update accident status
    await query(
      "UPDATE accidents SET status = 'Root Cause Identified', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    res.status(201).json({ id: rootCauseId });
  } catch (error: any) {
    console.error('Add root cause error:', error);
    res.status(500).json({ error: 'Failed to add root cause analysis', details: error.message });
  }
});

// Add CAPA
router.post('/:id/capa', async (req, res) => {
  try {
    const { id } = req.params;
    const { action_description, responsible_person_id, target_completion_date, priority } = req.body;

    const capaId = uuidv4();
    await query(`
      INSERT INTO accident_capa (id, accident_id, action_description, responsible_person_id, target_completion_date, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [capaId, id, action_description, responsible_person_id, target_completion_date, priority]);

    // Update accident status if first CAPA
    await query(
      "UPDATE accidents SET status = 'CAPA In Progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'Root Cause Identified'",
      [id]
    );

    res.status(201).json({ id: capaId });
  } catch (error: any) {
    console.error('Add CAPA error:', error);
    res.status(500).json({ error: 'Failed to add CAPA', details: error.message });
  }
});

// Update CAPA status
router.patch('/capa/:capaId', async (req, res) => {
  try {
    const { capaId } = req.params;
    const { status, completion_notes } = req.body;

    await query(`
      UPDATE accident_capa 
      SET status = $1, 
          actual_completion_date = CASE WHEN $1 = 'Completed' THEN CURRENT_DATE ELSE actual_completion_date END,
          completion_notes = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, completion_notes, capaId]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update CAPA error:', error);
    res.status(500).json({ error: 'Failed to update CAPA', details: error.message });
  }
});

// Add lessons learned
router.post('/:id/lessons', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      key_lesson, preventive_recommendations, training_required,
      training_details, policy_update_needed, policy_update_details
    } = req.body;

    const lessonId = uuidv4();
    await query(`
      INSERT INTO accident_lessons (
        id, accident_id, key_lesson, preventive_recommendations, training_required,
        training_details, policy_update_needed, policy_update_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      lessonId, id, key_lesson, preventive_recommendations, training_required,
      training_details, policy_update_needed, policy_update_details
    ]);

    res.status(201).json({ id: lessonId });
  } catch (error: any) {
    console.error('Add lessons error:', error);
    res.status(500).json({ error: 'Failed to add lessons', details: error.message });
  }
});

// Close accident case
router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { closure_remarks } = req.body;

    await query(`
      UPDATE accidents 
      SET status = 'Closed', 
          closed_by = $1, 
          closed_at = CURRENT_TIMESTAMP,
          closure_remarks = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [(req as any).user?.id, closure_remarks, id]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Close accident error:', error);
    res.status(500).json({ error: 'Failed to close accident', details: error.message });
  }
});

// Get accident analytics
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const { period } = req.query; // 'month', 'quarter', 'year'
    
    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "WHERE accident_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'quarter') {
      dateFilter = "WHERE accident_date >= CURRENT_DATE - INTERVAL '90 days'";
    } else if (period === 'year') {
      dateFilter = "WHERE accident_date >= CURRENT_DATE - INTERVAL '1 year'";
    }

    // Total accidents
    const totalResult = await query(`SELECT COUNT(*) as total FROM accidents ${dateFilter}`);
    
    // By severity
    const severityResult = await query(`
      SELECT severity, COUNT(*) as count FROM accidents ${dateFilter} GROUP BY severity
    `);
    
    // By type
    const typeResult = await query(`
      SELECT accident_type, COUNT(*) as count FROM accidents ${dateFilter} GROUP BY accident_type
    `);
    
    // Monthly trend
    const trendResult = await query(`
      SELECT DATE_TRUNC('month', accident_date) as month, COUNT(*) as count
      FROM accidents
      WHERE accident_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', accident_date)
      ORDER BY month
    `);
    
    // Top drivers with accidents
    const driverResult = await query(`
      SELECT d.staff_name, COUNT(*) as accident_count
      FROM accidents a
      JOIN staff d ON d.id = a.driver_id
      ${dateFilter ? dateFilter.replace('WHERE', 'WHERE') : 'WHERE 1=1'}
      GROUP BY d.staff_name
      ORDER BY accident_count DESC
      LIMIT 10
    `);
    
    // By status
    const statusResult = await query(`
      SELECT status, COUNT(*) as count FROM accidents ${dateFilter} GROUP BY status
    `);

    res.json({
      total: parseInt(totalResult[0]?.total || 0),
      bySeverity: severityResult,
      byType: typeResult,
      monthlyTrend: trendResult,
      topDrivers: driverResult,
      byStatus: statusResult
    });
  } catch (error: any) {
    console.error('Accident analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

// Helper function to update driver safety score
const updateDriverSafetyScore = async (driverId: string) => {
  try {
    // Get accident count for driver
    const accidentResult = await query(
      'SELECT COUNT(*) as count FROM accidents WHERE driver_id = $1',
      [driverId]
    );
    const accidentCount = parseInt(accidentResult[0]?.count || 0);

    // Calculate score (base 100, minus 15 points per accident, min 0)
    let score = Math.max(0, 100 - (accidentCount * 15));
    
    // Determine rating
    let rating = 'Excellent';
    if (score < 60) rating = 'High Risk';
    else if (score < 75) rating = 'Risk';
    else if (score < 90) rating = 'Good';

    await query(
      'UPDATE staff SET safety_score = $1, safety_rating = $2 WHERE id = $3',
      [score, rating, driverId]
    );
  } catch (error) {
    console.error('Update safety score error:', error);
  }
};

export default router;
