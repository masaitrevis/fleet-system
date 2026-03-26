import { Router, Request, Response } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { allAuditTemplates, getMaturityRating } from '../../../shared/auditTemplates';

const router = Router();

// Apply authentication to all audit routes
router.use(authenticateToken);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Generate unique audit number
const generateAuditNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const result = await query(
    "SELECT COUNT(*) as count FROM audit_sessions WHERE EXTRACT(YEAR FROM created_at) = $1",
    [year]
  );
  const count = parseInt(result[0].count) + 1;
  return `AUD-${year}-${String(count).padStart(4, '0')}`;
};

// Calculate maturity rating based on total score
const calculateMaturityRating = (totalScore: number): string => {
  if (totalScore >= 170) return 'World Class';
  if (totalScore >= 140) return 'Strong';
  if (totalScore >= 100) return 'Developing';
  if (totalScore >= 60) return 'Weak';
  return 'High Risk';
};

// Calculate risk level based on compliance percentage
const calculateRiskLevel = (compliancePercentage: number): string => {
  if (compliancePercentage >= 85) return 'Low';
  if (compliancePercentage >= 70) return 'Moderate';
  if (compliancePercentage >= 50) return 'High';
  return 'Critical';
};

// Initialize audit templates in database
const initializeAuditTemplates = async (): Promise<void> => {
  try {
    // Check if templates already exist
    const existing = await query('SELECT COUNT(*) as count FROM audit_templates');
    if (parseInt(existing[0].count) > 0) return;

    console.log('📝 Initializing audit templates...');

    for (const template of allAuditTemplates) {
      // Insert template
      await query(
        `INSERT INTO audit_templates (id, template_name, description, category, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [template.id, template.template_name, template.description, template.category, true, null]
      );

      // Insert questions
      for (const q of template.questions) {
        await query(
          `INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, max_score, requires_evidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [q.id, template.id, q.module_name, q.question_text, q.question_order, q.max_score, q.requires_evidence]
        );
      }
    }

    console.log(`✅ Initialized ${allAuditTemplates.length} audit templates with ${allAuditTemplates.reduce((sum, t) => sum + t.questions.length, 0)} questions`);
  } catch (error) {
    console.error('Error initializing audit templates:', error);
  }
};

// Initialize templates on module load
initializeAuditTemplates();

// =============================================================================
// TEMPLATE ROUTES
// =============================================================================

