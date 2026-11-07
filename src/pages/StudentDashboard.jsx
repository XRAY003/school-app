import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_FA = { present: 'حاضر', late: 'تأخیر', absent: 'غایب' }

// اجرای آزمون با تایمر و ثبت خودکار وقتی زمان تمام شود
function ExamRunner({ exam, onDone, onClose }) {
  const [qs, setQs] = useState(null)
  const [answers, setAnswers] = useState({})
  const [secs, setSecs] = useState(exam.duration_minutes * 60)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const answersRef = useRef({})
  const submittedRef = useRef(false)

  useEffect(() => {
    supabase.from('exam_questions')
      .select('questions(id, body, options)')
      .eq('exam_id', exam.id)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setQs((data || []).map((r) => r.questions).filter(Boolean))
      })
  }, [exam.id])

  async function submit() {
    if (submittedRef.current) return
    submittedRef.current = true
    setBusy(true)
    const { data, error } = await supabase.rpc('submit_exam', {
      p_exam: exam.id,
      p_answers: answersRef.current,
    })
    setBusy(false)
    if (error) {
      setError(error.message.includes('already_submitted') ? 'قبلاً این آزمون را داده‌ای.' : error.message)
      return
    }
    setResult(data)
    onDone()
  }

  // شمارش معکوس
  useEffect(() => {
    if (result !== null) return
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [result])

  // زمان تمام شد: خودکار ثبت کن
  useEffect(() => {
    if (secs === 0 && !submittedRef.current) submit()
  }, [secs])

  function pick(qid, idx) {
    if (result !== null || submittedRef.current) return
    answersRef.current = { ...answersRef.current, [qid]: idx }
    setAnswers(answersRef.current)
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  if (result !== null) {
    return (
      <div className="card result animate-in">
        <h2>نتیجه: {exam.title}</h2>
        <div className="stat-num" style={{ color: 'var(--blurple)', margin: '10px 0' }}>{result}٪</div>
        <div className="lb-track" style={{ maxWidth: 360, margin: '0 auto 16px' }}>
          <div className="lb-fill" style={{ width: `${result}%` }} />
        </div>
        <button onClick={onClose}>بستن</button>
      </div>
    )
  }

  return (
    <div className="card animate-in">
      <div className="runner-head">
        <h2>{exam.title}</h2>
        <div className={`timer ${secs < 60 ? 'danger' : ''}`}>{mm}:{ss}</div>
      </div>

      {qs === null && <div className="spinner" />}
      {qs && qs.length === 0 && <div className="empty">سوالی برای این آزمون ثبت نشده.</div>}

      {qs && qs.map((q, i) => (
        <div className="q" style={{ '--i': i }} key={q.id}>
          <div className="q-body">{i + 1}. {q.body}</div>
          {q.options.map((opt, idx) => (
            <div
              key={idx}
              className={`opt ${answers[q.id] === idx ? 'sel' : ''}`}
              onClick={() => pick(q.id, idx)}
            >
              <span className="opt-dot" />
              <span>{opt}</span>
            </div>
          ))}
        </div>
      ))}

      {error && <div className="toast error">{error}</div>}

      {qs && qs.length > 0 && (
        <div className="runner-foot">
          <span style={{ color: 'var(--muted)' }}>{Object.keys(answers).length} از {qs.length} پاسخ داده شده</span>
          <button disabled={busy} onClick={submit}>{busy ? 'در حال ثبت...' : 'ثبت پاسخ‌ها'}</button>
        </div>
      )}
    </div>
  )
}

export default function StudentDashboard() {
  const { profile } = useOutletContext()
  const [classes, setClasses] = useState([])
  const [exams, setExams] = useState([])
  const [subs, setSubs] = useState({})
  const [events, setEvents] = useState([])
  const [att, setAtt] = useState([])
  const [active, setActive] = useState(null)

  async function load() {
    const [enr, ex, sb, ev, at] = await Promise.all([
      supabase.from('class_students').select('classes(id, name)').eq('student_id', profile.id),
      supabase.from('exams').select('id, title, kind, is_open, duration_minutes, classes(name)')
        .order('created_at', { ascending: false }),
      supabase.from('submissions').select('exam_id, percent').eq('student_id', profile.id),
      supabase.from('score_events').select('id, points, reason, created_at')
        .eq('student_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('id, status, day')
        .eq('student_id', profile.id).order('day', { ascending: false }),
    ])
    setClasses((enr.data || []).map((r) => r.classes).filter(Boolean))
    setExams(ex.data || [])
    setSubs(Object.fromEntries((sb.data || []).map((s) => [s.exam_id, s.percent])))
    setEvents(ev.data || [])
    setAtt(at.data || [])
  }

  useEffect(() => { load() }, [])

  const positives = events.filter((e) => e.points > 0).reduce((s, e) => s + e.points, 0)
  const negatives = events.filter((e) => e.points < 0).reduce((s, e) => s + e.points, 0)
  const presentCount = att.filter((a) => a.status !== 'absent').length
  const quizzes = exams.filter((e) => e.kind === 'quiz' && subs[e.id] !== undefined)
  const quizAvg = quizzes.length
    ? Math.round(quizzes.reduce((s, e) => s + subs[e.id], 0) / quizzes.length)
    : '—'

  return (
    <div>
      <div className="page-head animate-in">
        <h1>سلام {profile.full_name} 👋</h1>
      </div>

      <div className="grid-stats">
        <div className="card stat animate-in" style={{ '--i': 0 }}>
          <div className="stat-num pos">+{positives}</div>
          <div className="stat-label">نمره مثبت رفتاری</div>
        </div>
        <div className="card stat animate-in" style={{ '--i': 1 }}>
          <div className="stat-num neg">{negatives}</div>
          <div className="stat-label">نمره منفی رفتاری</div>
        </div>
        <div className="card stat animate-in" style={{ '--i': 2 }}>
          <div className="stat-num" style={{ color: 'var(--blurple)' }}>{quizAvg}{quizAvg !== '—' && '٪'}</div>
          <div className="stat-label">میانگین کوییز</div>
        </div>
        <div className="card stat animate-in" style={{ '--i': 3 }}>
          <div className="stat-num" style={{ color: 'var(--green)' }}>{presentCount}</div>
          <div className="stat-label">جلسه حاضر</div>
        </div>
      </div>

      {active && (
        <ExamRunner
          key={active.id}
          exam={active}
          onDone={load}
          onClose={() => setActive(null)}
        />
      )}

      <div className="grid-2">
        <div>
          <div className="card animate-in" style={{ '--i': 0 }}>
            <h2>آزمون و کوییزها</h2>
            {exams.length === 0 && <div className="empty">فعلاً آزمونی نیست.</div>}
            {exams.map((x, i) => {
              const done = subs[x.id]
              return (
                <div className="row" key={x.id} style={{ '--i': i, display: 'block' }}>
                  <div className="row" style={{ padding: 0, background: 'none', marginBottom: 6 }}>
                    <span>
                      <span className={`badge ${x.kind}`}>{x.kind === 'quiz' ? 'کوییز' : 'آزمون'}</span>{' '}
                      <b>{x.title}</b>
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {x.classes?.name} · {x.duration_minutes} دقیقه
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {done !== undefined ? (
                      <span className="pos">نمره شما: {done}٪</span>
                    ) : x.is_open ? (
                      <button className="small" onClick={() => setActive(x)}>شروع آزمون</button>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>این آزمون بسته است</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card animate-in" style={{ '--i': 1 }}>
            <h2>کلاس‌های من</h2>
            {classes.length === 0 && <div className="empty">هنوز به کلاسی اضافه نشده‌ای.</div>}
            {classes.map((c, i) => (
              <div className="row" key={c.id} style={{ '--i': i }}>
                <span>🏫 {c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card animate-in" style={{ '--i': 2 }}>
            <h2>نمرات رفتاری</h2>
            {events.length === 0 && <div className="empty">هنوز نمره‌ای ثبت نشده.</div>}
            {events.map((e, i) => (
              <div className="row" key={e.id} style={{ '--i': i }}>
                <span>{e.reason || 'بدون توضیح'}</span>
                <span className={e.points > 0 ? 'pos' : 'neg'}>{e.points > 0 ? `+${e.points}` : e.points}</span>
              </div>
            ))}
          </div>

          <div className="card animate-in" style={{ '--i': 3 }}>
            <h2>حضور و غیاب</h2>
            {att.length === 0 && <div className="empty">هنوز ثبتی نشده.</div>}
            {att.map((a, i) => (
              <div className="row" key={a.id} style={{ '--i': i }}>
                <span>{new Date(a.day).toLocaleDateString('fa-IR')}</span>
                <span className={`badge`} style={{
                  color: a.status === 'present' ? 'var(--green)' : a.status === 'late' ? 'var(--yellow)' : 'var(--red)',
                }}>
                  {STATUS_FA[a.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}