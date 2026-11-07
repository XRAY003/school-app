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
import StudentDashboard from './pages/StudentDashboard'

const phoneOk = (p) => /^09\d{9}$/.test(p)

function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  // اگر قبلاً وارد شده باشی، مستقیم به پنلت می‌روی
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

  async function login(role) {
    setError('')
    const cleanPhone = phone.replace(/\s/g, '')
    const cleanName = name.trim()
    if (cleanName.length < 2) return setError('اسمت را وارد کن (حداقل ۲ حرف)')
    if (!phoneOk(cleanPhone)) return setError('شماره موبایل معتبر نیست (مثال: 09123456789)')

    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      const { data: p } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (p && p.role === role) {
        // همان نقش: بدون ورود مجدد، فقط اطلاعات را به‌روز کن
        await supabase.from('profiles')
          .update({ full_name: cleanName, phone: cleanPhone })
          .eq('id', session.user.id)
        setLoading(false)
        navigate(`/${role}`)
        return
      }
      await supabase.auth.signOut()
    }

    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { role, phone: cleanPhone, full_name: cleanName } },
    })
    setLoading(false)
    if (error) return setError(error.message)
    navigate(`/${role}`)
  }

  if (checking) return <div className="hero"><div className="spinner" /></div>

  return (
    <div className="hero">
      <div className="card login-card">
        <div className="logo">🎓</div>
        <h1>سامانه مدیریت آموزشگاه</h1>
        <p>نام و شماره موبایل خود را وارد کن و نقشت را انتخاب کن. دفعه‌های بعد خودکار وارد می‌شوی.</p>

        <input
          placeholder="نام و نام خانوادگی"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="tel"
          placeholder="09123456789"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ textAlign: 'center', letterSpacing: 1 }}
        />

        <div className="role-buttons">
          <button disabled={loading} onClick={() => login('teacher')}>ورود معلم</button>
          <button disabled={loading} onClick={() => login('student')}>ورود هنرجو</button>
        </div>

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