import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// PASSING SCORE
const PASSING_SCORE = 70;
const MAX_ATTEMPTS = 3;

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

// ========== COURSES WITH SLIDES ==========

// Get course with slides
router.get('/courses/:id/full', async (req, res) => {
  const { id } = req.params;
  
  try {
    const courseResult = await query('SELECT * FROM training_courses WHERE id = $1', [id]);
    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const slides = await query(
      'SELECT * FROM training_slides WHERE course_id = $1 ORDER BY slide_order',
      [id]
    );
    
    res.json({ ...courseResult[0], slides });
  } catch (error) {
    console.error('Get course full error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// Add slide to course
router.post('/courses/:id/slides', async (req: any, res) => {
  const { id } = req.params;
  const { title, content, media_url, duration_minutes } = req.body;
  
  try {
    const maxOrder = await query(
      'SELECT MAX(slide_order) as max_order FROM training_slides WHERE course_id = $1',
      [id]
    );
    const slideOrder = (maxOrder[0]?.max_order || 0) + 1;
    
    const slideId = uuidv4();
    await query(`
      INSERT INTO training_slides (id, course_id, slide_order, title, content, media_url, duration_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [slideId, id, slideOrder, title, content, media_url, duration_minutes || 5]);
    
    res.status(201).json({ id: slideId, message: 'Slide added' });
  } catch (error: any) {
    console.error('Add slide error:', error);
    res.status(500).json({ error: 'Failed to add slide: ' + error.message });
  }
});

// ========== AI QUIZ GENERATION ==========

// Generate quiz questions using AI
router.post('/courses/:id/generate-quiz', async (req: any, res) => {
  const { id } = req.params;
  const { num_questions = 10 } = req.body;
  
  try {
    // Get course info and slides
    const courseResult = await query('SELECT * FROM training_courses WHERE id = $1', [id]);
    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const course = courseResult[0];
    const slides = await query(
      'SELECT title, content FROM training_slides WHERE course_id = $1 ORDER BY slide_order',
      [id]
    );
    
    // Generate sample questions based on course content
    const generatedQuestions = await generateSampleQuestions(course, slides, num_questions);
    
    // Save questions to database
    const savedQuestions = [];
    for (const q of generatedQuestions) {
      const questionId = uuidv4();
      await query(`
        INSERT INTO training_quiz_questions (id, course_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [questionId, id, q.question, q.options.A, q.options.B, q.options.C, q.options.D, q.correct, q.explanation]);
      
      savedQuestions.push({ id: questionId, ...q });
    }
    
    res.json({ 
      message: `Generated ${savedQuestions.length} quiz questions`,
      questions: savedQuestions 
    });
  } catch (error: any) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ error: 'Failed to generate quiz: ' + error.message });
  }
});

// Sample question generator (replace with actual AI in production)
async function generateSampleQuestions(course: any, slides: any[], count: number) {
  const questions = [];
  const templates = [
    { q: "What is the primary purpose of ${topic}?", options: { A: "To save time", B: "To ensure safety", C: "To reduce costs", D: "To increase speed" }, correct: "B" },
    { q: "When should ${topic} be performed?", options: { A: "Once a year", B: "Only when broken", C: "As per schedule", D: "Never" }, correct: "C" },
    { q: "Who is responsible for ${topic}?", options: { A: "Manager only", B: "Everyone", C: "External contractors", D: "Nobody" }, correct: "B" },
    { q: "What happens if ${topic} is ignored?", options: { A: "Nothing", B: "Safety risks", C: "Cost savings", D: "Faster operations" }, correct: "B" },
    { q: "Which document covers ${topic}?", options: { A: "Sales report", B: "Policy manual", C: "Marketing plan", D: "Budget sheet" }, correct: "B" }
  ];
  
  for (let i = 0; i < count; i++) {
    const slide = slides[i % slides.length] || { title: course.course_name };
    const template = templates[i % templates.length];
    questions.push({
      question: template.q.replace('${topic}', slide.title),
      options: template.options,
      correct: template.correct,
      explanation: `This is based on the training material covering ${slide.title}. The correct answer ensures compliance with safety standards.`
    });
  }
  
  return questions;
}

// Get quiz questions for a course
router.get('/courses/:id/quiz', async (req: any, res) => {
  const { id } = req.params;
  const { exclude_used, enrollment_id } = req.query;
  
  try {
    let sql = 'SELECT * FROM training_quiz_questions WHERE course_id = $1';
    const params: any[] = [id];
    let paramIndex = 2;
    
    if (exclude_used === 'true' && enrollment_id) {
      // Get questions already used in previous attempts
      const usedQuestions = await query(`
        SELECT answers FROM training_quiz_attempts 
        WHERE enrollment_id = $1 AND answers IS NOT NULL
      `, [enrollment_id]);
      
      const usedIds = new Set();
      usedQuestions.forEach((attempt: any) => {
        if (attempt.answers) {
          Object.keys(JSON.parse(attempt.answers || '{}')).forEach(id => usedIds.add(id));
        }
      });
      
      if (usedIds.size > 0) {
        sql += ` AND id NOT IN (${Array.from(usedIds).map((_, i) => `$${paramIndex + i}`).join(',')})`;
        params.push(...Array.from(usedIds));
        paramIndex += usedIds.size;
      }
    }
    
    sql += ' ORDER BY RANDOM() LIMIT 10';
    
    const questions = await query(sql, params);
    
    // Don't send correct answers to frontend
    const sanitized = questions.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d
    }));
    
    res.json(sanitized);
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// ========== ENROLLMENTS ==========

// Enroll staff in course
router.post('/enroll', async (req: any, res) => {
  const { staff_id, course_id } = req.body;
  const enrolled_by = req.user?.staffId;
  
  try {
    // Count slides
    const slideCount = await query(
      'SELECT COUNT(*) as count FROM training_slides WHERE course_id = $1',
      [course_id]
    );
    
    const id = uuidv4();
    await query(`
      INSERT INTO training_enrollments (id, staff_id, course_id, enrolled_by, total_slides, status)
      VALUES ($1, $2, $3, $4, $5, 'enrolled')
    `, [id, staff_id, course_id, enrolled_by, slideCount[0]?.count || 0]);
    
    res.status(201).json({ id, message: 'Enrolled successfully' });
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
      SELECT e.*, 
        c.course_name, c.course_code, c.category, c.duration_hours,
        (SELECT COUNT(*) FROM training_quiz_questions WHERE course_id = c.id) as has_quiz
      FROM training_enrollments e
      JOIN training_courses c ON c.id = e.course_id
      WHERE e.staff_id = $1
      ORDER BY e.enrolled_at DESC
    `, [staffId]);
    
    res.json(result);
  } catch (error) {
    console.error('Get my enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// Update slide progress
router.post('/enrollments/:id/progress', async (req: any, res) => {
  const { id } = req.params;
  const { slide_number } = req.body;
  
  try {
    const enrollment = await query('SELECT * FROM training_enrollments WHERE id = $1', [id]);
    if (enrollment.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    const e = enrollment[0];
    const newCompleted = Math.max(e.completed_slides, slide_number);
    const status = newCompleted >= e.total_slides ? 'quiz_pending' : 'in_progress';
    
    await query(`
      UPDATE training_enrollments 
      SET current_slide = $1, completed_slides = $2, status = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [slide_number, newCompleted, status, id]);
    
    res.json({ message: 'Progress updated', status });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ========== QUIZ ATTEMPTS ==========

// Submit quiz attempt
router.post('/enrollments/:id/quiz-submit', async (req: any, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  
  try {
    const enrollment = await query('SELECT * FROM training_enrollments WHERE id = $1', [id]);
    if (enrollment.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    const e = enrollment[0];
    
    // Check if locked
    if (e.status === 'locked') {
      return res.status(403).json({ error: 'Training is locked. Contact your Transport Manager to unlock.' });
    }
    
    // Check attempts
    if (e.quiz_attempts >= MAX_ATTEMPTS) {
      await query("UPDATE training_enrollments SET status = 'locked', locked_at = CURRENT_TIMESTAMP, locked_reason = 'Maximum attempts exceeded' WHERE id = $1", [id]);
      return res.status(403).json({ error: 'Maximum attempts reached. Contact your Transport Manager to unlock.' });
    }
    
    // Get correct answers
    const questionIds = Object.keys(answers);
    if (questionIds.length === 0) {
      return res.status(400).json({ error: 'No answers provided' });
    }
    
    const questions = await query(
      `SELECT id, correct_option FROM training_quiz_questions WHERE id IN (${questionIds.map((_, i) => `$${i + 1}`).join(',')})`,
      questionIds
    );
    
    // Calculate score
    let correct = 0;
    questions.forEach((q: any) => {
      if (answers[q.id] === q.correct_option) correct++;
    });
    
    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
    const passed = score >= PASSING_SCORE;
    
    const newAttemptNumber = e.quiz_attempts + 1;
    
    // Record attempt
    const attemptId = uuidv4();
    await query(`
      INSERT INTO training_quiz_attempts (id, enrollment_id, attempt_number, completed_at, score, total_questions, correct_answers, passed, answers)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8)
    `, [attemptId, id, newAttemptNumber, score, totalQuestions, correct, passed, JSON.stringify(answers)]);
    
    // Update enrollment
    let newStatus = passed ? 'passed' : (newAttemptNumber >= MAX_ATTEMPTS ? 'locked' : 'quiz_pending');
    
    if (newAttemptNumber >= MAX_ATTEMPTS && !passed) {
      await query(`
        UPDATE training_enrollments 
        SET quiz_attempts = $1, last_quiz_score = $2, status = $3, locked_at = CURRENT_TIMESTAMP, locked_reason = 'Failed after 3 attempts'
        WHERE id = $4
      `, [newAttemptNumber, score, newStatus, id]);
    } else if (passed) {
      await query(`
        UPDATE training_enrollments 
        SET quiz_attempts = $1, last_quiz_score = $2, status = $3, passed_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [newAttemptNumber, score, newStatus, id]);
    } else {
      await query(`
        UPDATE training_enrollments 
        SET quiz_attempts = $1, last_quiz_score = $2, status = $3
        WHERE id = $4
      `, [newAttemptNumber, score, newStatus, id]);
    }
    
    // If passed, generate certificate
    if (passed) {
      await generateCertificate(id, e.staff_id, e.course_id, score);
    }
    
    res.json({
      score,
      correct_answers: correct,
      total_questions: totalQuestions,
      passed,
      attempts_remaining: passed ? 0 : MAX_ATTEMPTS - newAttemptNumber,
      status: newStatus,
      attempt_number: newAttemptNumber
    });
  } catch (error: any) {
    console.error('Quiz submit error:', error);
    res.status(500).json({ error: 'Failed to submit quiz: ' + error.message });
  }
});

// ========== CERTIFICATES ==========

async function generateCertificate(enrollmentId: string, staffId: string, courseId: string, score: number) {
  try {
    // Get staff and course info
    const staff = await query('SELECT staff_name FROM staff WHERE id = $1', [staffId]);
    const course = await query('SELECT course_name, validity_months FROM training_courses WHERE id = $1', [courseId]);
    
    if (staff.length === 0 || course.length === 0) return;
    
    // Generate certificate number
    const year = new Date().getFullYear();
    const countResult = await query(
      'SELECT COUNT(*) as count FROM training_certificates WHERE EXTRACT(YEAR FROM issue_date) = $1',
      [year]
    );
    const count = parseInt(countResult[0].count) + 1;
    const certNumber = `CERT-${year}-${String(count).padStart(5, '0')}`;
    
    // Calculate expiry
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
        tc.course_name, tc.course_code, tc.category
      FROM training_certificates c
      JOIN training_courses tc ON tc.id = c.course_id
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
      WHERE c.id = $1 OR c.certificate_number = $2
    `, [id, id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Get certificate data error:', error);
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

// ========== MANAGER UNLOCK ==========

// Get locked enrollments (for managers)
router.get('/locked', async (req: any, res) => {
  try {
    const result = await query(`
      SELECT e.*, 
        s.staff_name, s.staff_no, s.department,
        c.course_name, c.course_code
      FROM training_enrollments e
      JOIN staff s ON s.id = e.staff_id
      JOIN training_courses c ON c.id = e.course_id
      WHERE e.status = 'locked'
      ORDER BY e.locked_at DESC
    `);
    
    res.json(result);
  } catch (error) {
    console.error('Get locked error:', error);
    res.status(500).json({ error: 'Failed to fetch locked enrollments' });
  }
});

// Unlock enrollment (manager only)
router.post('/enrollments/:id/unlock', async (req: any, res) => {
  const { id } = req.params;
  const unlockedBy = req.user?.staffId;
  const userRole = req.user?.role;
  
  // Only managers/admins can unlock
  if (!['admin', 'manager', 'transport_supervisor'].includes(userRole)) {
    return res.status(403).json({ error: 'Only Transport Managers can unlock training' });
  }
  
  try {
    await query(`
      UPDATE training_enrollments 
      SET status = 'quiz_pending', 
          quiz_attempts = 0,
          unlocked_by = $1, 
          unlocked_at = CURRENT_TIMESTAMP,
          locked_reason = NULL
      WHERE id = $2
    `, [unlockedBy, id]);
    
    res.json({ message: 'Training unlocked successfully' });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ error: 'Failed to unlock' });
  }
});

export default router;
