-- ============================================
-- ENHANCED TRAINING MODULE WITH AI QUIZZES
-- ============================================

-- Training Course Content (Slides)
CREATE TABLE IF NOT EXISTS training_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
    slide_order INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    media_url VARCHAR(500),
    duration_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Questions (AI-generated or manual)
CREATE TABLE IF NOT EXISTS training_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff Enrollments for Training
CREATE TABLE IF NOT EXISTS training_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enrolled_by UUID REFERENCES staff(id),
    status VARCHAR(50) DEFAULT 'enrolled', -- enrolled, in_progress, quiz_pending, passed, failed, locked
    current_slide INTEGER DEFAULT 0,
    completed_slides INTEGER DEFAULT 0,
    total_slides INTEGER DEFAULT 0,
    quiz_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_quiz_score INTEGER,
    passed_at TIMESTAMP,
    locked_at TIMESTAMP,
    locked_reason TEXT,
    unlocked_by UUID REFERENCES staff(id),
    unlocked_at TIMESTAMP,
    UNIQUE(staff_id, course_id)
);

-- Quiz Attempts History
CREATE TABLE IF NOT EXISTS training_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES training_enrollments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    score INTEGER,
    total_questions INTEGER,
    correct_answers INTEGER,
    passed BOOLEAN DEFAULT false,
    answers JSONB DEFAULT '{}', -- {question_id: "A", ...}
    UNIQUE(enrollment_id, attempt_number)
);

-- Certificates
CREATE TABLE IF NOT EXISTS training_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    enrollment_id UUID REFERENCES training_enrollments(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    course_id UUID REFERENCES training_courses(id) ON DELETE CASCADE,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    score INTEGER,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_slides_course ON training_slides(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_course ON training_quiz_questions(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_staff ON training_enrollments(staff_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON training_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_certificates_staff ON training_certificates(staff_id);

-- ============================================
-- PRE-BUILT DVIR QUESTIONS
-- ============================================

-- Add questions to DVIR template
INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence) VALUES
('dvir001', '550e8400-e29b-41d4-a716-446655440000', 'Brakes', 'Service brakes functioning properly', 1, true),
('dvir002', '550e8400-e29b-41d4-a716-446655440000', 'Brakes', 'Parking brake holds vehicle', 2, true),
('dvir003', '550e8400-e29b-41d4-a716-446655440000', 'Steering', 'Steering mechanism operates smoothly', 3, true),
('dvir004', '550e8400-e29b-41d4-a716-446655440000', 'Tires', 'Tires properly inflated and have adequate tread', 4, true),
('dvir005', '550e8400-e29b-41d4-a716-446655440000', 'Wheels', 'Wheels and rims undamaged', 5, true),
('dvir006', '550e8400-e29b-41d4-a716-446655440000', 'Lights', 'All lights working (headlights, brake lights, turn signals)', 6, true),
('dvir007', '550e8400-e29b-41d4-a716-446655440000', 'Mirrors', 'Mirrors clean and properly adjusted', 7, false),
('dvir008', '550e8400-e29b-41d4-a716-446655440000', 'Windshield', 'Windshield clean and free of cracks', 8, false),
('dvir009', '550e8400-e29b-41d4-a716-446655440000', 'Wipers', 'Wiper blades in good condition', 9, false),
('dvir010', '550e8400-e29b-41d4-a716-446655440000', 'Horn', 'Horn functioning', 10, false),
('dvir011', '550e8400-e29b-41d4-a716-446655440000', 'Emergency', 'Emergency equipment present (fire extinguisher, triangles, first aid)', 11, true),
('dvir012', '550e8400-e29b-41d4-a716-446655440000', 'Fluid Levels', 'Oil, coolant, and other fluid levels adequate', 12, false),
('dvir013', '550e8400-e29b-41d4-a716-446655440000', 'Documentation', 'Registration and insurance documents present', 13, true)
ON CONFLICT (id) DO NOTHING;

-- Add questions to DOT template
INSERT INTO audit_questions (id, template_id, module_name, question_text, question_order, requires_evidence) VALUES
('dot001', '550e8400-e29b-41d4-a716-446655440001', 'Brake System', 'Brake lines, hoses, and connections inspected', 1, true),
('dot002', '550e8400-e29b-41d4-a716-446655440001', 'Brake System', 'Brake drums/rotors within wear limits', 2, true),
('dot003', '550e8400-e29b-41d4-a716-446655440001', 'Brake System', 'Brake pads/shoes adequate thickness', 3, true),
('dot004', '550e8400-e29b-41d4-a716-446655440001', 'Steering & Suspension', 'Steering linkage tight and secure', 4, true),
('dot005', '550e8400-e29b-41d4-a716-446655440001', 'Steering & Suspension', 'Suspension components undamaged', 5, true),
('dot006', '550e8400-e29b-41d4-a716-446655440001', 'Tires', 'Tire tread depth minimum 2/32 inch', 6, true),
('dot007', '550e8400-e29b-41d4-a716-446655440001', 'Tires', 'No visible tire damage or bulges', 7, true),
('dot008', '550e8400-e29b-41d4-a716-446655440001', 'Lighting', 'All required lights operational', 8, true),
('dot009', '550e8400-e29b-41d4-a716-446655440001', 'Coupling Devices', 'Fifth wheel and coupling devices secure', 9, true),
('dot010', '550e8400-e29b-41d4-a716-446655440001', 'Exhaust System', 'Exhaust system intact and secure', 10, true)
ON CONFLICT (id) DO NOTHING;