// Get all audit templates
router.get('/templates', async (req: Request, res: Response) => {
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

// Get single template with questions
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const templateResult = await query(
      'SELECT * FROM audit_templates WHERE id = $1 AND is_active = true',
      [id]
    );
    
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

// =============================================================================
// AUDIT SESSION ROUTES
// =============================================================================

// Get all audit sessions
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { status, template_id, auditor_id } = req.query;
    
    let sql = `
      SELECT s.*, 
        t.template_name,
        a.staff_name as auditor_name,
        COUNT(r.id) as responses_count
      FROM audit_sessions s
      LEFT JOIN audit_templates t ON t.id = s.template_id
      LEFT JOIN staff a ON a.id = s.auditor_id
      LEFT JOIN audit_responses r ON r.session_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (status) {
      sql += ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    if (template_id) {
      sql += ` AND s.template_id = $${params.length + 1}`;
      params.push(template_id);
    }
    if (auditor_id) {
      sql += ` AND s.auditor_id = $${params.length + 1}`;
      params.push(auditor_id);
    }
    
    sql += ` GROUP BY s.id, t.template_name, a.staff_name ORDER BY s.created_at DESC`;
    
    const result = await query(sql, params);
    res.json(result);
  } catch (error: any) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch audit sessions' });
  }
});

// Get single audit session with full details
router.get('/sessions/:id', async (req: Request, res: Response) => {
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
      SELECT r.*, q.module_name, q.question_text, q.max_score, q.requires_evidence, q.question_order
      FROM audit_responses r
      JOIN audit_questions q ON q.id = r.question_id
      WHERE r.session_id = $1
      ORDER BY q.question_order
    `, [id]);

    // Get corrective actions
    const correctiveActions = await query(`
      SELECT ca.*, s.staff_name as responsible_person_name
      FROM audit_corrective_actions ca
      LEFT JOIN staff s ON s.id = ca.responsible_person_id
      WHERE ca.session_id = $1
      ORDER BY ca.created_at DESC
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

// Create new audit session
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { template_id, branch, department } = req.body;
    const auditorId = (req as any).user?.staffId || (req as any).user?.id;
    
    if (!template_id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Verify template exists
    const templateResult = await query(
      'SELECT * FROM audit_templates WHERE id = $1 AND is_active = true',
      [template_id]
    );
    
    if (templateResult.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const auditNumber = await generateAuditNumber();
    const sessionId = uuidv4();
    
    await query(`
      INSERT INTO audit_sessions (
        id, audit_number, template_id, branch, department, auditor_id, status, audit_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
    `, [sessionId, auditNumber, template_id, branch || null, department || null, auditorId, 'In Progress']);

    // Get template questions and create empty responses
    const questions = await query(
      'SELECT id FROM audit_questions WHERE template_id = $1 ORDER BY question_order',
      [template_id]
    );

    for (const q of questions) {
      await query(
        'INSERT INTO audit_responses (id, session_id, question_id, score) VALUES ($1, $2, $3, $4)',
        [uuidv4(), sessionId, q.id, 0] // Default score to 0 (Not Implemented)
      );
    }

    // Return the created session
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

// Update audit session
router.patch('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { branch, department, status } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (branch !== undefined) {
      updates.push(`branch = $${values.length + 1}`);
      values.push(branch);
    }
    if (department !== undefined) {
      updates.push(`department = $${values.length + 1}`);
      values.push(department);
    }
    if (status !== undefined) {
      updates.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    
    await query(
      `UPDATE audit_sessions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`,
      values
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update audit session' });
  }
});

// Delete audit session
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete related records first
    await query('DELETE FROM audit_corrective_actions WHERE session_id = $1', [id]);
    await query('DELETE FROM audit_responses WHERE session_id = $1', [id]);
    await query('DELETE FROM audit_sessions WHERE id = $1', [id]);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete audit session' });
  }
});

// Complete audit session
router.post('/sessions/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Calculate scores
    const responses = await query(
      'SELECT score, question_id FROM audit_responses WHERE session_id = $1',
      [id]
    );

    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const r of responses) {
      const questionResult = await query(
        'SELECT max_score FROM audit_questions WHERE id = $1',
        [r.question_id]
      );
      const maxScore = questionResult[0]?.max_score || 2;
      totalScore += r.score || 0;
      maxPossibleScore += maxScore;
    }

    const compliancePercentage = maxPossibleScore > 0 
      ? Math.round((totalScore / maxPossibleScore) * 100 * 10) / 10
      : 0;

    const riskLevel = calculateRiskLevel(compliancePercentage);
    const maturityRating = calculateMaturityRating(totalScore);

    await query(`
      UPDATE audit_sessions 
      SET status = 'Completed',
          total_score = $1,
          max_possible_score = $2,
          compliance_percentage = $3,
          risk_level = $4,
          maturity_rating = $5,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `, [totalScore, maxPossibleScore, compliancePercentage, riskLevel, maturityRating, id]);

    res.json({ 
      totalScore, 
      maxPossibleScore, 
      compliancePercentage, 
      riskLevel,
      maturityRating
    });
  } catch (error: any) {
    console.error('Complete audit error:', error);
    res.status(500).json({ error: 'Failed to complete audit' });
  }
});

// =============================================================================
// RESPONSE ROUTES
// =============================================================================

// Update audit response
router.patch('/responses/:responseId', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;
    const { score, notes } = req.body;
    
    await query(`
      UPDATE audit_responses 
      SET score = $1, 
          notes = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [score, notes || null, responseId]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update response error:', error);
    res.status(500).json({ error: 'Failed to update response' });
  }
});

// Bulk update responses
router.patch('/sessions/:id/responses', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { responses } = req.body;
    
    for (const r of responses) {
      await query(`
        UPDATE audit_responses 
        SET score = $1, 
            notes = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND session_id = $4
      `, [r.score, r.notes || null, r.response_id, id]);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Bulk update responses error:', error);
    res.status(500).json({ error: 'Failed to update responses' });
  }
});

// =============================================================================
// CORRECTIVE ACTION ROUTES
// =============================================================================

// Get corrective actions for a session
router.get('/sessions/:id/corrective-actions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const actions = await query(`
      SELECT ca.*, s.staff_name as responsible_person_name
      FROM audit_corrective_actions ca
      LEFT JOIN staff s ON s.id = ca.responsible_person_id
      WHERE ca.session_id = $1
      ORDER BY ca.created_at DESC
    `, [id]);
    
    res.json(actions);
  } catch (error: any) {
    console.error('Get corrective actions error:', error);
    res.status(500).json({ error: 'Failed to fetch corrective actions' });
  }
});

// Create corrective action
router.post('/sessions/:id/corrective-actions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { response_id, issue_identified, corrective_action, responsible_person_id, deadline } = req.body;

    const actionId = uuidv4();
    await query(`
      INSERT INTO audit_corrective_actions (
        id, session_id, response_id, issue_identified, corrective_action, 
        responsible_person_id, deadline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open')
    `, [actionId, id, response_id, issue_identified, corrective_action, responsible_person_id || null, deadline || null]);

    res.status(201).json({ id: actionId });
  } catch (error: any) {
    console.error('Create corrective action error:', error);
    res.status(500).json({ error: 'Failed to create corrective action' });
  }
});

// Update corrective action
router.patch('/corrective-actions/:actionId', async (req: Request, res: Response) => {
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
    `, [status, completion_notes || null, actionId]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update corrective action error:', error);
    res.status(500).json({ error: 'Failed to update corrective action' });
  }
});

