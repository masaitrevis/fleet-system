import { useState, useEffect } from 'react';

interface TrainingProps {
  apiUrl: string;
  user: any;
}

const STATUS_COLORS: Record<string, string> = {
  'enrolled': 'bg-blue-100 text-blue-800',
  'in_progress': 'bg-yellow-100 text-yellow-800',
  'quiz_pending': 'bg-orange-100 text-orange-800',
  'passed': 'bg-green-100 text-green-800',
  'failed': 'bg-red-100 text-red-800',
  'locked': 'bg-gray-100 text-gray-800'
};

export default function Training({ apiUrl, user }: TrainingProps) {
  const [view, setView] = useState<'dashboard' | 'courses' | 'my-training' | 'certificates' | 'locked' | 'slides' | 'quiz'>('dashboard');
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [lockedEnrollments, setLockedEnrollments] = useState<any[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [slides, setSlides] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const token = localStorage.getItem('token');
  const isManager = ['admin', 'manager', 'transport_supervisor'].includes(user?.role);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    fetchCourses();
    fetchEnrollments();
    fetchCertificates();
    if (isManager) fetchLockedEnrollments();
  };

  const fetchCourses = async () => {
    const res = await fetch(`${apiUrl}/training/courses`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setCourses(await res.json());
  };

  const fetchEnrollments = async () => {
    const res = await fetch(`${apiUrl}/training/my-enrollments`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setEnrollments(await res.json());
  };

  const fetchCertificates = async () => {
    const res = await fetch(`${apiUrl}/training/my-certificates`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setCertificates(await res.json());
  };

  const fetchLockedEnrollments = async () => {
    const res = await fetch(`${apiUrl}/training/locked`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setLockedEnrollments(await res.json());
  };

  // Enroll in course
  const handleEnroll = async (courseId: string) => {
    if (!user?.staffId) {
      alert('Your account is not linked to a staff profile. Contact your Transport Manager.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/training/enroll`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: user.staffId, course_id: courseId })
      });
      
      if (res.ok) {
        await fetchEnrollments();
        setView('my-training'); // Switch to My Training view so they can see it
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to enroll. You may already be enrolled in this course.');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
    setLoading(false);
  };

  // Start training (view slides)
  const startTraining = async (enrollment: any) => {
    setSelectedEnrollment(enrollment);
    const res = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/full`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setSlides(data.slides || []);
      setCurrentSlide(enrollment.current_slide || 0);
      setView('slides');
    }
  };

  // Update slide progress
  const updateProgress = async (slideNum: number) => {
    await fetch(`${apiUrl}/training/enrollments/${selectedEnrollment.id}/progress`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slide_number: slideNum })
    });
  };

  // Generate/Start Quiz
  const startQuiz = async (enrollment: any) => {
    setSelectedEnrollment(enrollment);
    setQuizResult(null);
    setQuizAnswers({});
    
    // First ensure we have quiz questions
    let questionsRes = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/quiz`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let questions = await questionsRes.json();
    
    // If no questions, generate them
    if (questions.length === 0) {
      setLoading(true);
      await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/generate-quiz`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_questions: 10 })
      });
      
      // Fetch again
      questionsRes = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/quiz${enrollment.quiz_attempts > 0 ? '?exclude_used=true&enrollment_id=' + enrollment.id : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      questions = await questionsRes.json();
      setLoading(false);
    }
    
    setQuizQuestions(questions);
    setView('quiz');
  };

  // Submit Quiz
  const submitQuiz = async () => {
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      alert('Please answer all questions');
      return;
    }
    
    setLoading(true);
    const res = await fetch(`${apiUrl}/training/enrollments/${selectedEnrollment.id}/quiz-submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: quizAnswers })
    });
    
    if (res.ok) {
      const result = await res.json();
      setQuizResult(result);
      fetchEnrollments();
      if (result.passed) fetchCertificates();
    } else {
      const err = await res.json();
      alert(err.error);
    }
    setLoading(false);
  };

  // Unlock training (manager)
  const unlockTraining = async (enrollmentId: string) => {
    const res = await fetch(`${apiUrl}/training/enrollments/${enrollmentId}/unlock`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert('Training unlocked!');
      fetchLockedEnrollments();
    }
  };

  // Certificate PDF view
  const viewCertificate = (cert: any) => {
    const certWindow = window.open('', '_blank');
    if (certWindow) {
      certWindow.document.write(`
        <html>
        <head>
          <title>Certificate - ${cert.course_name}</title>
          <style>
            body { font-family: Georgia, serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .certificate { border: 15px solid #1e3a5f; padding: 60px; background: white; max-width: 800px; margin: 0 auto; }
            h1 { color: #1e3a5f; font-size: 42px; margin-bottom: 20px; }
            h2 { color: #c9a227; font-size: 32px; margin: 30px 0; }
            .recipient { font-size: 36px; color: #1e3a5f; margin: 30px 0; font-weight: bold; }
            .details { margin: 30px 0; font-size: 18px; color: #555; }
            .seal { width: 120px; height: 120px; border: 5px solid #c9a227; border-radius: 50%; margin: 30px auto; 
                    display: flex; align-items: center; justify-content: center; color: #c9a227; font-size: 14px; }
            .cert-number { position: absolute; top: 20px; right: 20px; font-size: 12px; color: #666; }
            @media print { body { background: white; } .certificate { border: none; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div style="text-align: right; font-size: 12px; color: #666;">Cert #: ${cert.certificate_number}</div>
            <h1>CERTIFICATE<br/>OF COMPLETION</h1>
            <p style="font-size: 18px;">This certifies that</p>
            <div class="recipient">${cert.staff_name || user?.staff_name}</div>
            <p style="font-size: 18px;">has successfully completed</p>
            <h2>${cert.course_name}</h2>
            <div class="details">
              <p><strong>Score:</strong> ${cert.score}% | <strong>Duration:</strong> ${cert.duration_hours || 'N/A'} hours</p>
              <p><strong>Issue Date:</strong> ${new Date(cert.issue_date).toLocaleDateString()}</p>
              ${cert.expiry_date ? `<p><strong>Valid Until:</strong> ${new Date(cert.expiry_date).toLocaleDateString()}</p>` : ''}
            </div>
            <div class="seal">FLEET<br/>PRO</div>
            <p style="margin-top: 40px; font-size: 14px; color: #888;">Fleet Management Training System</p>
          </div>
          <button onclick="window.print()" style="margin-top: 20px; padding: 10px 30px; font-size: 16px; cursor: pointer;">Print Certificate</button>
        </body>
        </html>
      `);
    }
  };

  // RENDER VIEWS
  
  // Slides View
  if (view === 'slides' && selectedEnrollment) {
    const slide = slides[currentSlide];
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{selectedEnrollment.course_name}</h2>
          <button onClick={() => setView('my-training')} className="text-gray-600 hover:text-gray-800">← Back</button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 min-h-[400px]">
          <div className="flex justify-between text-sm text-gray-500 mb-4">
            <span>Slide {currentSlide + 1} of {slides.length}</span>
            <span>{Math.round(((currentSlide + 1) / slides.length) * 100)}% Complete</span>
          </div>
          
          <div className="h-2 bg-gray-200 rounded mb-6">
            <div className="h-2 bg-blue-600 rounded transition-all" style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}></div>
          </div>
          
          {slide && (
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-blue-900">{slide.title}</h3>
              <div className="prose max-w-none whitespace-pre-wrap">{slide.content}</div>
              {slide.media_url && (
                <img src={slide.media_url} alt={slide.title} className="max-h-64 rounded" />
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-between mt-6">
          <button 
            onClick={() => { setCurrentSlide(c => c - 1); updateProgress(currentSlide - 1); }}
            disabled={currentSlide === 0}
            className="px-6 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          
          {currentSlide < slides.length - 1 ? (
            <button 
              onClick={() => { setCurrentSlide(c => c + 1); updateProgress(currentSlide + 1); }}
              className="px-6 py-2 bg-blue-600 text-white rounded"
            >
              Next →
            </button>
          ) : (
            <button 
              onClick={() => { updateProgress(slides.length); setView('my-training'); startQuiz(selectedEnrollment); }}
              className="px-6 py-2 bg-green-600 text-white rounded"
            >
              Take Quiz →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Quiz View
  if (view === 'quiz' && selectedEnrollment) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Quiz: {selectedEnrollment.course_name}</h2>
          <button onClick={() => setView('my-training')} className="text-gray-600 hover:text-gray-800">← Exit</button>
        </div>
        
        {quizResult ? (
          <div className={`p-8 rounded-lg text-center ${quizResult.passed ? 'bg-green-50' : quizResult.attempts_remaining === 0 ? 'bg-red-50' : 'bg-yellow-50'}`}>
            <div className="text-6xl mb-4">{quizResult.passed ? '🎉' : quizResult.attempts_remaining === 0 ? '🔒' : '⚠️'}</div>
            <h3 className="text-2xl font-bold mb-2">
              {quizResult.passed ? 'Congratulations!' : quizResult.attempts_remaining === 0 ? 'Training Locked' : 'Try Again'}
            </h3>
            <p className="text-xl mb-4">Score: <strong>{quizResult.score}%</strong> ({quizResult.correct_answers}/{quizResult.total_questions} correct)</p>
            <p className="mb-4">Passing score: {70}%</p>
            
            {quizResult.passed ? (
              <div>
                <p className="text-green-700 mb-4">You passed! Your certificate has been generated.</p>
                <button onClick={() => { setView('certificates'); fetchCertificates(); }} className="px-6 py-2 bg-blue-600 text-white rounded">
                  View Certificate →
                </button>
              </div>
            ) : quizResult.attempts_remaining === 0 ? (
              <div>
                <p className="text-red-700 mb-4">Maximum attempts reached. Contact your Transport Manager to unlock this training.</p>
                <button onClick={() => setView('my-training')} className="px-6 py-2 bg-gray-600 text-white rounded">
                  Back to My Training
                </button>
              </div>
            ) : (
              <div>
                <p className="text-yellow-700 mb-4">You have {quizResult.attempts_remaining} attempt(s) remaining.</p>
                <button onClick={() => startQuiz(selectedEnrollment)} className="px-6 py-2 bg-yellow-600 text-white rounded mr-2">
                  Try Again
                </button>
                <button onClick={() => setView('my-training')} className="px-6 py-2 bg-gray-600 text-white rounded">
                  Study More
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded text-sm">
              Attempt {selectedEnrollment.quiz_attempts + 1} of 3 • Answer all 10 questions • Need 70% to pass
            </div>
            
            {quizQuestions.map((q, idx) => (
              <div key={q.id} className="bg-white p-4 rounded-lg shadow">
                <p className="font-medium mb-3">{idx + 1}. {q.question_text}</p>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="radio" 
                        name={q.id} 
                        value={opt}
                        checked={quizAnswers[q.id] === opt}
                        onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                        className="text-blue-600"
                      />
                      <span>{q[`option_${opt.toLowerCase()}`]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            
            <button 
              onClick={submitQuiz}
              disabled={loading || Object.keys(quizAnswers).length < quizQuestions.length}
              className="w-full py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Main View
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Training & Certifications</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Dashboard</button>
          <button onClick={() => setView('courses')} className={`px-4 py-2 rounded ${view === 'courses' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>All Courses</button>
          <button onClick={() => setView('my-training')} className={`px-4 py-2 rounded ${view === 'my-training' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>My Training</button>
          <button onClick={() => setView('certificates')} className={`px-4 py-2 rounded ${view === 'certificates' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Certificates</button>
          {isManager && (
            <button onClick={() => setView('locked')} className={`px-4 py-2 rounded ${view === 'locked' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'}`}>
              Locked ({lockedEnrollments.length})
            </button>
          )}
        </div>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Enrolled Courses</p>
            <p className="text-2xl font-bold text-blue-600">{enrollments.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{enrollments.filter(e => e.status === 'passed').length}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">{enrollments.filter(e => ['in_progress', 'quiz_pending'].includes(e.status)).length}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Certificates</p>
            <p className="text-2xl font-bold text-purple-600">{certificates.length}</p>
          </div>
        </div>
      )}

      {/* Courses View */}
      {view === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => {
            const enrolled = enrollments.find(e => e.course_id === course.id);
            return (
              <div key={course.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{course.course_name}</h3>
                  {course.mandatory && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Required</span>}
                </div>
                <p className="text-sm text-gray-500 mb-2">{course.category} • {course.duration_hours}h</p>
                <p className="text-xs text-gray-400 mb-4">{course.description?.substring(0, 100)}...</p>
                
                {enrolled ? (
                  <button 
                    onClick={() => {
                      if (enrolled.status === 'passed') {
                        setView('certificates');
                      } else {
                        setSelectedEnrollment(enrolled);
                        setView('my-training');
                      }
                    }}
                    className={`w-full py-2 rounded ${
                      enrolled.status === 'passed' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {enrolled.status === 'passed' ? '✓ Completed' : 
                     enrolled.status === 'enrolled' ? 'Start Learning →' :
                     enrolled.status === 'in_progress' ? 'Continue →' :
                     enrolled.status === 'quiz_pending' ? 'Take Quiz →' : 'Enrolled'}
                  </button>
                ) : (
                  <button onClick={() => handleEnroll(course.id)} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded disabled:bg-gray-400">
                    {loading ? 'Enrolling...' : 'Enroll Now'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* My Training View */}
      {view === 'my-training' && (
        <div className="space-y-4">
          {enrollments.map(e => (
            <div key={e.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{e.course_name}</h3>
                <p className="text-sm text-gray-500">{e.category} • Enrolled {new Date(e.enrolled_at).toLocaleDateString()}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[e.status] || 'bg-gray-100'}`}>
                    {e.status.replace('_', ' ')}
                  </span>
                  {e.quiz_attempts > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-gray-100">
                      Attempt {e.quiz_attempts}/3
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                {e.status === 'enrolled' && (
                  <button onClick={() => startTraining(e)} className="px-4 py-2 bg-blue-600 text-white rounded">Start Learning</button>
                )}
                {e.status === 'in_progress' && (
                  <button onClick={() => startTraining(e)} className="px-4 py-2 bg-yellow-600 text-white rounded">Continue</button>
                )}
                {e.status === 'quiz_pending' && (
                  <button onClick={() => startQuiz(e)} className="px-4 py-2 bg-orange-600 text-white rounded">Take Quiz</button>
                )}
                {e.status === 'locked' && (
                  <span className="px-4 py-2 bg-gray-300 text-gray-600 rounded">🔒 Locked</span>
                )}
              </div>
            </div>
          ))}
          {enrollments.length === 0 && <p className="text-center text-gray-500 py-8">No enrollments. Browse courses to get started!</p>}
        </div>
      )}

      {/* Certificates View */}
      {view === 'certificates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.map(cert => (
            <div key={cert.id} className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-blue-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{cert.course_name}</h3>
                  <p className="text-sm text-gray-600">{cert.course_code}</p>
                </div>
                <span className="text-4xl">🏆</span>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <p><strong>Score:</strong> {cert.score}%</p>
                <p><strong>Issued:</strong> {new Date(cert.issue_date).toLocaleDateString()}</p>
                {cert.expiry_date && (
                  <p><strong>Expires:</strong> {new Date(cert.expiry_date).toLocaleDateString()}</p>
                )}
                <p className="text-xs text-gray-500">{cert.certificate_number}</p>
              </div>
              <button onClick={() => viewCertificate(cert)} className="mt-4 w-full py-2 bg-blue-600 text-white rounded">
                View Certificate
              </button>
            </div>
          ))}
          {certificates.length === 0 && <p className="text-center text-gray-500 py-8">No certificates yet. Complete training to earn certificates!</p>}
        </div>
      )}

      {/* Locked Enrollments (Manager) */}
      {view === 'locked' && isManager && (
        <div className="space-y-4">
          {lockedEnrollments.map(e => (
            <div key={e.id} className="bg-red-50 p-4 rounded-lg border border-red-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{e.staff_name} ({e.staff_no})</h3>
                <p className="text-sm text-gray-600">{e.course_name} • {e.department}</p>
                <p className="text-xs text-red-600 mt-1">Locked: {e.locked_reason}</p>
              </div>
              <button onClick={() => unlockTraining(e.id)} className="px-4 py-2 bg-green-600 text-white rounded">
                Unlock Training
              </button>
            </div>
          ))}
          {lockedEnrollments.length === 0 && <p className="text-center text-gray-500 py-8">No locked enrollments.</p>}
        </div>
      )}
    </div>
  );
}
