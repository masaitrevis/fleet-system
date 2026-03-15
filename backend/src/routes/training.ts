import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ========== TRAINING COURSES ==========

// Get all training courses
router.get('/courses', async (req, res) => {
  try {
    const result = await query('SELECT * FROM training_courses ORDER BY course_name');
    res.json(result);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Create new course
router.post('/courses', async (req: any, res) => {
  const { course_code, course_name, description, category, duration_hours, validity_months, mandatory, provider } = req.body;
  
  try {
    const id = uuidv4();
    await query(`
      INSERT INTO training_courses (id, course_code, course_name, description, category, duration_hours, validity_months, mandatory, provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, course_code, course_name, description, category, duration_hours, validity_months, mandatory, provider]);
    
    res.status(201).json({ id, message: 'Course created' });
  } catch (error: any) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course: ' + error.message });
  }
});

// Update course
router.put('/courses/:id', async (req: any, res) => {
  const { id } = req.params;
  const { course_name, description, category, duration_hours, validity_months, mandatory, provider } = req.body;
  
  try {
    await query(`
      UPDATE training_courses 
      SET course_name = ?, description = ?, category = ?, duration_hours = ?, validity_months = ?, mandatory = ?, provider = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [course_name, description, category, duration_hours, validity_months, mandatory, provider, id]);
    
    res.json({ message: 'Course updated' });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Delete course
router.delete('/courses/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await query('DELETE FROM training_courses WHERE id = ?', [id]);
    res.json({ message: 'Course deleted' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ========== STAFF TRAINING RECORDS ==========

// Get all training records (with filters)
router.get('/records', async (req: any, res) => {
  const { staff_id, course_id, status, expiring_soon } = req.query;
  
  try {
    let sql = `
      SELECT st.*, 
        s.staff_name, s.staff_no, s.department, s.branch,
        tc.course_name, tc.course_code, tc.category, tc.validity_months, tc.mandatory
      FROM staff_training st
      JOIN staff s ON s.id = st.staff_id
      JOIN training_courses tc ON tc.id = st.course_id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (staff_id) {
      sql += ' AND st.staff_id = ?';
      params.push(staff_id);
    }
    if (course_id) {
      sql += ' AND st.course_id = ?';
      params.push(course_id);
    }
    if (status) {
      sql += ' AND st.status = ?';
      params.push(status);
    }
    if (expiring_soon === 'true') {
      sql += ' AND st.expiry_date IS NOT NULL AND st.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)';
    }
    
    sql += ' ORDER BY st.completion_date DESC';
    
    const result = await query(sql, params);
    res.json(result);
  } catch (error) {
    console.error('Get training records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Get training records for a specific staff member
router.get('/records/staff/:staffId', async (req, res) => {
  const { staffId } = req.params;
  
  try {
    const result = await query(`
      SELECT st.*, 
        tc.course_name, tc.course_code, tc.category, tc.validity_months, tc.mandatory
      FROM staff_training st
      JOIN training_courses tc ON tc.id = st.course_id
      WHERE st.staff_id = ?
      ORDER BY st.completion_date DESC
    `, [staffId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get staff training error:', error);
    res.status(500).json({ error: 'Failed to fetch staff training' });
  }
});

// Add training record
router.post('/records', async (req: any, res) => {
  const { staff_id, course_id, completion_date, score, certificate_number, notes } = req.body;
  
  try {
    // Get course validity
    const courseResult = await query('SELECT validity_months FROM training_courses WHERE id = ?', [course_id]);
    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const validityMonths = courseResult[0].validity_months;
    let expiryDate = null;
    
    if (validityMonths) {
      const completion = new Date(completion_date);
      expiryDate = new Date(completion.setMonth(completion.getMonth() + validityMonths));
    }
    
    // Determine status
    let status = 'Active';
    if (expiryDate) {
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) status = 'Expired';
      else if (daysUntilExpiry <= 30) status = 'Expiring Soon';
    }
    
    const id = uuidv4();
    await query(`
      INSERT INTO staff_training (id, staff_id, course_id, completion_date, expiry_date, score, status, certificate_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, staff_id, course_id, completion_date, expiryDate, score, status, certificate_number, notes]);
    
    res.status(201).json({ id, message: 'Training record added', expiry_date: expiryDate, status });
  } catch (error: any) {
    console.error('Add training record error:', error);
    res.status(500).json({ error: 'Failed to add record: ' + error.message });
  }
});

// Update training record
router.put('/records/:id', async (req: any, res) => {
  const { id } = req.params;
  const { completion_date, score, certificate_number, notes } = req.body;
  
  try {
    // Get current record to recalculate expiry
    const current = await query('SELECT course_id FROM staff_training WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const courseResult = await query('SELECT validity_months FROM training_courses WHERE id = ?', [current[0].course_id]);
    const validityMonths = courseResult[0]?.validity_months;
    
    let expiryDate = null;
    if (validityMonths && completion_date) {
      const completion = new Date(completion_date);
      expiryDate = new Date(completion.setMonth(completion.getMonth() + validityMonths));
    }
    
    // Determine status
    let status = 'Active';
    if (expiryDate) {
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) status = 'Expired';
      else if (daysUntilExpiry <= 30) status = 'Expiring Soon';
    }
    
    await query(`
      UPDATE staff_training 
      SET completion_date = ?, expiry_date = ?, score = ?, status = ?, certificate_number = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [completion_date, expiryDate, score, status, certificate_number, notes, id]);
    
    res.json({ message: 'Training record updated', expiry_date: expiryDate, status });
  } catch (error) {
    console.error('Update training record error:', error);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// Delete training record
router.delete('/records/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await query('DELETE FROM staff_training WHERE id = ?', [id]);
    res.json({ message: 'Training record deleted' });
  } catch (error) {
    console.error('Delete training record error:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ========== DASHBOARD & REPORTS ==========

// Get training dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Total staff with training
    const trainedStaff = await query(`
      SELECT COUNT(DISTINCT staff_id) as count FROM staff_training
    `);
    
    // Total certifications
    const totalCerts = await query(`
      SELECT COUNT(*) as count FROM staff_training WHERE status = 'Active'
    `);
    
    // Expiring soon (next 30 days)
    const expiringSoon = await query(`
      SELECT COUNT(*) as count FROM staff_training 
      WHERE expiry_date IS NOT NULL 
      AND expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)
      AND expiry_date >= CURRENT_DATE
    `);
    
    // Expired
    const expired = await query(`
      SELECT COUNT(*) as count FROM staff_training 
      WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
    `);
    
    // Missing mandatory training
    const missingMandatory = await query(`
      SELECT COUNT(*) as count FROM staff s
      WHERE s.role = 'Driver'
      AND s.id NOT IN (
        SELECT st.staff_id FROM staff_training st
        JOIN training_courses tc ON tc.id = st.course_id
        WHERE tc.mandatory = true AND st.status = 'Active'
      )
    `);
    
    // Training by category
    const byCategory = await query(`
      SELECT tc.category, COUNT(*) as count
      FROM staff_training st
      JOIN training_courses tc ON tc.id = st.course_id
      WHERE st.status = 'Active'
      GROUP BY tc.category
    `);
    
    res.json({
      trained_staff: trainedStaff[0]?.count || 0,
      active_certifications: totalCerts[0]?.count || 0,
      expiring_soon: expiringSoon[0]?.count || 0,
      expired: expired[0]?.count || 0,
      missing_mandatory: missingMandatory[0]?.count || 0,
      by_category: byCategory
    });
  } catch (error) {
    console.error('Training dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Get expiring certifications report
router.get('/reports/expiring', async (req: any, res) => {
  const { days = 30 } = req.query;
  
  try {
    const result = await query(`
      SELECT st.*, 
        s.staff_name, s.staff_no, s.department, s.email, s.phone,
        tc.course_name, tc.course_code, tc.mandatory
      FROM staff_training st
      JOIN staff s ON s.id = st.staff_id
      JOIN training_courses tc ON tc.id = st.course_id
      WHERE st.expiry_date IS NOT NULL 
      AND st.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
      ORDER BY st.expiry_date ASC
    `, [parseInt(days)]);
    
    res.json(result);
  } catch (error) {
    console.error('Expiring report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
