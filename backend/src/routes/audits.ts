import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all audit routes
router.use(authenticateToken);

// Generate audit number
const generateAuditNumber = async () => {
  const year = new Date().getFullYear();
  const result = await query(
    "SELECT COUNT(*) as count FROM audit_sessions WHERE EXTRACT(YEAR FROM created_at) = $1",
    [year]
  );
  const count = parseInt(result[0].count) + 1;
  return `AUD-${year}-${String(count).padStart(4, '0')}`;
};

// Get all audit templates
router.get('/templates', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        t.*,
        COUNT(q.id) as question_count
      FROM audit_templates t
      LEFT JOIN audit_questions q ON q.template_id = t.id
      WHERE t.is_active = true
      GROUP BY t.id
      ORDER BY t.template_name
    `);
    res.json(result);
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template with questions
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const templateResult = await query('SELECT * FROM audit_templates WHERE id = $1', [id]);
    if (templateResult.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const questions = await query(
      'SELECT * FROM audit_questions WHERE template_id = $1 ORDER BY question_order',
      [id]
    );

    res.json({
      ...templateResult[0],
      questions
    });
  } catch (error: any) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new audit template
router.post('/templates', async (req, res) => {
  try {
    const { template_name, description, questions } = req.body;
    
    const templateId = uuidv4();
    await query(
      'INSERT INTO audit_templates (id, template_name, description, created_by) VALUES ($1, $2, $3, $4)',
      [templateId, template_name, description, (req as any).user?.id]
    );

    // Add questions
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await query(`
          INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [uuidv4(), templateId, q.module_name, q.question_text, i + 1, q.requires_evidence || false]);
      }
    }

    res.status(201).json({ id: templateId });
  } catch (error: any) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Get all audit sessions
router.get('/sessions', async (req, res) => {
  try {
    const { status, auditor_id } = req.query;
    
    let sql = `
      SELECT s.*, 
        t.template_name,
        a.staff_name as auditor_name
      FROM audit_sessions s
      LEFT JOIN audit_templates t ON t.id = s.template_id
      LEFT JOIN staff a ON a.id = s.auditor_id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (status) {
      sql += ' AND s.status = $' + (params.length + 1);
      params.push(status);
    }
    if (auditor_id) {
      sql += ' AND s.auditor_id = $' + (params.length + 1);
      params.push(auditor_id);
    }
    
    sql += ' ORDER BY s.created_at DESC';
    
    const result = await query(sql, params);
    res.json(result);
  } catch (error: any) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch audit sessions' });
  }
});

// Get single audit session with responses
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get session
    const sessionResult = await query(`
      SELECT s.*, 
        t.template_name,
        a.staff_name as auditor_name
      FROM audit_sessions s
      LEFT JOIN audit_templates t ON t.id = s.template_id
      LEFT JOIN staff a ON a.id = s.auditor_id
      WHERE s.id = $1
    `, [id]);

    if (sessionResult.length === 0) {
      return res.status(404).json({ error: 'Audit session not found' });
    }

    // Get responses with questions
    const responses = await query(`
      SELECT r.*, q.module_name, q.question_text, q.max_score, q.requires_evidence
      FROM audit_responses r
      JOIN audit_questions q ON q.id = r.question_id
      WHERE r.session_id = $1
      ORDER BY q.question_order
    `, [id]);

    // Get corrective actions
    const correctiveActions = await query(`
      SELECT ca.*, s.staff_name as responsible_person_name, r.issue_identified
      FROM audit_corrective_actions ca
      LEFT JOIN staff s ON s.id = ca.responsible_person_id
      LEFT JOIN audit_responses r ON r.id = ca.response_id
      WHERE ca.session_id = $1
    `, [id]);

    res.json({
      ...sessionResult[0],
      responses,
      correctiveActions
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch audit session' });
  }
});

// Start new audit session
router.post('/sessions', async (req, res) => {
  try {
    const { template_id, branch, department, vehicle_ids } = req.body;
    
    const auditNumber = await generateAuditNumber();
    const sessionId = uuidv4();
    
    await query(`
      INSERT INTO audit_sessions (id, audit_number, template_id, branch, department, vehicle_ids, auditor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sessionId, auditNumber, template_id, branch, department, JSON.stringify(vehicle_ids || []), (req as any).user?.id]);

    // Get template questions and create empty responses
    const questions = await query(
      'SELECT id FROM audit_questions WHERE template_id = $1 ORDER BY question_order',
      [template_id]
    );

    for (const q of questions) {
      await query(
        'INSERT INTO audit_responses (id, session_id, question_id) VALUES ($1, $2, $3)',
        [uuidv4(), sessionId, q.id]
      );
    }

    const result = await query(`
      SELECT s.*, t.template_name, a.staff_name as auditor_name
      FROM audit_sessions s
      LEFT JOIN audit_templates t ON t.id = s.template_id
      LEFT JOIN staff a ON a.id = s.auditor_id
      WHERE s.id = $1
    `, [sessionId]);

    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create audit session' });
  }
});

