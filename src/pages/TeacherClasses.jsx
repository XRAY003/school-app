import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TeacherClasses() {
  const { profile } = useOutletContext()

  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState(null)
  const [members, setMembers] = useState([])
  const [scores, setScores] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [newName, setNewName] = useState('')
  const [pickId, setPickId] = useState('')
  const [toast, setToast] = useState(null)

  function flash(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3200)
  }

  async function loadClasses() {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) flash('error', error.message)
    setClasses(data || [])
    setLoadingClasses(false)
    setSelected((prev) => prev ?? (data && data[0]) ?? null)
  }

  async function loadAllStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, profiles(full_name)')
      .eq('teacher_id', profile.id)
    setAllStudents(
      (data || []).map((s) => ({ id: s.id, name: s.profiles?.full_name ?? '—' }))
    )
  }

  async function loadDetails(classId) {
    const { data: links } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)

    const ids = (links || []).map((l) => l.student_id)
    let people = []
    if (ids.length) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
      people = data || []
    }
    setMembers(people)

    const { data: s } = await supabase
      .from('quiz_scores')
      .select('student_id, score')
      .eq('class_id', classId)
    setScores(s || [])
  }

  useEffect(() => {
    loadClasses()
    loadAllStudents()
  }, [])

  useEffect(() => {
    if (selected) loadDetails(selected.id)
    else { setMembers([]); setScores([]) }
  }, [selected])

  async function createClass(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('classes')
      .insert({ name, teacher_id: profile.id })
      .select()
      .single()
    if (error) return flash('error', error.message)
    setNewName('')
    setClasses((prev) => [data, ...prev])
    setSelected(data)
    flash('success', 'کلاس ساخته شد')
  }

  async function addStudent(e) {
    e.preventDefault()
    if (!selected) return
    if (!pickId) return flash('error', 'یک هنرجو را انتخاب کن')

    const { error } = await supabase.rpc('add_student_to_class', {
      p_class_id: selected.id,
      p_student_id: pickId,
    })
    if (error) {
      const msg = error.message.includes('student_not_found')
        ? 'این هنرجو متعلق به تو نیست.'
        : error.message
      return flash('error', msg)
    }
    setPickId('')
    flash('success', 'هنرجو به کلاس اضافه شد')
    loadDetails(selected.id)
  }

  // هنرجوهایی که هنوز در این کلاس نیستند
  const memberIds = new Set(members.map((m) => m.id))
  const available = allStudents.filter((s) => !memberIds.has(s.id))

  const board = members
    .map((m) => {
      const mine = scores.filter((s) => s.student_id === m.id)
      const total = mine.reduce((sum, s) => sum + s.score, 0)
      return {
        id: m.id,
        name: m.full_name,
        count: mine.length,
        avg: mine.length ? Math.round(total / mine.length) : 0,
      }
    })
    .sort((a, b) => b.avg - a.avg)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div>
      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <div className="grid-2">
        <div>
          <div className="card animate-in" style={{ '--i': 0 }}>
            <h2>ساخت کلاس جدید</h2>
            <form onSubmit={createClass}>
              <input
                placeholder="مثلاً: انگلیسی سطح متوسط"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit">ایجاد کلاس</button>
            </form>
          </div>

          <div className="card animate-in" style={{ '--i': 1 }}>
            <h2>کلاس‌های من</h2>
            {loadingClasses && <div className="spinner" />}
            {!loadingClasses && classes.length === 0 && (
              <div className="empty">هنوز کلاسی نساخته‌ای.</div>
            )}
            {classes.map((c) => (
              <div
                key={c.id}
                className={`class-item ${selected?.id === c.id ? 'active' : ''}`}
                onClick={() => setSelected(c)}
              >
                <span>{c.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {new Date(c.created_at).toLocaleDateString('fa-IR')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!selected ? (
            <div className="card animate-in empty" style={{ '--i': 0 }}>
              یک کلاس را از فهرست انتخاب کن یا کلاس جدید بساز.
            </div>
          ) : (
            <>
              <div className="card animate-in" style={{ '--i': 0 }}>
                <h2>{selected.name}</h2>
                <p>{members.length} هنرجو در این کلاس</p>

                <form onSubmit={addStudent} style={{ marginTop: 10 }}>
                  <label>افزودن هنرجو از لیست هنرجوهای من</label>
                  <select value={pickId} onChange={(e) => setPickId(e.target.value)}>
                    <option value="">-- انتخاب کن --</option>
                    {available.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={!available.length}>افزودن به کلاس</button>
                  {allStudents.length === 0 && (
                    <div className="empty">هنوز هنرجویی نساخته‌ای. از بخش «هنرجوها» اضافه کن.</div>
                  )}
                  {allStudents.length > 0 && available.length === 0 && (
                    <div className="empty">همه هنرجوهای تو در این کلاس هستند.</div>
                  )}
                </form>
              </div>

              <div className="card animate-in" style={{ '--i': 1 }}>
                <h2>لیست هنرجوها</h2>
                {members.length === 0 && <div className="empty">هنوز هنرجویی اضافه نشده.</div>}
                {members.map((m, i) => (
                  <div className="member" key={m.id} style={{ '--i': i }}>
                    <div className="avatar">{m.full_name?.[0] || '؟'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{m.full_name}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card animate-in" style={{ '--i': 2 }}>
                <h2>🏆 جدول رتبه‌بندی کوییز</h2>
                {board.length === 0 && <div className="empty">هنوز نمره‌ای ثبت نشده.</div>}
                {board.map((row, i) => (
                  <div className={`lb-row ${i === 0 ? 'top1' : ''}`} key={row.id} style={{ '--i': i }}>
                    <div className="lb-rank">{medals[i] || `#${i + 1}`}</div>
                    <div>
                      <div className="lb-name">{row.name}</div>
                      <div className="lb-track">
                        <div
                          className="lb-fill"
                          style={{ width: `${row.avg}%`, animationDelay: `${i * 90 + 150}ms` }}
                        />
                      </div>
                    </div>
                    <div className="lb-score">{row.avg}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}