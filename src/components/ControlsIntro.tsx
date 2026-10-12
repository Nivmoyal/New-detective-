import { Clock, Hand, Keyboard, MessageSquare, Move, Smartphone } from 'lucide-react';
import type { AddressForm } from '../types/investigation';

const SEEN_KEY = 'precinct-controls-seen';

/** Shown once per browser; a viewer who cleared their storage just sees it again. */
export function controlsSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Seen for this visit only.
  }
}

/** How to move and act - nothing about where to go. */
export default function ControlsIntro({ addressForm, onClose }: { addressForm: AddressForm; onClose: () => void }) {
  const g = (m: string, f: string) => (addressForm === 'female' ? f : m);
  const rows = [
    { icon: <Move className="h-5 w-5" />, title: 'ג׳ויסטיק', text: `בפינה השמאלית התחתונה. ${g('גרור', 'גררי')} את העיגול לכיוון שבו ${g('אתה רוצה', 'את רוצה')} ללכת. ככל ש${g('תמשוך', 'תמשכי')} רחוק יותר - ${g('תלך', 'תלכי')} מהר יותר.` },
    { icon: <Hand className="h-5 w-5" />, title: 'הקשה', text: `${g('הקש', 'הקישי')} על אדם או על חפץ - הדמות שלך תלך אליו לבד ותפנה אליו.` },
    { icon: <MessageSquare className="h-5 w-5" />, title: 'כפתור פעולה', text: `בפינה הימנית התחתונה. כשמישהו או משהו קרוב, הכפתור מראה מה אפשר לעשות: שיחה, בדיקה, שימוש.` },
    { icon: <Smartphone className="h-5 w-5" />, title: 'טלפון', text: 'למעלה, ליד האמינות. הודעות מהמעבדה, מהמפקדת ומהקבוצה של התחנה.' },
    { icon: <Clock className="h-5 w-5" />, title: 'שעון', text: 'הזמן עובר ברחוב ובכל צעד בחקירה. יש מי שעובד רק ביום, ויש מי שיוצא רק בלילה.' },
    { icon: <Keyboard className="h-5 w-5" />, title: 'מקלדת', text: 'במחשב: חיצים או WASD להליכה, רווח או E לפעולה.' },
  ];
  const close = () => {
    markSeen();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="איך משחקים">
      <div className="panel max-h-full w-full max-w-md animate-fadeUp overflow-y-auto p-4 shadow-2xl">
        <h2 className="mb-3 font-display text-lg font-black text-slate-100">איך זזים בשטח</h2>
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-noir-border bg-noir-deep text-police-light">{r.icon}</span>
              <span className="min-w-0 text-sm leading-relaxed">
                <span className="font-bold text-slate-100">{r.title}. </span>
                <span className="text-slate-300">{r.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <button className="btn-gold mt-4 w-full py-3" onClick={close}>
          {g('הבנתי, יוצא לעבודה', 'הבנתי, יוצאת לעבודה')}
        </button>
      </div>
    </div>
  );
}
