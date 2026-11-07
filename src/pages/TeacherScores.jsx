import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TeacherScores() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [students, setStudents] = useState([])
  const [events, setEvents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [points, setPoints] = useState(1)
  const [reason, setReason] = useState('')
  const [toast, setToast] = useState(null)

  function flash(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    supabase.from('classes').select('id, name').order('created_at', { ascending: false })
      .then(({ data }) => {
        setClasses(data || [])
        if (data?.[0]) setClassId(data[0].id)
      })
  }, [])

  async function loadClass(id) {
    const { data: links } = await supabase
      .from('class_students').select('student_id').eq('class_id', id)
    const ids = (links || []).map((l) => l.student_id)
    let people = []
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      people = data || []
    }
    setStudents(people)
    setStudentId(people[0]?.id || '')

    const { data: ev } = await supabase
      .from('score_events')
      .select('id, points, reason, student_id, created_at, profiles(full_name)')
      .eq('class_id', id)
      .order('created_at', { ascending: false })
    setEvents(ev || [])
  }

  useEffect(() => { if (classId) loadClass(classId) }, [classId])

  async function add(e) {
    e.preventDefault()
    const p = Number(points)
    if (!studentId) return flash('error', 'هنرجویی در این کلاس نیست')
    if (!p) return flash('error', 'امتیاز نمی‌تواند صفر باشد')
    const { error } = await supabase.from('score_events').insert({
      class_id: classId,
      student_id: studentId,
      points: p,
      reason: reason.trim() || null,
    })
    if (error) return flash('error', error.message)
    setReason('')
    flash('success', p > 0 ? 'نمره مثبت ثبت شد' : 'نمره منفی ثبت شد')
    loadClass(classId)
  }

  async function remove(id) {
    await supabase.from('score_events').delete().eq('id', id)
    loadClass(classId)
  }

  const totals = students
    .map((s) => ({
      ...s,
      total: events.filter((e) => e.student_id === s.id).reduce((sum, e) => sum + e.points, 0),
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div>
      <div className="page-head animate-in"><h1>⭐ نمره رفتاری</h1></div>
      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <div className="grid-2">
        <div className="card animate-in" style={{ '--i': 0 }}>
          <h2>ثبت نمره</h2>
          <form onSubmit={add}>
            <label>کلاس</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label>هنرجو</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>

            <label>امتیاز (مثبت یا منفی)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[2, 1, -1, -2].map((p) => (
                <button key={p} type="button" className="ghost small"
                  style={{ color: p > 0 ? 'var(--green)' : 'var(--red)' }}
                  onClick={() => setPoints(p)}>
                  {p > 0 ? `+${p}` : p}
                </button>
              ))}
            </div>
            <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} />

            <label>دلیل (اختیاری)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً: تکلیف کامل" />

            <button type="submit">ثبت</button>
          </form>
        </div>

        <div className="card animate-in" style={{ '--i': 1 }}>
          <h2>مجموع نمره رفتاری</h2>
          {totals.length === 0 && <div className="empty">هنرجویی نیست.</div>}
          {totals.map((s, i) => (
            <div className="row" key={s.id} style={{ '--i': i }}>
              <span>{s.full_name}</span>
              <span className={s.total >= 0 ? 'pos' : 'neg'}>{s.total > 0 ? `+${s.total}` : s.total}</span>
            </div>
          ))}

          <h2 style={{ marginTop: 18 }}>آخرین ثبت‌ها</h2>
          {events.length === 0 && <div className="empty">هنوز نمره‌ای ثبت نشده.</div>}
          {events.slice(0, 40).map((ev, i) => (
            <div className="row" key={ev.id} style={{ '--i': i }}>
              <span>
                <span className={ev.points > 0 ? 'pos' : 'neg'}>{ev.points > 0 ? `+${ev.points}` : ev.points}</span>{' '}
                {ev.profiles?.full_name} {ev.reason ? `· ${ev.reason}` : ''}
              </span>
              <button className="ghost small" onClick={() => remove(ev.id)}>حذف</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}