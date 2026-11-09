import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FUNC_URL = 'https://afzfxvrfmygfgaalzihh.supabase.co/functions/v1/student-invite'
const SITE = window.location.origin

export default function TeacherStudents() {
  const { profile } = useOutletContext()
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  function flash(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    const { data, error } = await supabase
      .from('student_invites')
      .select('token, claimed_at, created_at, students:student_id(profiles(full_name))')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: true })
    if (error) return flash('error', error.message)
    setRows(
      (data || []).map((r) => ({
        token: r.token,
        full_name: r.students?.profiles?.full_name ?? '—',
        claimed: !!r.claimed_at,
      }))
    )
  }

  useEffect(() => { load() }, [])

  async function addStudent(e) {
    e.preventDefault()
    const clean = name.trim()
    if (clean.length < 2) return flash('error', 'نام را وارد کن (حداقل ۲ حرف)')

    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'create', full_name: clean }),
    })
    const out = await res.json()
    setBusy(false)

    if (!res.ok) return flash('error', out.error || 'خطا در ساخت هنرجو')
    setName('')
    flash('success', 'هنرجو اضافه شد')
    load()
  }

  function inviteLink(token) {
    return `${SITE}/invite/${token}`
  }

  async function copy(token) {
    await navigator.clipboard.writeText(inviteLink(token))
    flash('success', 'لینک کپی شد')
  }

  return (
    <div>
      <div className="page-head animate-in"><h1>👥 هنرجوها</h1></div>
      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <div className="card animate-in" style={{ '--i': 0 }}>
        <h2>افزودن هنرجو</h2>
        <form onSubmit={addStudent} style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="نام و نام خانوادگی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <button type="submit" disabled={busy} style={{ whiteSpace: 'nowrap' }}>
            {busy ? '...' : 'افزودن'}
          </button>
        </form>
      </div>

      <div className="card animate-in" style={{ '--i': 1 }}>
        <h2>لیست هنرجوها ({rows.length})</h2>
        {rows.length === 0 && <div className="empty">هنوز هنرجویی اضافه نشده.</div>}

        {rows.length > 0 && (
          <div className="row" style={{ color: 'var(--muted)', fontSize: 13, background: 'none' }}>
            <span style={{ flex: 1 }}>نام</span>
            <span style={{ width: 90 }}>وضعیت</span>
            <span style={{ width: 120 }}>لینک دعوت</span>
          </div>
        )}

        {rows.map((r, i) => (
          <div className="row" key={r.token} style={{ '--i': i }}>
            <span style={{ flex: 1 }}>{r.full_name}</span>
            <span style={{ width: 90 }}>
              <span className={`badge ${r.claimed ? 'quiz' : 'exam'}`}>
                {r.claimed ? 'فعال' : 'منتظر'}
              </span>
            </span>
            <span style={{ width: 120 }}>
              <button className="ghost small" onClick={() => copy(r.token)}>کپی لینک</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}