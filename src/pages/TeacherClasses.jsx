import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TeacherClasses() {
  const { profile } = useOutletContext()

  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState(null)
  const [members, setMembers] = useState([])
  const [scores, setScores] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [newName, setNewName] = useState('')
  const [phone, setPhone] = useState('')
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
        .select('id, full_name, phone')
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
    const cleaned = phone.replace(/\s/g, '')
    if (!/^09\d{9}$/.test(cleaned)) {
      return flash('error', 'شماره موبایل معتبر نیست (مثال: 09123456789)')
    }
    const { error } = await supabase.rpc('add_student_to_class', {
      p_class_id: selected.id,
      p_phone: cleaned,
    })
    if (error) {
      const msg = error.message.includes('student_not_found')
        ? 'هنرجویی با این شماره پیدا نشد. او باید ابتدا وارد سامانه شده باشد.'
        : error.message
      return flash('error', msg)
    }
    setPhone('')
    flash('success', 'هنرجو به کلاس اضافه شد')
    loadDetails(selected.id)
  }

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
        {/* ستون چپ: لیست کلاس‌ها و ساخت کلاس */}
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

        {/* ستون راست: جزئیات کلاس */}
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
                  <input
                    type="tel"
                    placeholder="شماره موبایل هنرجو: 09123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button type="submit">افزودن هنرجو</button>
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
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{m.phone || 'بدون شماره'}</div>
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