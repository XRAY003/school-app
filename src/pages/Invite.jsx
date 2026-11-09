import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FUNC_URL = 'https://afzfxvrfmygfgaalzihh.supabase.co/functions/v1/student-invite'

async function callFn(body) {
  const res = await fetch(FUNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const out = await res.json().catch(() => ({ error: 'خطای سرور' }))
  if (!res.ok || out.error) {
    return { error: out.error || out.message || 'خطا در ارتباط با سرور' }
  }
  return out
}

export default function Invite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    callFn({ action: 'get', token }).then((out) => {
      if (out.error) setLoadError(out.error)
      else setInfo(out)
    })
  }, [token])

  async function signIn(email, pass) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) return setError('پسورد اشتباه است.')
    navigate('/student', { replace: true })
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!info) return

    setBusy(true)

    // بار اول: تعیین پسورد
    if (!info.claimed) {
      if (password.length < 6) {
        setBusy(false)
        return setError('پسورد باید حداقل ۶ کاراکتر باشد')
      }
      if (password !== confirm) {
        setBusy(false)
        return setError('پسورد و تکرار آن یکی نیستند')
      }
      const out = await callFn({ action: 'claim', token, password })
      if (out.error) {
        setBusy(false)
        return setError(out.error === 'already_claimed'
          ? 'این لینک قبلاً فعال شده. پسورد را وارد کن.'
          : out.error)
      }
      await signIn(info.email, password)
      setBusy(false)
      return
    }

    // دفعات بعد: ورود با پسورد
    await signIn(info.email, password)
    setBusy(false)
  }

  if (loadError) {
    return (
      <div className="hero">
        <div className="card login-card">
          <div className="logo">🔗</div>
          <div className="toast error">{loadError}</div>
        </div>
      </div>
    )
  }

  if (!info) return <div className="hero"><div className="spinner" /></div>

  const firstTime = !info.claimed

  return (
    <div className="hero">
      <div className="card login-card">
        <div className="logo">🎓</div>
        <h1>سلام {info.full_name}</h1>
        <p>
          {firstTime
            ? 'برای اولین بار، یک پسورد برای ورود خودت تعیین کن.'
            : 'پسورد خود را وارد کن.'}
        </p>

        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="پسورد"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ textAlign: 'center' }}
          />
          {firstTime && (
            <input
              type="password"
              placeholder="تکرار پسورد"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ textAlign: 'center' }}
            />
          )}
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'لطفاً صبر کن...' : firstTime ? 'ذخیره و ورود' : 'ورود'}
          </button>
        </form>

        {error && <div className="toast error" style={{ marginTop: 14 }}>{error}</div>}
      </div>
    </div>
  )
}