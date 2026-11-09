import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const today = () => new Date().toISOString().slice(0, 10)

const toJalali = (iso) =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(iso + 'T12:00:00'))

export default function TeacherAttendance() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [day, setDay] = useState(today())
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({})
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

  useEffect(() => {
    if (!classId) return
    async function load() {
      const { data: links } = await supabase
        .from('class_students').select('student_id').eq('class_id', classId)
      const ids = (links || []).map((l) => l.student_id)
      let people = []
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids)
        people = data || []
      }
      setStudents(people)

      const { data: att } = await supabase
        .from('attendance').select('student_id, status')
        .eq('class_id', classId).eq('day', day)
      const m = {}
      ;(att || []).forEach((a) => { m[a.student_id] = a.status })
      setMarks(m)
    }
    load()
  }, [classId, day])

  async function mark(studentId, status) {
    setMarks((m) => ({ ...m, [studentId]: status }))
    const { error } = await supabase.from('attendance').upsert(
      { class_id: classId, student_id: studentId, day, status },
      { onConflict: 'class_id,student_id,day' }
    )
    if (error) flash('error', error.message)
  }

  async function markAllPresent() {
    for (const s of students) await mark(s.id, 'present')
    flash('success', 'همه به‌عنوان حاضر ثبت شدند')
  }

  const count = (st) => Object.values(marks).filter((v) => v === st).length

  return (
    <div>
      <div className="page-head animate-in"><h1>✅ حضور و غیاب</h1></div>
      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <div className="card animate-in" style={{ '--i': 0 }}>
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
          <div>
            <label>کلاس</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>تاریخ</label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              {toJalali(day)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-stats">
        <div className="card stat"><div className="stat-num" style={{ color: 'var(--green)' }}>{count('present')}</div><div className="stat-label">حاضر</div></div>
        <div className="card stat"><div className="stat-num" style={{ color: 'var(--yellow)' }}>{count('late')}</div><div className="stat-label">تأخیر</div></div>
        <div className="card stat"><div className="stat-num" style={{ color: 'var(--red)' }}>{count('absent')}</div><div className="stat-label">غایب</div></div>
        <div className="card stat"><div className="stat-num">{students.length}</div><div className="stat-label">کل هنرجوها</div></div>
      </div>

      <div className="card animate-in" style={{ '--i': 1 }}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2>لیست حضور - {toJalali(day)}</h2>
          <button className="ghost small" onClick={markAllPresent} disabled={!students.length}>همه حاضر</button>
        </div>
        {students.length === 0 && <div className="empty">هنرجویی در این کلاس نیست.</div>}
        {students.map((s, i) => (
          <div className="row" key={s.id} style={{ '--i': i }}>
            <span>{s.full_name}</span>
            <div className="seg">
              <button className={marks[s.id] === 'present' ? 'on-present' : ''} onClick={() => mark(s.id, 'present')}>حاضر</button>
              <button className={marks[s.id] === 'late' ? 'on-late' : ''} onClick={() => mark(s.id, 'late')}>تأخیر</button>
              <button className={marks[s.id] === 'absent' ? 'on-absent' : ''} onClick={() => mark(s.id, 'absent')}>غایب</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}