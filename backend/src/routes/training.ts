import { Router, Request, Response } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as aiService from '../services/ai';
import { authenticateToken } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

// Apply authentication to all training routes
router.use(authenticateToken);

// PASSING SCORE
const PASSING_SCORE = 70;
const MAX_ATTEMPTS = 3;

// Course folder mapping
const COURSE_FOLDERS: Record<string, string> = {
  'DEF-001': 'course-defensive-driving',
  'HOS-001': 'course-hos',
  'DVIR-001': 'course-dvir',
  'ACC-001': 'course-accident',
  'DRUG-001': 'course-drug'
};

// ========== COURSES ==========

// Get all courses
router.get('/courses', async (req, res) => {
  try {
    const { category, mandatory } = req.query;
    
    let sql = 'SELECT * FROM training_courses WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (mandatory === 'true') {
      sql += ' AND mandatory = true';
    }
    
    sql += ' ORDER BY mandatory DESC, course_name';
    
    const courses = await query(sql, params);
    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Create new course (admin/manager only)
router.post('/courses', async (req: any, res) => {
  try {
    const userRole = req.user?.role;
    if (!['admin', 'manager', 'transport_supervisor'].includes(userRole)) {
      return res.status(403).json({ error: 'Only managers can create courses' });
    }
    
    const { course_code, course_name, description, category, duration_hours, validity_months, mandatory } = req.body;
    
    const courseId = uuidv4();
    await query(`
      INSERT INTO training_courses (id, course_code, course_name, description, category, duration_hours, validity_months, mandatory, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [courseId, course_code, course_name, description, category, duration_hours, validity_months || null, mandatory || false, req.user?.staffId]);
    
    res.status(201).json({ id: courseId, message: 'Course created' });
  } catch (error: any) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course: ' + error.message });
  }
});

// ========== SLIDES FROM FILES ==========

// Get slides for a course from file system
router.get('/courses/:id/slides', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get course info to find the folder
    const courseResult = await query('SELECT course_code FROM training_courses WHERE id = $1', [id]);
    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const courseCode = courseResult[0].course_code;
    const folderName = COURSE_FOLDERS[courseCode];
    
    if (!folderName) {
      return res.status(404).json({ error: 'Slide content not available for this course' });
    }
    
    const slidesDir = path.join(__dirname, '..', '..', '..', 'courses', folderName, 'slides');
    
    // Check if directory exists
    if (!fs.existsSync(slidesDir)) {
      return res.status(404).json({ error: 'Slides directory not found' });
    }
    
    // Read all slide files
    const files = fs.readdirSync(slidesDir)
      .filter(f => f.endsWith('.md'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    
    const slides = files.map((file, index) => {
      const content = fs.readFileSync(path.join(slidesDir, file), 'utf-8');
      const lines = content.split('\n');
      const title = lines[0]?.replace('# ', '') || `Slide ${index + 1}`;
      
      return {
        id: `${id}-slide-${index + 1}`,
        course_id: id,
        slide_order: index + 1,
        title: title,
        content: content,
        duration_minutes: 5
      };
    });
    
    res.json(slides);
  } catch (error: any) {
    console.error('Get slides error:', error);
    res.status(500).json({ error: 'Failed to fetch slides: ' + error.message });
  }
});

// Get course with slides
router.get('/courses/:id/full', async (req, res) => {
  const { id } = req.params;
  
  try {
    const courseResult = await query('SELECT * FROM training_courses WHERE id = $1', [id]);
    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const course = courseResult[0];
    const folderName = COURSE_FOLDERS[course.course_code];
    
    let slides: any[] = [];
    
    if (folderName) {
      const slidesDir = path.join(__dirname, '..', '..', '..', 'courses', folderName, 'slides');
      
      if (fs.existsSync(slidesDir)) {
        const files = fs.readdirSync(slidesDir)
          .filter(f => f.endsWith('.md'))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0');
            const numB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0');
            return numA - numB;
          });
        
        slides = files.map((file, index) => {
          const content = fs.readFileSync(path.join(slidesDir, file), 'utf-8');
          const lines = content.split('\n');
          const title = lines[0]?.replace('# ', '') || `Slide ${index + 1}`;
          
          return {
            id: `${id}-slide-${index + 1}`,
            course_id: id,
            slide_order: index + 1,
            title: title,
            content: content,
            duration_minutes: 5
          };
        });
      }
    }
    
    // Fallback to database slides if no file slides
    if (slides.length === 0) {
      slides = await query(
        'SELECT * FROM training_slides WHERE course_id = $1 ORDER BY slide_order',
        [id]
      );
    }
    
    res.json({ ...course, slides });
  } catch (error: any) {
    console.error('Get course full error:', error);
    res.status(500).json({ error: 'Failed to fetch course: ' + error.message });
  }
});

// ========== QUIZ GENERATION ==========

// Generate quiz questions based on course content
router.post('/courses/:id/generate-quiz', async (req: any, res) => {
  const { id } = req.params;
  const { num_questions = 5 } = req.body;
  const staffId = req.user?.staffId;
  
  try {
    // Get course and slides
    const courseResult = await query('SELECT * FROM training_courses WHERE id = $1', [id]);
    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const course = courseResult[0];
    const folderName = COURSE_FOLDERS[course.course_code];
    
    let content = '';
    
    // Read all slide content
    if (folderName) {
      const slidesDir = path.join(__dirname, '..', '..', '..', 'courses', folderName, 'slides');
      if (fs.existsSync(slidesDir)) {
        const files = fs.readdirSync(slidesDir).filter(f => f.endsWith('.md')).sort();
        for (const file of files) {
          content += fs.readFileSync(path.join(slidesDir, file), 'utf-8') + '\n\n';
        }
      }
    }
    
    // Fallback to database content
    if (!content) {
      const slides = await query('SELECT content FROM training_slides WHERE course_id = $1', [id]);
      content = slides.map((s: any) => s.content).join('\n\n');
    }
    
    // Generate questions using AI based on slide content
    const questions = await aiService.generateTrainingQuestions(content, num_questions);
    
    // Save questions to database
    for (const q of questions) {
      const questionId = uuidv4();
      await query(`
        INSERT INTO training_quiz_questions (id, course_id, question_text, option_a, option_b, option_c, option_d, correct_answer, ai_generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        questionId,
        id,
        q.question,
        q.options[0],
        q.options[1],
        q.options[2],
        q.options[3],
        q.correctAnswer,
        true
      ]);
    }
    
    res.json({ message: `Generated ${questions.length} questions`, count: questions.length });
  } catch (error: any) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ error: 'Failed to generate quiz: ' + error.message });
  }
});

