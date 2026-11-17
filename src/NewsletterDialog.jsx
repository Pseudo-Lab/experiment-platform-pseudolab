import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from './components/ui/button';

const NEWSLETTER_API_BASE = (import.meta.env?.VITE_NEWSLETTER_API_BASE_URL || '').trim().replace(/\/+$/, '');
const CONSENT_VERSION = 'team-updates-v1-20261118';

const copy = {
  ko: {
    title: '프로젝트 소식 받아보기',
    email: '이메일 주소',
    consentTitle: '개인정보 수집 및 이용 안내',
    terms: [
      ['수집·이용 주체', '김수현'],
      ['수집 항목', '이메일 주소'],
      ['이용 목적', 'Data Initiative·Iterglow 프로젝트 소식 전달'],
      ['보유 기간', '소식 구독 운영 종료 또는 동의 철회 중 먼저 도래하는 시점까지'],
    ],
    refusal: '동의를 거부할 수 있으며, 거부 시 소식 구독 신청이 어렵습니다.',
    withdrawal: '동의 철회·문의',
    agree: '위 개인정보 수집 및 이용에 동의합니다.',
    submit: '소식받기',
    submitting: '신청 중...',
    acceptedTitle: '소식 구독 신청이 접수되었어요',
    acceptedBody: '확인 메일은 자동 발송되지 않습니다.',
    acceptedUnsubscribe: '해지·문의는 아래 이메일로 요청해 주세요.',
    close: '닫기',
    errors: {
      consentChanged: '동의 안내 버전이 변경되었습니다. 페이지를 새로고침한 뒤 다시 확인해 주세요.',
      rateLimited: '요청이 너무 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.',
      unavailable: '현재 구독 서버나 저장소에 연결할 수 없습니다. 잠시 후 다시 시도하거나 메일로 문의해 주세요.',
      subscribeFailed: '소식 구독 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    },
  },
  en: {
    title: 'Follow our project updates',
    email: 'Email address',
    consentTitle: 'Personal data collection and use',
    terms: [
      ['Operator', 'Kim Soohyun'],
      ['Data collected', 'Email address'],
      ['Purpose', 'Sending Data Initiative and Iterglow project updates'],
      ['Retention', 'Until the newsletter closes or you withdraw consent, whichever comes first'],
    ],
    refusal: 'You may decline consent. Without it, you cannot subscribe to project updates.',
    withdrawal: 'Withdraw consent or ask a question',
    agree: 'I agree to the collection and use of my personal data described above.',
    submit: 'Subscribe',
    submitting: 'Submitting...',
    acceptedTitle: 'Your update request was recorded',
    acceptedBody: 'No automatic confirmation email is sent.',
    acceptedUnsubscribe: 'To unsubscribe or ask a question, email us below.',
    close: 'Close',
    errors: {
      consentChanged: 'The consent version has changed. Please refresh the page and try again.',
      rateLimited: 'Too many requests right now. Please wait a moment and try again.',
      unavailable: 'The subscription service is temporarily unavailable. Please try again later or email us.',
      subscribeFailed: 'We could not process your subscription request. Please try again shortly.',
    },
  },
};

function mapSubscribeError(status) {
  if (status === 409) return 'consentChanged';
  if (status === 429) return 'rateLimited';
  if (status === 503) return 'unavailable';
  return 'subscribeFailed';
}

export function NewsletterDialog({
  lang,
  open,
  onClose,
  returnFocusRef,
}) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const resultRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const openerRef = useRef(null);
  const wasOpenedRef = useRef(false);

  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const t = copy[lang];

  function cancelPendingRequest() {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function resetTransientState() {
    cancelPendingRequest();
    formRef.current?.reset();
    setAgreed(false);
    setPending(false);
    setErrorCode(null);
    setSubmitted(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (wasOpenedRef.current) {
        wasOpenedRef.current = false;
        const target =
          openerRef.current && openerRef.current.isConnected ? openerRef.current : returnFocusRef?.current;
        openerRef.current = null;
        target?.focus({ preventScroll: true });
      }
      return;
    }
    if (!dialog.open) {
      const opener = document.activeElement;
      const hasExplicitOpener =
        opener instanceof HTMLElement && opener !== document.body && opener !== document.documentElement;
      openerRef.current = hasExplicitOpener ? opener : null;
      wasOpenedRef.current = true;
      dialog.showModal();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelPendingRequest();
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    resetTransientState();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (submitted) {
      resultRef.current?.focus({ preventScroll: true });
    } else {
      formRef.current?.elements.namedItem('email')?.focus({ preventScroll: true });
    }
  }, [open, submitted]);

  function resetAndClose() {
    resetTransientState();
    onClose();
  }

  async function handleSubscribeSubmit(event) {
    event.preventDefault();
    if (pending || !agreed) return;
    const form = formRef.current;
    const rawEmail = form ? new FormData(form).get('email') : '';
    const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
    if (!email) return;
    if (!NEWSLETTER_API_BASE) {
      setErrorCode('unavailable');
      return;
    }

    cancelPendingRequest();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    setPending(true);
    setErrorCode(null);

    try {
      const response = await fetch(`${NEWSLETTER_API_BASE}/subscribe`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: true, consent_version: CONSENT_VERSION }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestIdRef.current) return;
      if (response.status === 202 && payload?.status === 'accepted') {
        form?.reset();
        setAgreed(false);
        setSubmitted(true);
      } else {
        setErrorCode(mapSubscribeError(response.status));
      }
    } catch (error) {
      if (error?.name === 'AbortError' || requestId !== requestIdRef.current) return;
      setErrorCode('subscribeFailed');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (requestId === requestIdRef.current) setPending(false);
    }
  }

  return <dialog ref={dialogRef} className="newsletter-dialog"
    aria-labelledby="newsletter-title"
    onClose={resetAndClose}>
    <Button type="button" variant="ghost" size="icon" className="newsletter-close"
      aria-label={t.close} onClick={() => dialogRef.current?.close()}>
      <X size={20} aria-hidden="true" />
    </Button>
    <h2 id="newsletter-title">{t.title}</h2>

    {submitted ? <div className="newsletter-checked" role="status" tabIndex={-1} ref={resultRef}>
      <Check size={22} aria-hidden="true" />
      <h3>{t.acceptedTitle}</h3>
      <p>{t.acceptedBody}</p>
      <p>{t.acceptedUnsubscribe}</p>
      <p className="newsletter-withdrawal">{t.withdrawal}: <a href="mailto:soohyun.dev@gmail.com">soohyun.dev@gmail.com</a></p>
      <Button type="button" onClick={() => dialogRef.current?.close()}>{t.close}</Button>
    </div> : <form ref={formRef} onSubmit={handleSubscribeSubmit}>
      <label className="newsletter-email-label" htmlFor="newsletter-email">{t.email}</label>
      <input id="newsletter-email" name="email" type="email" autoComplete="email"
        placeholder="you@example.com" maxLength={254} required readOnly={pending} />
      <section className="newsletter-consent" aria-labelledby="newsletter-consent-title">
        <h3 id="newsletter-consent-title">{t.consentTitle}</h3>
        <dl>{t.terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p>{t.refusal}</p>
        <p>{t.withdrawal}: <a href="mailto:soohyun.dev@gmail.com">soohyun.dev@gmail.com</a></p>
      </section>
      <label className="newsletter-agree"><input type="checkbox" name="consent" required
        disabled={pending} checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>{t.agree}</span></label>
      {errorCode && <p className="newsletter-error" role="alert">{t.errors[errorCode]}</p>}
      <Button type="submit" className="newsletter-submit" size="lg" disabled={!agreed || pending} aria-busy={pending}>
        {pending ? t.submitting : t.submit}
      </Button>
    </form>}
  </dialog>;
}
