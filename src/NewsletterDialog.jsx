import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from './components/ui/button';

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
    preview: '시안 미리보기입니다. 입력한 이메일은 저장하거나 전송하지 않습니다.',
    checkedTitle: '입력 흐름을 확인했어요',
    checkedBody: '이메일은 저장·전송되지 않았고, 구독 신청도 이루어지지 않았습니다.',
    close: '닫기',
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
    preview: 'Design preview. Your email will not be stored or sent.',
    checkedTitle: 'You have tried the form',
    checkedBody: 'Your email was not stored or sent, and no subscription was created.',
    close: 'Close',
  },
};

export function NewsletterDialog({ lang, open, onClose }) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const checkedRef = useRef(null);
  const [agreed, setAgreed] = useState(false);
  const [checked, setChecked] = useState(false);
  const t = copy[lang];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) return;
    if (!dialog.open) dialog.showModal();
    formRef.current?.elements.namedItem('email')?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (checked) checkedRef.current?.focus();
  }, [checked]);

  function resetAndClose() {
    formRef.current?.reset();
    setAgreed(false);
    setChecked(false);
    onClose();
  }

  return <dialog ref={dialogRef} className="newsletter-dialog"
    aria-labelledby="newsletter-title" aria-describedby="newsletter-preview"
    onClose={resetAndClose}>
    <Button type="button" variant="ghost" size="icon" className="newsletter-close"
      aria-label={t.close} onClick={() => dialogRef.current.close()}>
      <X size={20} aria-hidden="true" />
    </Button>
    <h2 id="newsletter-title">{t.title}</h2>
    <p id="newsletter-preview" className="newsletter-preview">{t.preview}</p>
    {checked ? <div className="newsletter-checked" role="status" tabIndex={-1} ref={checkedRef}>
      <Check size={22} aria-hidden="true" />
      <h3>{t.checkedTitle}</h3><p>{t.checkedBody}</p>
      <Button type="button" onClick={() => dialogRef.current.close()}>{t.close}</Button>
    </div> : <form ref={formRef} onSubmit={event => {
      event.preventDefault();
      formRef.current.reset();
      setAgreed(false);
      setChecked(true);
    }}>
      <label className="newsletter-email-label" htmlFor="newsletter-email">{t.email}</label>
      <input id="newsletter-email" name="email" type="email" autoComplete="email"
        placeholder="you@example.com" maxLength={254} required aria-describedby="newsletter-preview" />
      <section className="newsletter-consent" aria-labelledby="newsletter-consent-title">
        <h3 id="newsletter-consent-title">{t.consentTitle}</h3>
        <dl>{t.terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p>{t.refusal}</p>
        <p>{t.withdrawal}: <a href="mailto:soohyun.dev@gmail.com">soohyun.dev@gmail.com</a></p>
      </section>
      <label className="newsletter-agree"><input type="checkbox" name="consent" required
        checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>{t.agree}</span></label>
      <Button type="submit" className="newsletter-submit" size="lg" disabled={!agreed}>{t.submit}</Button>
    </form>}
  </dialog>;
}
