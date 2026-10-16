// ₹1 booking confirmation (customer) and the WhatsApp chat button (customer and driver).
import { useState } from 'react'
import { paymentApi, type Booking, type Payment } from '../api'
import { useT } from '../i18n'

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function PayToConfirm({ b }: { b: Booking }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fee = rupees(b.fee_paise ?? 100)

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      const p = await paymentApi<Payment>(`/payments/booking/${b.id}`, { body: { return_to: 'web' } })
      if (!p.pay_url) throw new Error(t.paymentFailed)
      window.location.assign(p.pay_url) // Razorpay page; it sends the customer back to this booking
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="confirm-box">
      <strong>{t.confirmTitle(b.driver_name ?? '')}</strong>
      <p>{t.confirmBody(fee)}</p>
      <button className="btn primary wide" onClick={() => void pay()} disabled={busy}>
        {busy ? t.openingPayment : t.payNow(fee)}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function ChatButton({ url, label }: { url: string; label: string }) {
  const { t } = useT()
  return (
    <div className="chat-row">
      <a className="btn whatsapp" href={url} target="_blank" rel="noopener noreferrer">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"
          />
        </svg>
        {label}
      </a>
      <p className="hint">{t.chatPrivacy}</p>
    </div>
  )
}

/** Cancel button for a booking that has a cancellation fee: explains it, then pays and cancels. */
export function CancelWithFee({ b }: { b: Booking }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fee = rupees(b.cancellation_fee_paise ?? 0)

  async function payAndCancel() {
    setBusy(true)
    setError(null)
    try {
      const p = await paymentApi<Payment>(`/payments/booking/${b.id}/cancel`, { body: { return_to: 'web' } })
      if (!p.pay_url) throw new Error(t.paymentFailed)
      window.location.assign(p.pay_url) // after paying, the booking is cancelled and the customer comes back here
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        {t.cancelWithFee(fee)}
      </button>
    )
  }
  return (
    <div className="cancel-box" role="group" aria-label={t.cancelBooking}>
      <p>{t.cancelFeeExplain(fee)}</p>
      <div className="row-between">
        <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
          {t.keepBooking}
        </button>
        <button className="btn danger" onClick={() => void payAndCancel()} disabled={busy}>
          {busy ? t.openingPayment : t.payToCancel(fee)}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