// Delete corrective action
router.delete('/corrective-actions/:actionId', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    await query('DELETE FROM audit_corrective_actions WHERE id = $1', [actionId]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete corrective action error:', error);
    res.status(500).json({ error: 'Failed to delete corrective action' });
  }
});

// =============================================================================
// ANALYTICS ROUTES
// =============================================================================

// Get audit analytics dashboard
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    // Overall stats
    const overallResult = await query(`
      SELECT 
        COUNT(*) as total_audits,
        AVG(total_score) as avg_score,
        AVG(compliance_percentage) as avg_compliance,
        COUNT(CASE WHEN risk_level = 'Critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN risk_level = 'High' THEN 1 END) as high_count,
        COUNT(CASE WHEN risk_level = 'Moderate' THEN 1 END) as moderate_count,
        COUNT(CASE WHEN risk_level = 'Low' THEN 1 END) as low_count
      FROM audit_sessions
      WHERE status = 'Completed'
    `);

    // Template-wise performance
    const templateResult = await query(`
      SELECT 
        t.id as template_id,
        t.template_name,
        COUNT(s.id) as audit_count,
        AVG(s.total_score) as avg_score,
        AVG(s.compliance_percentage) as avg_compliance
      FROM audit_sessions s
      JOIN audit_templates t ON t.id = s.template_id
      WHERE s.status = 'Completed'
      GROUP BY t.id, t.template_name
      ORDER BY t.template_name
    `);

    // Trend over time
    const trendResult = await query(`
      SELECT 
        DATE_TRUNC('month', completed_at) as month,
        AVG(compliance_percentage) as avg_compliance,
        COUNT(*) as audit_count
      FROM audit_sessions
      WHERE status = 'Completed' 
        AND completed_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', completed_at)
      ORDER BY month
    `);

    // Maturity distribution
    const maturityResult = await query(`
      SELECT 
        maturity_rating as rating,
        COUNT(*) as count
      FROM audit_sessions
      WHERE status = 'Completed'
      GROUP BY maturity_rating
    `);

    // Corrective actions summary
    const actionsResult = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM audit_corrective_actions
      GROUP BY status
    `);

    res.json({
      overall: overallResult[0],
      byTemplate: templateResult,
      trend: trendResult,
      maturityDistribution: maturityResult,
      correctiveActions: actionsResult
    });
  } catch (error: any) {
    console.error('Audit analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get template comparison analytics
router.get('/analytics/template-comparison', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        t.template_name,
        q.module_name,
        AVG(r.score) as avg_score,
        COUNT(CASE WHEN r.score = 0 THEN 1 END) as not_implemented_count,
        COUNT(CASE WHEN r.score = 1 THEN 1 END) as partially_implemented_count,
        COUNT(CASE WHEN r.score = 2 THEN 1 END) as fully_implemented_count
      FROM audit_responses r
      JOIN audit_questions q ON q.id = r.question_id
      JOIN audit_templates t ON t.id = q.template_id
      JOIN audit_sessions s ON s.id = r.session_id
      WHERE s.status = 'Completed'
      GROUP BY t.template_name, q.module_name
      ORDER BY t.template_name, q.module_name
    `);
    
    res.json(result);
  } catch (error: any) {
    console.error('Template comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch template comparison' });
  }
});

// =============================================================================
// PDF EXPORT ROUTE
// =============================================================================

