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
import Invite from './pages/Invite'

function Home() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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

  // نام کاربری را به ایمیل داخلی تبدیل می‌کنیم؛ هیچ ایمیلی ارسال نمی‌شود
  const toEmail = (u) => `${u.trim().toLowerCase()}@school-app.com`

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim()) return setError('نام کاربری را وارد کن')
    if (!password) return setError('پسورد را وارد کن')

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    })
    if (error) {
      setLoading(false)
      return setError('نام کاربری یا پسورد اشتباه است.')
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    setLoading(false)
    if (!p) return setError('برای این حساب پروفایلی پیدا نشد.')
    navigate(`/${p.role}`, { replace: true })
  }

  if (checking) return <div className="hero"><div className="spinner" /></div>

  return (
    <div className="hero">
      <div className="card login-card">
        <div className="logo">🎓</div>
        <h1>سامانه مدیریت آموزشگاه</h1>
        <p>با نام کاربری و پسورد معلم وارد شو.</p>

        <form onSubmit={submit}>
          <input
            placeholder="نام کاربری"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ textAlign: 'center' }}
          />
          <input
            type="password"
            placeholder="پسورد"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ textAlign: 'center' }}
          />
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'لطفاً صبر کن...' : 'ورود'}
          </button>
        </form>

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
        <Route path="/invite/:token" element={<Invite />} />
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