// Get quiz questions for a course
router.get('/courses/:id/quiz', async (req: any, res) => {
  const { id } = req.params;
  const { exclude_used, enrollment_id } = req.query;
  const staffId = req.user?.staffId;
  
  try {
    let sql = 'SELECT * FROM training_quiz_questions WHERE course_id = $1';
    const params: any[] = [id];
    
    if (exclude_used === 'true' && enrollment_id) {
      sql += ` AND id NOT IN (
        SELECT question_id FROM training_quiz_attempts 
        WHERE enrollment_id = $2
      )`;
      params.push(enrollment_id);
    }
    
    sql += ' ORDER BY RANDOM() LIMIT 10';
    
    const questions = await query(sql, params);
    
    // If no questions exist, generate them
    if (questions.length === 0) {
      return res.json([]);
    }
    
    // Remove correct_answer from response
    const sanitizedQuestions = questions.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d
    }));
    
    res.json(sanitizedQuestions);
  } catch (error: any) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz questions' });
  }
});

// ========== ENROLLMENTS ==========

// Enroll in a course
router.post('/enroll', async (req: any, res) => {
  const { staff_id, course_id } = req.body;
  
  try {
    // Check if already enrolled
    const existing = await query(
      'SELECT * FROM training_enrollments WHERE staff_id = $1 AND course_id = $2',
      [staff_id, course_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }
    
    const enrollmentId = uuidv4();
    await query(`
      INSERT INTO training_enrollments (id, staff_id, course_id, status)
      VALUES ($1, $2, $3, 'enrolled')
    `, [enrollmentId, staff_id, course_id]);
    
    res.status(201).json({ id: enrollmentId, message: 'Enrolled successfully' });
  } catch (error: any) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'Failed to enroll: ' + error.message });
  }
});