// Generate PDF report for audit session
router.get('/sessions/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get session details
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

    const session = sessionResult[0];

    // Get responses
    const responses = await query(`
      SELECT r.*, q.module_name, q.question_text, q.question_order
      FROM audit_responses r
      JOIN audit_questions q ON q.id = r.question_id
      WHERE r.session_id = $1
      ORDER BY q.question_order
    `, [id]);

    // Get corrective actions
    const correctiveActions = await query(`
      SELECT ca.*, s.staff_name as responsible_person_name
      FROM audit_corrective_actions ca
      LEFT JOIN staff s ON s.id = ca.responsible_person_id
      WHERE ca.session_id = $1
    `, [id]);

    // Generate simple HTML-based PDF content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Audit Report - ${session.audit_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
          h2 { color: #1e40af; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .header { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
          .info-item { display: flex; justify-content: space-between; }
          .info-label { font-weight: bold; color: #6b7280; }
          .score-card { background: #dbeafe; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .score-value { font-size: 48px; font-weight: bold; color: #1e40af; }
          .score-label { font-size: 14px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .score-0 { color: #dc2626; font-weight: bold; }
          .score-1 { color: #d97706; font-weight: bold; }
          .score-2 { color: #16a34a; font-weight: bold; }
          .risk-low { background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; }
          .risk-moderate { background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; }
          .risk-high { background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 12px; }
          .risk-critical { background: #f3e8ff; color: #6b21a8; padding: 4px 12px; border-radius: 12px; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>📋 Fleet Audit Report</h1>
        
        <div class="header">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Audit Number:</span>
              <span>${session.audit_number}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Template:</span>
              <span>${session.template_name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Branch:</span>
              <span>${session.branch || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Department:</span>
              <span>${session.department || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Auditor:</span>
              <span>${session.auditor_name || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date:</span>
              <span>${new Date(session.audit_date || session.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div class="score-card">
          <div class="score-value">${session.total_score || 0}/200</div>
          <div class="score-label">Total Score</div>
          <div style="margin-top: 15px;">
            <span class="${session.risk_level === 'Low' ? 'risk-low' : session.risk_level === 'Moderate' ? 'risk-moderate' : session.risk_level === 'High' ? 'risk-high' : 'risk-critical'}">
              ${session.risk_level || 'N/A'} Risk
            </span>
            <span style="margin-left: 10px; font-weight: bold;">
              ${session.maturity_rating || 'Not Rated'}
            </span>
          </div>
          <div style="margin-top: 10px; font-size: 18px;">
            Compliance: ${session.compliance_percentage?.toFixed(1) || 0}%
          </div>
        </div>

        <h2>Audit Questions & Responses</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Module</th>
              <th>Question</th>
              <th>Score</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${responses.map((r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${r.module_name}</td>
                <td>${r.question_text}</td>
                <td class="score-${r.score}">${r.score === 0 ? 'Not Implemented' : r.score === 1 ? 'Partially Implemented' : 'Fully Implemented'}</td>
                <td>${r.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${correctiveActions.length > 0 ? `
          <h2>Corrective Actions</h2>
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Action</th>
                <th>Responsible</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${correctiveActions.map(a => `
                <tr>
                  <td>${a.issue_identified}</td>
                  <td>${a.corrective_action}</td>
                  <td>${a.responsible_person_name || 'Unassigned'}</td>
                  <td>${a.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="footer">
          <p>Generated by FleetPro Audit Module</p>
          <p>Report generated on: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    // Set headers for HTML response (browser can print to PDF)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="audit-report-${session.audit_number}.html"`);
    res.send(htmlContent);
    
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// =============================================================================
// BENCHMARKING ROUTES
// =============================================================================

// Get industry benchmarks (placeholder for external data)
router.get('/benchmarks/industry', async (req: Request, res: Response) => {
  try {
    // This would typically fetch from an external API or database
    // For now, return sample benchmark data
    const benchmarks = [
      { category: 'Fleet Policy & Governance', industry_avg: 14.5, top_quartile: 18, bottom_quartile: 10 },
      { category: 'Vehicle Acquisition & Disposal', industry_avg: 13.2, top_quartile: 17, bottom_quartile: 9 },
      { category: 'Driver Management & Safety', industry_avg: 15.1, top_quartile: 19, bottom_quartile: 11 },
      { category: 'Vehicle Maintenance & Inspections', industry_avg: 14.8, top_quartile: 18, bottom_quartile: 10 },
      { category: 'Fuel Management & Efficiency', industry_avg: 12.5, top_quartile: 16, bottom_quartile: 8 },
      { category: 'Compliance & Regulatory', industry_avg: 16.2, top_quartile: 19, bottom_quartile: 12 },
      { category: 'Risk Management & Insurance', industry_avg: 13.8, top_quartile: 17, bottom_quartile: 10 },
      { category: 'Data Management & Telematics', industry_avg: 11.5, top_quartile: 15, bottom_quartile: 7 },
      { category: 'Environmental & Sustainability', industry_avg: 10.2, top_quartile: 14, bottom_quartile: 6 },
      { category: 'Financial Management & Cost Control', industry_avg: 13.5, top_quartile: 17, bottom_quartile: 9 }
    ];
    
    res.json(benchmarks);
  } catch (error: any) {
    console.error('Benchmark error:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarks' });
  }
});

export default router;
