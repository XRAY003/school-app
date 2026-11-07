import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TeacherExams() {
  const { profile } = useOutletContext()
  const [classes, setClasses] = useState([])
  const [questions, setQuestions] = useState([])
  const [exams, setExams] = useState([])
  const [form, setForm] = useState({ class_id: '', kind: 'quiz', title: '', duration: 15 })
  const [picked, setPicked] = useState([])
  const [openExam, setOpenExam] = useState(null)
  const [results, setResults] = useState([])
  const [toast, setToast] = useState(null)

  function flash(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadAll() {
    const [c, q, e] = await Promise.all([
      supabase.from('classes').select('id, name').order('created_at', { ascending: false }),
      supabase.from('questions').select('id, kind, body').order('created_at', { ascending: false }),
      supabase.from('exams')
        .select('id, title, kind, is_open, duration_minutes, class_id, classes(name)')
        .order('created_at', { ascending: false }),
    ])
    setClasses(c.data || [])
    setQuestions(q.data || [])
    setExams(e.data || [])
    setForm((f) => (f.class_id || !c.data?.[0] ? f : { ...f, class_id: c.data[0].id }))
  }

  useEffect(() => { loadAll() }, [])

  const bank = questions.filter((q) => q.kind === form.kind)

  function togglePick(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  async function createExam(e) {
    e.preventDefault()
    if (!form.class_id || !form.title.trim()) return flash('error', 'کلاس و عنوان را وارد کن')
    if (picked.length === 0) return flash('error', 'حداقل یک سوال انتخاب کن')

    const { data, error } = await supabase.from('exams').insert({
      class_id: form.class_id,
      teacher_id: profile.id,
      kind: form.kind,
      title: form.title.trim(),
      duration_minutes: Number(form.duration) || 15,
    }).select('id').single()
    if (error) return flash('error', error.message)

    const rows = picked.map((qid) => ({ exam_id: data.id, question_id: qid }))
    const { error: e2 } = await supabase.from('exam_questions').insert(rows)
    if (e2) return flash('error', e2.message)

    setPicked([])
    setForm((f) => ({ ...f, title: '' }))
    flash('success', 'آزمون ساخته شد')
    loadAll()
  }

  async function toggleOpen(exam) {
    const { error } = await supabase.from('exams')
      .update({ is_open: !exam.is_open }).eq('id', exam.id)
    if (error) return flash('error', error.message)
    loadAll()
  }

  async function showResults(exam) {
    setOpenExam(exam)
    const { data } = await supabase.from('submissions')
      .select('percent, score, total, profiles(full_name)')
      .eq('exam_id', exam.id)
      .order('percent', { ascending: false })
    setResults(data || [])
  }

  return (
    <div>
      <div className="page-head animate-in"><h1>📝 آزمون و کوییز</h1></div>
      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <div className="grid-2">
        <div className="card animate-in" style={{ '--i': 0 }}>
          <h2>ساخت آزمون / کوییز</h2>
          <form onSubmit={createExam}>
            <label>کلاس</label>
            <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label>نوع</label>
            <select value={form.kind} onChange={(e) => { setForm({ ...form, kind: e.target.value }); setPicked([]) }}>
              <option value="quiz">کوییز</option>
              <option value="exam">آزمون</option>
            </select>

            <label>عنوان</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

            <label>مدت زمان (دقیقه)</label>
            <input type="number" min="1" value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })} />

            <label>انتخاب سوال از بانک ({picked.length} انتخاب شده)</label>
            <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 10 }}>
              {bank.length === 0 && <div className="empty">سوالی برای این نوع نیست.</div>}
              {bank.map((q) => (
                <div key={q.id} className="row" style={{ cursor: 'pointer' }} onClick={() => togglePick(q.id)}>
                  <span>{picked.includes(q.id) ? '☑' : '☐'} {q.body}</span>
                </div>
              ))}
            </div>

            <button type="submit">ساخت آزمون</button>
          </form>
        </div>

        <div className="card animate-in" style={{ '--i': 1 }}>
          <h2>آزمون‌های من</h2>
          {exams.length === 0 && <div className="empty">هنوز آزمونی ساخته نشده.</div>}
          {exams.map((x, i) => (
            <div className="row" key={x.id} style={{ '--i': i, display: 'block' }}>
              <div className="row" style={{ padding: 0, background: 'none', marginBottom: 6 }}>
                <span>
                  <span className={`badge ${x.kind}`}>{x.kind === 'quiz' ? 'کوییز' : 'آزمون'}</span>{' '}
                  <b>{x.title}</b>
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{x.classes?.name} · {x.duration_minutes} دقیقه</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="small" onClick={() => toggleOpen(x)}>
                  {x.is_open ? 'بستن آزمون' : 'باز کردن آزمون'}
                </button>
                <button className="ghost small" onClick={() => showResults(x)}>نتایج</button>
              </div>
            </div>
          ))}

          {openExam && (
            <div style={{ marginTop: 14 }}>
              <h2>نتایج: {openExam.title}</h2>
              {results.length === 0 && <div className="empty">هنوز کسی شرکت نکرده.</div>}
              {results.map((r, i) => (
                <div className="lb-row" key={i} style={{ '--i': i }}>
                  <div className="lb-rank">{i === 0 ? '🥇' : `#${i + 1}`}</div>
                  <div>
                    <div className="lb-name">{r.profiles?.full_name}</div>
                    <div className="lb-track"><div className="lb-fill" style={{ width: `${r.percent}%` }} /></div>
                  </div>
                  <div className="lb-score">{r.percent}٪</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}