// Get my enrollments
router.get('/my-enrollments', async (req: any, res) => {
  const staffId = req.user?.staffId;
  
  try {
    const result = await query(`
      SELECT e.*, c.course_name, c.course_code, c.category, c.duration_hours
      FROM training_enrollments e
      JOIN training_courses c ON c.id = e.course_id
      WHERE e.staff_id = $1
      ORDER BY e.enrolled_at DESC
    `, [staffId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// Update progress
router.post('/enrollments/:id/progress', async (req: any, res) => {
  const { id } = req.params;
  const { slide_number } = req.body;
  
  try {
    await query(`
      UPDATE training_enrollments 
      SET current_slide = $1, status = CASE WHEN status = 'enrolled' THEN 'in_progress' ELSE status END
      WHERE id = $2
    `, [slide_number, id]);
    
    res.json({ message: 'Progress updated' });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ========== QUIZ ATTEMPTS ==========

// Submit quiz
router.post('/enrollments/:id/quiz-submit', async (req: any, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  const staffId = req.user?.staffId;
  
  try {
    // Get enrollment and course info
    const enrollment = await query(`
      SELECT e.*, c.course_name FROM training_enrollments e
      JOIN training_courses c ON c.id = e.course_id
      WHERE e.id = $1 AND e.staff_id = $2
    `, [id, staffId]);
    
    if (enrollment.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    // Check attempts
    const attempts = await query(
      'SELECT COUNT(*) as count FROM training_quiz_attempts WHERE enrollment_id = $1',
      [id]
    );
    const attemptNumber = parseInt(attempts[0].count) + 1;
    
    if (attemptNumber > MAX_ATTEMPTS) {
      // Lock enrollment
      await query("UPDATE training_enrollments SET status = 'locked', locked_reason = 'Maximum quiz attempts exceeded' WHERE id = $1", [id]);
      return res.status(403).json({ error: 'Maximum attempts reached. Contact your manager.' });
    }
    
    // Grade quiz
    let correct = 0;
    const totalQuestions = Object.keys(answers).length;
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = await query('SELECT correct_answer FROM training_quiz_questions WHERE id = $1', [questionId]);
      if (question.length > 0 && question[0].correct_answer === answer) {
        correct++;
      }
      
      // Record attempt
      await query(`
        INSERT INTO training_quiz_attempts (id, enrollment_id, question_id, answer_given, is_correct, attempt_number)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), id, questionId, answer, question[0]?.correct_answer === answer, attemptNumber]);
    }
    
    const score = Math.round((correct / totalQuestions) * 100);
    const passed = score >= PASSING_SCORE;
    
    // Update enrollment status
    const newStatus = passed ? 'passed' : attemptNumber >= MAX_ATTEMPTS ? 'failed' : 'quiz_pending';
    await query(`
      UPDATE training_enrollments 
      SET status = $1, quiz_score = $2, quiz_attempts = $3, completed_at = CASE WHEN $1 = 'passed' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = $4
    `, [newStatus, score, attemptNumber, id]);
    
    // Generate certificate if passed
    if (passed) {
      await generateCertificate(id, staffId, enrollment[0].course_id, score);
    }
    
    res.json({
      score,
      correct_answers: correct,
      total_questions: totalQuestions,
      passed,
      attempts_remaining: passed ? 0 : MAX_ATTEMPTS - attemptNumber,
      status: newStatus,
      attempt_number: attemptNumber
    });
  } catch (error: any) {
    console.error('Quiz submit error:', error);
    res.status(500).json({ error: 'Failed to submit quiz: ' + error.message });
  }
});

// ========== CERTIFICATES ==========

async function generateCertificate(enrollmentId: string, staffId: string, courseId: string, score: number) {
  try {
    const staff = await query('SELECT staff_name FROM staff WHERE id = $1', [staffId]);
    const course = await query('SELECT course_name, validity_months FROM training_courses WHERE id = $1', [courseId]);
    
    if (staff.length === 0 || course.length === 0) return;
    
    const year = new Date().getFullYear();
    const countResult = await query(
      'SELECT COUNT(*) as count FROM training_certificates WHERE EXTRACT(YEAR FROM issue_date) = $1',
      [year]
    );
    const count = parseInt(countResult[0].count) + 1;
    const certNumber = `CERT-${year}-${String(count).padStart(5, '0')}`;
    
    let expiryDate = null;
    if (course[0].validity_months) {
      const issueDate = new Date();
      expiryDate = new Date(issueDate.setMonth(issueDate.getMonth() + course[0].validity_months));
    }
    
    const certId = uuidv4();
    await query(`
      INSERT INTO training_certificates (id, certificate_number, enrollment_id, staff_id, course_id, issue_date, expiry_date, score)
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7)
    `, [certId, certNumber, enrollmentId, staffId, courseId, expiryDate, score]);
    
    return certNumber;
  } catch (error) {
    console.error('Generate certificate error:', error);
  }
}

// Get my certificates
router.get('/my-certificates', async (req: any, res) => {
  const staffId = req.user?.staffId;
  
  try {
    const result = await query(`
      SELECT c.*, 
        tc.course_name, tc.course_code, tc.category, tc.duration_hours,
        s.staff_name
      FROM training_certificates c
      JOIN training_courses tc ON tc.id = c.course_id
      JOIN staff s ON s.id = c.staff_id
      WHERE c.staff_id = $1
      ORDER BY c.issue_date DESC
    `, [staffId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// Get certificate PDF data
router.get('/certificates/:id/data', async (req: any, res) => {
  const { id } = req.params;
  
  try {
    const result = await query(`
      SELECT c.*, 
        s.staff_name, s.staff_no,
        tc.course_name, tc.duration_hours
      FROM training_certificates c
      JOIN staff s ON s.id = c.staff_id
      JOIN training_courses tc ON tc.id = c.course_id
      WHERE c.id = $1 AND c.staff_id = $2
    `, [id, req.user?.staffId]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Get certificate data error:', error);
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

// ========== MANAGER FUNCTIONS ==========

// Get locked enrollments
router.get('/locked', async (req: any, res) => {
  const userRole = req.user?.role;
  if (!['admin', 'manager', 'transport_supervisor'].includes(userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const result = await query(`
      SELECT e.*, s.staff_name, s.staff_no, s.department,
             c.course_name, c.course_code
      FROM training_enrollments e
      JOIN staff s ON s.id = e.staff_id
      JOIN training_courses c ON c.id = e.course_id
      WHERE e.status = 'locked'
      ORDER BY e.locked_at DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get locked enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch locked enrollments' });
  }
});

// Unlock enrollment
router.post('/enrollments/:id/unlock', async (req: any, res) => {
  const { id } = req.params;
  const userRole = req.user?.role;
  
  if (!['admin', 'manager', 'transport_supervisor'].includes(userRole)) {
    return res.status(403).json({ error: 'Only managers can unlock' });
  }
  
  try {
    await query(`
      UPDATE training_enrollments 
      SET status = 'enrolled', locked_reason = NULL, quiz_attempts = 0
      WHERE id = $1
    `, [id]);
    
    res.json({ message: 'Enrollment unlocked' });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ error: 'Failed to unlock' });
  }
});

export default router;
