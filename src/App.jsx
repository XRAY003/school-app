import { useEffect, useState } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, NavLink, Outlet,
  useNavigate, useOutletContext,
} from 'react-router-dom'
import { supabase } from './lib/supabase'
import TeacherClasses from './pages/TeacherClasses'
import TeacherQuestions from './pages/TeacherQuestions'
import TeacherExams from './pages/TeacherExams'
import TeacherAttendance from './pages/TeacherAttendance'
import TeacherScores from './pages/TeacherScores'
import TeacherStudents from './pages/TeacherStudents'
import StudentDashboard from './pages/StudentDashboard'

function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: p } = await supabase
          .from('profiles').select('role').eq('id', session.user.id).maybeSingle()
        if (p) {
          navigate(`/${p.role}`, { replace: true })
          return
        }
      }
      setChecking(false)
    }
    check()
  }, [navigate])

  // شماره را به یک ایمیل ساختگی تبدیل می‌کنیم؛ هیچ ایمیلی ارسال نمی‌شود
  const toEmail = (p) => `${p}@school-app.com`

  async function submit(e) {
    e.preventDefault()
    setError('')
    const cleanPhone = phone.replace(/\s/g, '')
    const cleanName = name.trim()

    if (!/^09\d{9}$/.test(cleanPhone)) return setError('شماره موبایل معتبر نیست (مثال: 09123456789)')
    if (password.length < 6) return setError('پسورد باید حداقل ۶ کاراکتر باشد')

    setLoading(true)

    if (mode === 'signup') {
      if (cleanName.length < 2) {
        setLoading(false)
        return setError('نام را وارد کن (حداقل ۲ حرف)')
      }
      const { error } = await supabase.auth.signUp({
        email: toEmail(cleanPhone),
        password,
        options: {
          data: { role, full_name: cleanName, phone: cleanPhone },
        },
      })
      setLoading(false)
      if (error) {
        const msg = /already|registered|exists/i.test(error.message)
          ? 'این شماره قبلاً ثبت‌نام کرده است. از بخش ورود استفاده کن.'
          : error.message
        return setError(msg)
      }
      navigate(`/${role}`, { replace: true })
      return
    }

    // ورود
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(cleanPhone),
      password,
    })
    if (error) {
      setLoading(false)
      return setError('شماره یا پسورد اشتباه است.')
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    setLoading(false)
    if (!p) return setError('برای این شماره پروفایلی پیدا نشد.')
    navigate(`/${p.role}`, { replace: true })
  }

  if (checking) return <div className="hero"><div className="spinner" /></div>

  const isSignup = mode === 'signup'

  return (
    <div className="hero">
      <div className="card login-card">
        <div className="logo">🎓</div>
        <h1>سامانه مدیریت آموزشگاه</h1>
        <p>{isSignup ? 'حساب جدید بساز. هر شماره فقط یک حساب دارد.' : 'با شماره و پسورد خود وارد شو.'}</p>

        <form onSubmit={submit}>
          {isSignup && (
            <input
              placeholder="نام و نام خانوادگی"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="tel"
            placeholder="09123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ textAlign: 'center', letterSpacing: 1 }}
          />
          <input
            type="password"
            placeholder="پسورد"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ textAlign: 'center' }}
          />

          {isSignup && (
            <>
              <label>نقش شما</label>
              <div className="role-buttons" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={role === 'teacher' ? '' : 'ghost'}
                  onClick={() => setRole('teacher')}
                >معلم</button>
                <button
                  type="button"
                  className={role === 'student' ? '' : 'ghost'}
                  onClick={() => setRole('student')}
                >هنرجو</button>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'لطفاً صبر کن...' : isSignup ? 'ثبت‌نام' : 'ورود'}
          </button>
        </form>

        <button
          type="button"
          className="ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError('') }}
        >
          {isSignup ? 'حساب داری؟ ورود' : 'حساب نداری؟ ثبت‌نام'}
        </button>

        {error && <div className="toast error" style={{ marginTop: 14 }}>{error}</div>}
      </div>
    </div>
  )
}

function RoleGuard({ role }) {
  const [profile, setProfile] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase
          .from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
      }
      setChecked(true)
    }
    load()
  }, [])

  if (!checked) return <div className="spinner" />
  if (!profile) return <Navigate to="/" replace />
  if (profile.role !== role) return <Navigate to={`/${profile.role}`} replace />
  return <Outlet context={{ profile }} />
}

const MENUS = {
  teacher: [
    ['/teacher', 'کلاس‌ها', '🏫'],
    ['/teacher/students', 'هنرجوها', '👥'],
    ['/teacher/questions', 'بانک سوال', '❓'],
    ['/teacher/exams', 'آزمون و کوییز', '📝'],
    ['/teacher/attendance', 'حضور و غیاب', '✅'],
    ['/teacher/scores', 'نمره رفتاری', '⭐'],
  ],
  student: [['/student', 'داشبورد من', '🏠']],
}

function Layout() {
  const { profile } = useOutletContext()
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="app">
      <aside className="sidebar animate-in">
        <div className="brand">🎓 {profile.role === 'teacher' ? 'پنل معلم' : 'پنل هنرجو'}</div>
        {MENUS[profile.role].map(([to, label, icon]) => (
          <NavLink key={to} to={to} end className="side-link">
            {icon} {label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div style={{ fontWeight: 700 }}>{profile.full_name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>{profile.phone}</div>
          <button className="ghost small" onClick={logout}>خروج</button>
        </div>
      </aside>
      <main className="main">
        <Outlet context={{ profile }} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/teacher" element={<RoleGuard role="teacher" />}>
          <Route element={<Layout />}>
            <Route index element={<TeacherClasses />} />
            <Route path="students" element={<TeacherStudents />} />
            <Route path="questions" element={<TeacherQuestions />} />
            <Route path="exams" element={<TeacherExams />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="scores" element={<TeacherScores />} />
          </Route>
        </Route>
        <Route path="/student" element={<RoleGuard role="student" />}>
          <Route element={<Layout />}>
            <Route index element={<StudentDashboard />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}