// Submit audit response
router.post('/sessions/:id/responses', async (req, res) => {
  try {
    const { id } = req.params;
    const { responses } = req.body; // Array of { response_id, response, notes, gps_location }
    
    for (const r of responses) {
      let score = 0;
      if (r.response === 'Fully Compliant') score = 100;
      else if (r.response === 'Partially Compliant') score = 50;
      else if (r.response === 'Non Compliant') score = 0;
      else if (r.response === 'Not Applicable') score = -1; // Excluded

      await query(`
        UPDATE audit_responses 
        SET response = $1, score = $2, notes = $3, gps_location = $4, evidence_attached = $5
        WHERE id = $6 AND session_id = $7
      `, [r.response, score, r.notes, r.gps_location, r.evidence_attached || false, r.response_id, id]);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Submit responses error:', error);
    res.status(500).json({ error: 'Failed to submit responses' });
  }
});

// Upload evidence for response
router.post('/responses/:responseId/evidence', async (req, res) => {
  try {
    const { responseId } = req.params;
    const { evidence_urls } = req.body; // Array of URLs

    await query(`
      UPDATE audit_responses 
      SET evidence_attached = true, evidence_urls = $1
      WHERE id = $2
    `, [JSON.stringify(evidence_urls), responseId]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Upload evidence error:', error);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

// Add corrective action
router.post('/sessions/:id/corrective-actions', async (req, res) => {
  try {
    const { id } = req.params;
    const { response_id, issue_identified, risk_level, corrective_action, responsible_person_id, deadline } = req.body;

    const actionId = uuidv4();
    await query(`
      INSERT INTO audit_corrective_actions (
        id, session_id, response_id, issue_identified, risk_level, 
        corrective_action, responsible_person_id, deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [actionId, id, response_id, issue_identified, risk_level, corrective_action, responsible_person_id, deadline]);

    res.status(201).json({ id: actionId });
  } catch (error: any) {
    console.error('Add corrective action error:', error);
    res.status(500).json({ error: 'Failed to add corrective action' });
  }
});

// Update corrective action status
router.patch('/corrective-actions/:actionId', async (req, res) => {
  try {
    const { actionId } = req.params;
    const { status, completion_notes } = req.body;

    await query(`
      UPDATE audit_corrective_actions 
      SET status = $1, 
          completed_at = CASE WHEN $1 = 'Completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          completion_notes = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, completion_notes, actionId]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update corrective action error:', error);
    res.status(500).json({ error: 'Failed to update corrective action' });
  }
});

// Complete audit and calculate scores
router.post('/sessions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    // Calculate scores
    const responses = await query(
      'SELECT score, question_id FROM audit_responses WHERE session_id = $1',
      [id]
    );

    let totalScore = 0;
    let maxPossibleScore = 0;
    let applicableCount = 0;

    for (const r of responses) {
      const questionResult = await query(
        'SELECT max_score FROM audit_questions WHERE id = $1',
        [r.question_id]
      );
      const maxScore = questionResult[0]?.max_score || 100;

      if (r.score !== -1) { // Not N/A
        totalScore += r.score;
        maxPossibleScore += maxScore;
        applicableCount++;
      }
    }

    const compliancePercentage = maxPossibleScore > 0 
      ? Math.round((totalScore / maxPossibleScore) * 100) 
      : 0;

    // Determine risk level
    let riskLevel = 'Critical';
    if (compliancePercentage >= 85) riskLevel = 'Low';
    else if (compliancePercentage >= 70) riskLevel = 'Moderate';
    else if (compliancePercentage >= 50) riskLevel = 'High';

    await query(`
      UPDATE audit_sessions 
      SET status = 'Completed',
          total_score = $1,
          max_possible_score = $2,
          compliance_percentage = $3,
          risk_level = $4,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [totalScore, maxPossibleScore, compliancePercentage, riskLevel, id]);

    res.json({ 
      totalScore, 
      maxPossibleScore, 
      compliancePercentage, 
      riskLevel 
    });
  } catch (error: any) {
    console.error('Complete audit error:', error);
    res.status(500).json({ error: 'Failed to complete audit' });
  }
});

// Get audit analytics
router.get('/analytics/dashboard', async (req, res) => {
  try {
    // Overall stats
    const overallResult = await query(`
      SELECT 
        COUNT(*) as total_audits,
        AVG(compliance_percentage) as avg_compliance,
        COUNT(CASE WHEN risk_level = 'Critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN risk_level = 'High' THEN 1 END) as high_count,
        COUNT(CASE WHEN risk_level = 'Moderate' THEN 1 END) as moderate_count,
        COUNT(CASE WHEN risk_level = 'Low' THEN 1 END) as low_count
      FROM audit_sessions
      WHERE status = 'Completed'
    `);

    // Module-wise compliance (calculate from responses)
    const moduleResult = await query(`
      SELECT 
        q.module_name,
        AVG(CASE WHEN r.score >= 0 THEN r.score ELSE NULL END) as avg_score
      FROM audit_responses r
      JOIN audit_questions q ON q.id = r.question_id
      JOIN audit_sessions s ON s.id = r.session_id
      WHERE s.status = 'Completed'
      GROUP BY q.module_name
    `);

    // Trend over time
    const trendResult = await query(`
      SELECT 
        DATE_TRUNC('month', completed_at) as month,
        AVG(compliance_percentage) as avg_compliance
      FROM audit_sessions
      WHERE status = 'Completed' 
        AND completed_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', completed_at)
      ORDER BY month
    `);

    // Open corrective actions
    const actionsResult = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM audit_corrective_actions
      GROUP BY status
    `);

    // High risk vehicles
    const vehicleResult = await query(`
      SELECT 
        v.registration_num,
        s.compliance_percentage,
        s.risk_level
      FROM audit_sessions s
      CROSS JOIN jsonb_array_elements_text(s.vehicle_ids) as vid
      JOIN vehicles v ON v.id = vid::uuid
      WHERE s.status = 'Completed'
      ORDER BY s.compliance_percentage ASC
      LIMIT 10
    `);

    res.json({
      overall: overallResult[0],
      byModule: moduleResult,
      trend: trendResult,
      correctiveActions: actionsResult,
      highRiskVehicles: vehicleResult
    });
  } catch (error: any) {
    console.error('Audit analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get vehicle compliance report
router.get('/reports/vehicle-compliance', async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    
    let sql = `
      SELECT 
        v.registration_num,
        v.make_model,
        v.insurance_expiry,
        v.road_license_expiry,
        v.inspection_certificate_expiry,
        CASE 
          WHEN v.insurance_expiry < CURRENT_DATE THEN 'Expired'
          WHEN v.insurance_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
          ELSE 'Valid'
        END as insurance_status,
        CASE 
          WHEN v.road_license_expiry < CURRENT_DATE THEN 'Expired'
          WHEN v.road_license_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
          ELSE 'Valid'
        END as license_status
      FROM vehicles v
      WHERE v.status = 'Active'
    `;
    
    const params: any[] = [];
    if (vehicle_id) {
      sql += ' AND v.id = $1';
      params.push(vehicle_id);
    }
    
    sql += ' ORDER BY v.registration_num';
    
    const result = await query(sql, params);
    res.json(result);
  } catch (error: any) {
    console.error('Vehicle compliance report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
