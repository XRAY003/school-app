import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EMPTY = { kind: 'quiz', body: '', options: ['', '', '', ''], correct: 0, points: 1 }

export default function TeacherQuestions() {
  const { profile } = useOutletContext()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState(null)

  function flash(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    const { data, error } = await supabase
      .from('questions')
      .select('id, kind, body, options, points, question_keys(correct_index)')
      .order('created_at', { ascending: false })
    if (error) return flash('error', error.message)
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  function setOpt(i, v) {
    const o = [...form.options]
    o[i] = v
    setForm({ ...form, options: o })
  }

  async function save(e) {
    e.preventDefault()
    const opts = form.options.map((o) => o.trim())
    if (!form.body.trim()) return flash('error', 'متن سوال را بنویس')
    if (opts.some((o) => !o)) return flash('error', 'هر ۴ گزینه را پر کن')

    const { data, error } = await supabase.from('questions').insert({
      teacher_id: profile.id,
      kind: form.kind,
      body: form.body.trim(),
      options: opts,
      points: Number(form.points) || 1,
    }).select('id').single()
    if (error) return flash('error', error.message)

    const { error: e2 } = await supabase.from('question_keys')
      .insert({ question_id: data.id, correct_index: Number(form.correct) })
    if (e2) return flash('error', e2.message)

    setForm({ ...EMPTY, kind: form.kind })
    flash('success', 'سوال ذخیره شد')
    load()
  }

  async function remove(id) {
    if (!window.confirm('این سوال حذف شود؟')) return
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) return flash('error', error.message)
    load()
  }

  const shown = items.filter((q) => filter === 'all' || q.kind === filter)

  return (
    <div>
      <div className="page-head animate-in"><h1>❓ بانک سوال</h1></div>
      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}

      <div className="grid-2">
        <div className="card animate-in" style={{ '--i': 0 }}>
          <h2>سوال جدید</h2>
          <form onSubmit={save}>
            <label>نوع سوال</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="quiz">کوییز</option>
              <option value="exam">آزمون</option>
            </select>

            <label>متن سوال</label>
            <input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />

            {form.options.map((o, i) => (
              <input
                key={i}
                placeholder={`گزینه ${i + 1}`}
                value={o}
                onChange={(e) => setOpt(i, e.target.value)}
              />
            ))}

            <label>گزینه درست</label>
            <select value={form.correct} onChange={(e) => setForm({ ...form, correct: e.target.value })}>
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={i}>گزینه {i + 1}</option>
              ))}
            </select>

            <label>امتیاز سوال</label>
            <input type="number" min="1" value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })} />

            <button type="submit">ذخیره سوال</button>
          </form>
        </div>

        <div className="card animate-in" style={{ '--i': 1 }}>
          <div className="page-head" style={{ marginBottom: 10 }}>
            <h2>سوال‌های من ({shown.length})</h2>
            <div className="seg">
              {['all', 'quiz', 'exam'].map((f) => (
                <button key={f} className={filter === f ? 'on-present' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'همه' : f === 'quiz' ? 'کوییز' : 'آزمون'}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 && <div className="empty">هنوز سوالی ثبت نشده.</div>}
          {shown.map((q, i) => (
            <div className="row" key={q.id} style={{ '--i': i, display: 'block' }}>
              <div className="row" style={{ marginBottom: 6, padding: 0, background: 'none' }}>
                <span>
                  <span className={`badge ${q.kind}`}>{q.kind === 'quiz' ? 'کوییز' : 'آزمون'}</span>{' '}
                  <b>{q.body}</b>
                </span>
                <button className="danger small" onClick={() => remove(q.id)}>حذف</button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                گزینه درست: {q.options[q.question_keys?.[0]?.correct_index]} · امتیاز: {q.points}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}