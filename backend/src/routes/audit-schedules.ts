import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Calculate next run date based on frequency
const calculateNextRun = (schedule: any): Date | null => {
  const now = new Date();
  const { frequency, day_of_week, day_of_month, start_date } = schedule;
  
  let nextRun = new Date(start_date);
  
  // If start_date is in the future, use that
  if (nextRun > now) {
    return nextRun;
  }
  
  // Otherwise calculate next occurrence
  switch (frequency) {
    case 'daily':
      nextRun = new Date(now);
      nextRun.setDate(now.getDate() + 1);
      break;
      
    case 'weekly':
      nextRun = new Date(now);
      const currentDay = nextRun.getDay();
      const targetDay = day_of_week || 1; // Default to Monday
      const daysUntilTarget = (targetDay + 7 - currentDay) % 7 || 7;
      nextRun.setDate(now.getDate() + daysUntilTarget);
      break;
      
    case 'monthly':
      nextRun = new Date(now);
      const targetDayOfMonth = day_of_month || 1;
      nextRun.setDate(targetDayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
      
    case 'quarterly':
      nextRun = new Date(now);
      nextRun.setDate(day_of_month || 1);
      const currentQuarter = Math.floor(nextRun.getMonth() / 3);
      const nextQuarterMonth = (currentQuarter + 1) * 3;
      nextRun.setMonth(nextQuarterMonth);
      break;
      
    case 'yearly':
      nextRun = new Date(now);
      nextRun.setDate(day_of_month || 1);
      if (nextRun <= now) {
        nextRun.setFullYear(nextRun.getFullYear() + 1);
      }
      break;
      
    default:
      return null;
  }
  
  return nextRun;
};

// ========== AUDIT SCHEDULES ==========

// Get all schedules
router.get('/schedules', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, 
        t.template_name,
        a.staff_name as auditor_name
      FROM audit_schedules s
      LEFT JOIN audit_templates t ON t.id = s.template_id
      LEFT JOIN staff a ON a.id = s.auditor_id
      ORDER BY s.created_at DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create new schedule
router.post('/schedules', async (req: any, res) => {
  const { 
    template_id, schedule_name, frequency, day_of_week, day_of_month,
    start_date, end_date, auditor_id, branch 
  } = req.body;
  
  try {
    // Calculate next run
    const tempSchedule = { frequency, day_of_week, day_of_month, start_date };
    const nextRun = calculateNextRun(tempSchedule);
    
    const id = uuidv4();
    await query(`
      INSERT INTO audit_schedules (id, template_id, schedule_name, frequency, day_of_week, day_of_month, start_date, end_date, auditor_id, branch, next_run_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, template_id, schedule_name, frequency, day_of_week, day_of_month, start_date, end_date, auditor_id, branch, nextRun]);
    
    res.status(201).json({ id, message: 'Schedule created', next_run: nextRun });
  } catch (error: any) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule: ' + error.message });
  }
});

// Update schedule
router.put('/schedules/:id', async (req: any, res) => {
  const { id } = req.params;
  const { 
    schedule_name, frequency, day_of_week, day_of_month,
    start_date, end_date, auditor_id, branch, is_active 
  } = req.body;
  
  try {
    // Recalculate next run if frequency/start changed
    let nextRun = null;
    if (frequency || start_date !== undefined) {
      const current = await query('SELECT * FROM audit_schedules WHERE id = ?', [id]);
      if (current.length > 0) {
        const schedule = { ...current[0], ...req.body };
        if (is_active !== false) {
          nextRun = calculateNextRun(schedule);
        }
      }
    }
    
    let sql = 'UPDATE audit_schedules SET ';
    const updates: string[] = [];
    const params: any[] = [];
    
    if (schedule_name) { updates.push('schedule_name = ?'); params.push(schedule_name); }
    if (frequency) { updates.push('frequency = ?'); params.push(frequency); }
    if (day_of_week !== undefined) { updates.push('day_of_week = ?'); params.push(day_of_week); }
    if (day_of_month !== undefined) { updates.push('day_of_month = ?'); params.push(day_of_month); }
    if (start_date) { updates.push('start_date = ?'); params.push(start_date); }
    if (end_date !== undefined) { updates.push('end_date = ?'); params.push(end_date); }
    if (auditor_id !== undefined) { updates.push('auditor_id = ?'); params.push(auditor_id); }
    if (branch !== undefined) { updates.push('branch = ?'); params.push(branch); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (nextRun) { updates.push('next_run_at = ?'); params.push(nextRun); }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    sql += updates.join(', ') + ' WHERE id = ?';
    params.push(id);
    
    await query(sql, params);
    res.json({ message: 'Schedule updated', next_run: nextRun });
  } catch (error: any) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule: ' + error.message });
  }
});

// Delete schedule
router.delete('/schedules/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await query('DELETE FROM audit_schedules WHERE id = ?', [id]);
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ========== SCHEDULER JOB (called by cron) ==========

// Execute due schedules - call this endpoint from a cron job
router.post('/scheduler/run', async (req, res) => {
  try {
    // Find schedules that are due
    const dueSchedules = await query(`
      SELECT s.*, t.template_name
      FROM audit_schedules s
      JOIN audit_templates t ON t.id = s.template_id
      WHERE s.is_active = true
      AND s.next_run_at <= CURRENT_TIMESTAMP
      AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    `);
    
    const results = [];
    
    for (const schedule of dueSchedules) {
      try {
        // Generate audit number
        const year = new Date().getFullYear();
        const countResult = await query(
          "SELECT COUNT(*) as count FROM audit_sessions WHERE EXTRACT(YEAR FROM created_at) = ?",
          [year]
        );
        const count = parseInt(countResult[0].count) + 1;
        const auditNumber = `AUD-${year}-${String(count).padStart(4, '0')}`;
        
        // Create audit session
        const sessionId = uuidv4();
        await query(`
          INSERT INTO audit_sessions (id, audit_number, template_id, auditor_id, branch, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        `, [sessionId, auditNumber, schedule.template_id, schedule.auditor_id, schedule.branch]);
        
        // Create empty responses for all questions
        const questions = await query(
          'SELECT id FROM audit_questions WHERE template_id = ?',
          [schedule.template_id]
        );
        
        for (const q of questions) {
          await query(`
            INSERT INTO audit_responses (id, session_id, question_id, response, score)
            VALUES (?, ?, ?, 'Not Checked', 0)
          `, [uuidv4(), sessionId, q.id]);
        }
        
        // Record in history
        await query(`
          INSERT INTO audit_schedule_history (id, schedule_id, session_id)
          VALUES (?, ?, ?)
        `, [uuidv4(), schedule.id, sessionId]);
        
        // Update schedule with last run and next run
        const nextRun = calculateNextRun(schedule);
        await query(`
          UPDATE audit_schedules 
          SET last_run_at = CURRENT_TIMESTAMP, next_run_at = ?
          WHERE id = ?
        `, [nextRun, schedule.id]);
        
        results.push({ schedule_id: schedule.id, session_id: sessionId, audit_number: auditNumber, status: 'created' });
      } catch (err: any) {
        console.error(`Failed to run schedule ${schedule.id}:`, err);
        results.push({ schedule_id: schedule.id, error: err.message });
      }
    }
    
    res.json({ 
      message: `Processed ${dueSchedules.length} schedules`,
      results 
    });
  } catch (error: any) {
    console.error('Scheduler run error:', error);
    res.status(500).json({ error: 'Failed to run scheduler: ' + error.message });
  }
});

// Get schedule history
router.get('/schedules/:id/history', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await query(`
      SELECT h.*, s.audit_number, s.status, s.compliance_percentage, s.risk_level, s.completed_at
      FROM audit_schedule_history h
      JOIN audit_sessions s ON s.id = h.session_id
      WHERE h.schedule_id = ?
      ORDER BY h.created_at DESC
    `, [id]);
    
    res.json(result);
  } catch (error) {
    console.error('Get schedule history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
