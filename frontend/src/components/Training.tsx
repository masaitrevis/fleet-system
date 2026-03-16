import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

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
  const [slideNotes, setSlideNotes] = useState<Record<string, string>>({});
  const [loadingNotes, setLoadingNotes] = useState<Record<string, boolean>>({});
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
    try {
      const res = await fetch(`${apiUrl}/training/courses`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCourses(await res.json());
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  };

  const fetchEnrollments = async () => {
    try {
      const res = await fetch(`${apiUrl}/training/my-enrollments`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setEnrollments(await res.json());
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
    }
  };

  const fetchCertificates = async () => {
    try {
      const res = await fetch(`${apiUrl}/training/my-certificates`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCertificates(await res.json());
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
    }
  };

  const fetchLockedEnrollments = async () => {
    try {
      const res = await fetch(`${apiUrl}/training/locked`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setLockedEnrollments(await res.json());
    } catch (err) {
      console.error('Failed to fetch locked enrollments:', err);
    }
  };

  // Generate AI notes for a slide
  const generateSlideNotes = async (slideId: string, courseId: string) => {
    if (slideNotes[slideId]) return;
    
    setLoadingNotes(prev => ({ ...prev, [slideId]: true }));
    
    try {
      const res = await fetch(`${apiUrl}/training/courses/${courseId}/slides/${slideId}/generate-notes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSlideNotes(prev => ({ ...prev, [slideId]: data.notes }));
      }
    } catch (err) {
      console.error('Failed to generate notes:', err);
    } finally {
      setLoadingNotes(prev => ({ ...prev, [slideId]: false }));
    }
  };

  // Enroll in course
  const handleEnroll = async (courseId: string) => {
    if (!user?.staffId) {
      alert('Your account is not linked to a staff profile. Contact your Transport Manager.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/training/enroll`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: user.staffId, course_id: courseId })
      });
      
      if (res.ok) {
        await fetchEnrollments();
        setView('my-training');
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to enroll. You may already be enrolled in this course.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Start training (view slides)
  const startTraining = async (enrollment: any) => {
    setSelectedEnrollment(enrollment);
    setError('');
    
    try {
      const res = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/full`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSlides(data.slides || []);
        setCurrentSlide(enrollment.current_slide || 0);
        setView('slides');
        
        if (data.slides?.[0]?.id) {
          generateSlideNotes(data.slides[0].id, enrollment.course_id);
        }
      } else {
        setError('Failed to load course slides');
      }
    } catch (err) {
      setError('Network error loading slides');
    }
  };

  // Update slide progress
  const updateProgress = async (slideNum: number) => {
    try {
      await fetch(`${apiUrl}/training/enrollments/${selectedEnrollment.id}/progress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide_number: slideNum })
      });
    } catch (err) {
      console.error('Failed to update progress:', err);
    }
  };

  // Handle slide navigation
  const goToSlide = (newSlide: number) => {
    setCurrentSlide(newSlide);
    updateProgress(newSlide);
    
    const slide = slides[newSlide];
    if (slide?.id && !slideNotes[slide.id]) {
      generateSlideNotes(slide.id, selectedEnrollment.course_id);
    }
  };

  // Generate/Start Quiz
  const startQuiz = async (enrollment: any) => {
    setSelectedEnrollment(enrollment);
    setQuizResult(null);
    setQuizAnswers({});
    setError('');
    
    try {
      let questionsRes = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/quiz?exclude_used=true&enrollment_id=${enrollment.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let questions = await questionsRes.json();
      
      if (questions.length === 0) {
        setLoading(true);
        const genRes = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/generate-quiz`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ num_questions: 10 })
        });
        
        if (!genRes.ok) {
          setError('Failed to generate quiz questions');
          setLoading(false);
          return;
        }
        
        questionsRes = await fetch(`${apiUrl}/training/courses/${enrollment.course_id}/quiz?exclude_used=true&enrollment_id=${enrollment.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        questions = await questionsRes.json();
        setLoading(false);
      }
      
      if (questions.length === 0) {
        setError('No quiz questions available. Please contact your manager.');
        return;
      }
      
      setQuizQuestions(questions);
      setView('quiz');
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setError('Failed to start quiz. Please try again.');
      setLoading(false);
    }
  };

  // Submit Quiz
  const submitQuiz = async () => {
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      setError('Please answer all questions');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
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
        setError(err.error || 'Failed to submit quiz');
      }
    } catch (err) {
      setError('Network error submitting quiz');
    } finally {
      setLoading(false);
    }
  };

  // Unlock training (manager)
  const unlockTraining = async (enrollmentId: string) => {
    try {
      const res = await fetch(`${apiUrl}/training/enrollments/${enrollmentId}/unlock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchLockedEnrollments();
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to unlock training');
      }
    } catch (err) {
      setError('Network error unlocking training');
    }
  };

  // Download certificate as PDF
  const downloadCertificatePDF = (cert: any) => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;
    
    // Background gradient simulation with rectangles
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Certificate border
    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(3);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    
    // Inner white area
    doc.setFillColor(255, 255, 255);
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30, 'F');
    
    // Header
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Certificate #:', pageWidth - 40, 25);
    doc.setFontSize(10);
    doc.text(cert.certificate_number, pageWidth - 40, 30);
    
    // Logo/Title
    doc.setFontSize(48);
    doc.setTextColor(30, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE', centerX, 45, { align: 'center' });
    
    doc.setFontSize(24);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('OF COMPLETION', centerX, 55, { align: 'center' });
    
    // Decorative line
    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(1);
    doc.line(centerX - 40, 62, centerX + 40, 62);
    
    // Recipient text
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('This certifies that', centerX, 75, { align: 'center' });
    
    // Recipient name
    doc.setFontSize(36);
    doc.setTextColor(30, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text(cert.staff_name || user?.staff_name || 'Student', centerX, 90, { align: 'center' });
    
    // Course text
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('has successfully completed the training course', centerX, 105, { align: 'center' });
    
    // Course name
    doc.setFontSize(28);
    doc.setTextColor(118, 75, 162);
    doc.setFont('helvetica', 'bold');
    doc.text(cert.course_name, centerX, 120, { align: 'center' });
    
    // Details
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    const detailsY = 135;
    doc.text(`Score: ${cert.score}%`, centerX - 50, detailsY, { align: 'center' });
    doc.text(`Duration: ${cert.duration_hours || 'N/A'} hours`, centerX, detailsY, { align: 'center' });
    doc.text(`Issued: ${new Date(cert.issue_date).toLocaleDateString()}`, centerX + 50, detailsY, { align: 'center' });
    
    if (cert.expiry_date) {
      doc.text(`Valid Until: ${new Date(cert.expiry_date).toLocaleDateString()}`, centerX, detailsY + 8, { align: 'center' });
    }
    
    // Seal
    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(2);
    doc.circle(centerX, 165, 15);
    doc.setFontSize(10);
    doc.setTextColor(201, 162, 39);
    doc.text('FLEET', centerX, 163, { align: 'center' });
    doc.text('PRO', centerX, 169, { align: 'center' });
    
    // Signature line
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.line(40, 185, 100, 185);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('Training Manager', 70, 192, { align: 'center' });
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('NextBotics Fleet Management Training System', centerX, pageHeight - 20, { align: 'center' });
    
    doc.save(`certificate-${cert.certificate_number}.pdf`);
  };

  // RENDER VIEWS
  
  // Slides View
  if (view === 'slides' && selectedEnrollment) {
    const slide = slides[currentSlide];
    const currentSlideNotes = slide?.id ? slideNotes[slide.id] : null;
    const isLoadingNotes = slide?.id ? loadingNotes[slide.id] : false;
    
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-lg sm:text-xl font-bold truncate">{selectedEnrollment.course_name}</h2>
          <button onClick={() => setView('my-training')} className="text-gray-600 hover:text-gray-800 text-sm">← Back</button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 min-h-[300px] sm:min-h-[400px]">
          <div className="flex flex-col sm:flex-row justify-between text-sm text-gray-500 mb-4 gap-1">
            <span>Slide {currentSlide + 1} of {slides.length}</span>
            <span>{Math.round(((currentSlide + 1) / slides.length) * 100)}% Complete</span>
          </div>
          
          <div className="h-2 bg-gray-200 rounded mb-6">
            <div className="h-2 bg-blue-600 rounded transition-all" style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}></div>
          </div>
          
          {slide && (
            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-semibold text-blue-900">{slide.title}</h3>
              {/* Course Notes Section */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📚</span>
                  <h4 className="font-semibold text-green-900">Course Notes</h4>
                </div>
                <div className="text-sm text-green-800 whitespace-pre-wrap leading-relaxed">
                  {slide.content}
                </div>
              </div>
              
              {slide.media_url && (
                <div className="mt-4">
                  <img src={slide.media_url} alt={slide.title} className="max-h-48 sm:max-h-64 rounded w-full object-contain border" />
                </div>
              )}
              
              {/* AI Study Guide Section */}
              <div className="mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <h4 className="font-semibold text-blue-900 text-sm sm:text-base">AI Study Guide</h4>
                  </div>
                  {!currentSlideNotes && !isLoadingNotes && (
                    <button
                      onClick={() => generateSlideNotes(slide.id, selectedEnrollment.course_id)}
                      className="sm:ml-auto text-xs sm:text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    >
                      Generate
                    </button>
                  )}
                  {isLoadingNotes && (
                    <span className="sm:ml-auto text-xs text-blue-600">Generating...</span>
                  )}
                </div>
                
                {currentSlideNotes ? (
                  <div className="text-xs sm:text-sm text-blue-800 whitespace-pre-wrap">{currentSlideNotes}</div>
                ) : (
                  <p className="text-xs sm:text-sm text-blue-600 italic">
                    {isLoadingNotes ? 'Generating AI study guide...' : 'Click "Generate" for AI-generated study points.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between mt-6 gap-2">
          <button 
            onClick={() => goToSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
            className="px-4 sm:px-6 py-2 bg-gray-200 rounded disabled:opacity-50 text-sm sm:text-base"
          >
            ← Previous
          </button>
          
          {currentSlide < slides.length - 1 ? (
            <button 
              onClick={() => goToSlide(currentSlide + 1)}
              className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded text-sm sm:text-base"
            >
              Next →
            </button>
          ) : (
            <button 
              onClick={() => { updateProgress(slides.length); setView('my-training'); startQuiz(selectedEnrollment); }}
              className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded text-sm sm:text-base"
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
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-lg sm:text-xl font-bold">Quiz: {selectedEnrollment.course_name}</h2>
          <button onClick={() => setView('my-training')} className="text-gray-600 hover:text-gray-800 text-sm">← Exit</button>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-lg mb-4 text-sm">{error}</div>
        )}
        
        {quizResult ? (
          <div className={`p-6 sm:p-8 rounded-lg text-center ${quizResult.passed ? 'bg-green-50' : quizResult.attempts_remaining === 0 ? 'bg-red-50' : 'bg-yellow-50'}`}>
            <div className="text-5xl sm:text-6xl mb-4">{quizResult.passed ? '🎉' : quizResult.attempts_remaining === 0 ? '🔒' : '⚠️'}</div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              {quizResult.passed ? 'Congratulations!' : quizResult.attempts_remaining === 0 ? 'Training Locked' : 'Try Again'}
            </h3>
            <p className="text-lg mb-4">Score: <strong>{quizResult.score}%</strong> ({quizResult.correct_answers}/{quizResult.total_questions} correct)</p>
            <p className="mb-4 text-sm sm:text-base">Passing score: 70%</p>
            
            {quizResult.passed ? (
              <div>
                <p className="text-green-700 mb-4 text-sm sm:text-base">You passed! Your certificate has been generated.</p>
                <button onClick={() => { setView('certificates'); fetchCertificates(); }} className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded text-sm sm:text-base">
                  View Certificate →
                </button>
              </div>
            ) : quizResult.attempts_remaining === 0 ? (
              <div>
                <p className="text-red-700 mb-4 text-sm sm:text-base">Maximum attempts reached. Contact your Transport Manager to unlock this training.</p>
                <button onClick={() => setView('my-training')} className="px-4 sm:px-6 py-2 bg-gray-600 text-white rounded text-sm sm:text-base">
                  Back to My Training
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <p className="text-yellow-700 mb-4 text-sm sm:text-base">You have {quizResult.attempts_remaining} attempt(s) remaining.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => startQuiz(selectedEnrollment)} className="px-4 sm:px-6 py-2 bg-yellow-600 text-white rounded text-sm sm:text-base">
                    Try Again
                  </button>
                  <button onClick={() => setView('my-training')} className="px-4 sm:px-6 py-2 bg-gray-600 text-white rounded text-sm sm:text-base">
                    Study More
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 sm:p-4 rounded text-xs sm:text-sm">
              Attempt {selectedEnrollment.quiz_attempts + 1} of 3 • Answer all {quizQuestions.length} questions • Need 70% to pass
            </div>
            
            {quizQuestions.map((q, idx) => (
              <div key={q.id} className="bg-white p-3 sm:p-4 rounded-lg shadow">
                <p className="font-medium mb-3 text-sm sm:text-base">{idx + 1}. {q.question_text}</p>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
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
              className="w-full py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-400 text-sm sm:text-base"
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
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">Training & Certifications</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setView('dashboard')} className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Dashboard</button>
          <button onClick={() => setView('courses')} className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm ${view === 'courses' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>All Courses</button>
          <button onClick={() => setView('my-training')} className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm ${view === 'my-training' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>My Training</button>
          <button onClick={() => setView('certificates')} className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm ${view === 'certificates' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Certificates</button>
          {isManager && (
            <button onClick={() => setView('locked')} className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm ${view === 'locked' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'}`}>
              Locked ({lockedEnrollments.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs text-gray-600">Enrolled Courses</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{enrollments.length}</p>
          </div>
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs text-gray-600">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{enrollments.filter(e => e.status === 'passed').length}</p>
          </div>
          <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs text-gray-600">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{enrollments.filter(e => ['in_progress', 'quiz_pending'].includes(e.status)).length}</p>
          </div>
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs text-gray-600">Certificates</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{certificates.length}</p>
          </div>
        </div>
      )}

      {/* Courses View */}
      {view === 'courses' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {courses.map(course => {
            const enrolled = enrollments.find(e => e.course_id === course.id);
            return (
              <div key={course.id} className="bg-white p-3 sm:p-4 rounded-lg shadow">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-semibold text-sm sm:text-base">{course.course_name}</h3>
                  {course.mandatory && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded whitespace-nowrap">Required</span>}
                </div>
                <p className="text-xs text-gray-500 mb-2">{course.category} • {course.duration_hours}h</p>
                <p className="text-xs text-gray-400 mb-4 line-clamp-2">{course.description}</p>
                
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
                    className={`w-full py-2 rounded text-sm ${
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
                  <button onClick={() => handleEnroll(course.id)} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400">
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
        <div className="space-y-3 sm:space-y-4">
          {enrollments.map(e => (
            <div key={e.id} className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base truncate">{e.course_name}</h3>
                <p className="text-xs text-gray-500">{e.category} • Enrolled {new Date(e.enrolled_at).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-2 mt-2">
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
              
              <div className="flex gap-2 w-full sm:w-auto">
                {e.status === 'enrolled' && (
                  <button onClick={() => startTraining(e)} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded text-sm">Start Learning</button>
                )}
                {e.status === 'in_progress' && (
                  <button onClick={() => startTraining(e)} className="flex-1 sm:flex-none px-4 py-2 bg-yellow-600 text-white rounded text-sm">Continue</button>
                )}
                {e.status === 'quiz_pending' && (
                  <button onClick={() => startQuiz(e)} className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 text-white rounded text-sm">Take Quiz</button>
                )}
                {e.status === 'locked' && (
                  <span className="flex-1 sm:flex-none px-4 py-2 bg-gray-300 text-gray-600 rounded text-center text-sm">🔒 Locked</span>
                )}
              </div>
            </div>
          ))}
          {enrollments.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">No enrollments. Browse courses to get started!</p>}
        </div>
      )}

      {/* Certificates View */}
      {view === 'certificates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {certificates.map(cert => (
            <div key={cert.id} className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 sm:p-6 rounded-lg border-2 border-blue-200">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg truncate">{cert.course_name}</h3>
                  <p className="text-xs text-gray-600">{cert.course_code}</p>
                </div>
                <span className="text-3xl sm:text-4xl">🏆</span>
              </div>
              <div className="mt-4 space-y-1 text-xs sm:text-sm">
                <p><strong>Recipient:</strong> {cert.staff_name || user?.staff_name}</p>
                <p><strong>Score:</strong> {cert.score}%</p>
                <p><strong>Issued:</strong> {new Date(cert.issue_date).toLocaleDateString()}</p>
                {cert.expiry_date && (
                  <p><strong>Expires:</strong> {new Date(cert.expiry_date).toLocaleDateString()}</p>
                )}
                <p className="text-xs text-gray-500 break-all">{cert.certificate_number}</p>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => downloadCertificatePDF(cert)} className="flex-1 py-2 bg-blue-600 text-white rounded text-xs sm:text-sm">
                  Download PDF
                </button>
              </div>
            </div>
          ))}
          {certificates.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">No certificates yet. Complete training to earn certificates!</p>}
        </div>
      )}

      {/* Locked Enrollments (Manager) */}
      {view === 'locked' && isManager && (
        <div className="space-y-3 sm:space-y-4">
          {lockedEnrollments.map(e => (
            <div key={e.id} className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base">{e.staff_name} ({e.staff_no})</h3>
                <p className="text-xs text-gray-600">{e.course_name} • {e.department}</p>
                <p className="text-xs text-red-600 mt-1">Locked: {e.locked_reason}</p>
              </div>
              <button onClick={() => unlockTraining(e.id)} className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded text-sm">
                Unlock Training
              </button>
            </div>
          ))}
          {lockedEnrollments.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">No locked enrollments.</p>}
        </div>
      )}
    </div>
  );
}
