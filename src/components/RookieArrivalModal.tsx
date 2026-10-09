import { useState } from 'react';
import {
  Activity,
  ChevronLeft,
  FileText,
  Fingerprint,
  Folder,
  MapPin,
  Search,
  ShieldAlert,
  Siren,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { AddressForm, CaseFile, DetectiveProfile, Specialization } from '../types/investigation';
import { RANKS, SPECIALIZATIONS, WARRANT_THRESHOLD } from '../services/caseEngine';

type Mode = 'profile' | 'commander' | 'desk';

interface Props {
  mode: Mode;
  profile: DetectiveProfile | null;
  caseFile?: CaseFile | null;
  onCreateProfile?: (name: string, specialization: Specialization, addressForm: AddressForm) => void;
  onComplete?: () => void;
  onClose?: () => void;
}

const SPEC_ICONS: Record<Specialization, React.ReactNode> = {
  criminal: <Search className="h-5 w-5" />,
  intel: <Activity className="h-5 w-5" />,
  forensic: <Fingerprint className="h-5 w-5" />,
};

function Speaker({ name, role, tone = 'police' }: { name: string; role: string; tone?: 'police' | 'gold' }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
          tone === 'gold' ? 'border-evidence-light bg-evidence/15 text-evidence-light' : 'border-police-light bg-police/15 text-police-light'
        }`}
      >
        <UserCheck className="h-6 w-6" />
      </div>
      <div>
        <div className="font-display text-base font-bold text-slate-100">{name}</div>
        <div className="text-xs text-steel">{role}</div>
      </div>
    </div>
  );
}

function ProfileForm({ onCreateProfile }: { onCreateProfile: Props['onCreateProfile'] }) {
  const [name, setName] = useState('');
  const [spec, setSpec] = useState<Specialization>('criminal');
  const [form, setForm] = useState<AddressForm>('male');
  const valid = name.trim().length >= 2;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-police/50 bg-police/10">
          <Siren className="h-8 w-8 animate-siren text-police-light" />
        </div>
        <h1 className="font-display text-2xl font-black text-slate-50">התחנה</h1>
        <p className="text-sm font-bold text-evidence-light">מרחב יפתח · תחנת שרפשטיין · דרום תל אביב</p>
      </div>

      <div className="rounded-lg border border-noir-border bg-noir-deep/70 p-3 text-sm leading-relaxed text-slate-300">
        שש וחצי בבוקר. גשם דק על רחוב סלמה. סיימת את קורס החוקרים לפני שבוע, והיום זה היום הראשון שלך
        במחלק החקירות של מרחב יפתח - המרחב העמוס ביותר במחוז. מפקדת התחנה כבר מחכה לך.
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-steel">
          <UserPlus className="h-4 w-4" /> שם החוקר/ת
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="לדוגמה: נועם אברהמי"
          className="w-full rounded-lg border border-noir-border bg-noir-deep px-3 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-police-light focus:outline-none"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-bold text-steel">צורת פנייה</span>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['male', 'בלש'],
              ['female', 'בלשית'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setForm(id)}
              className={`btn border ${form === id ? 'border-police-light bg-police/20 text-white' : 'border-noir-border bg-noir-deep text-steel'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-bold text-steel">התמחות</span>
        <div className="space-y-2">
          {(Object.keys(SPECIALIZATIONS) as Specialization[]).map((id) => (
            <button
              key={id}
              onClick={() => setSpec(id)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-right transition ${
                spec === id ? 'border-evidence-light bg-evidence/10' : 'border-noir-border bg-noir-deep hover:border-slate-600'
              }`}
            >
              <span className={spec === id ? 'text-evidence-light' : 'text-steel'}>{SPEC_ICONS[id]}</span>
              <span>
                <span className="block text-sm font-bold text-slate-100">{SPECIALIZATIONS[id].label}</span>
                <span className="block text-xs leading-snug text-steel">{SPECIALIZATIONS[id].perk}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn-primary w-full py-3 text-base" disabled={!valid} onClick={() => onCreateProfile?.(name, spec, form)}>
        <MapPin className="h-5 w-5" />
        הגעה לתחנה
      </button>
    </div>
  );
}

export default function RookieArrivalModal({ mode, profile, caseFile, onCreateProfile, onComplete, onClose }: Props) {
  const [step, setStep] = useState(0);
  const g = (male: string, female: string) => (profile?.addressForm === 'female' ? female : male);

  const commanderLines = profile
    ? [
        `אז ${g('אתה', 'את')} ${profile.name}. ${g('ברוך הבא', 'ברוכה הבאה')} למרחב יפתח, תחנת שרפשטיין. אני סנ״צ אורנה ברק, מפקדת התחנה.`,
        `דרום תל אביב זה לא תרגיל בבית הספר לשוטרים. נווה שאנן, שוק לוינסקי, התחנה המרכזית הישנה, פלורנטין, שכונת שפירא. כל רחוב פה מספר סיפור, ורוב האנשים לא רוצים ש${g('תשמע', 'תשמעי')} אותו.`,
        `ראיתי בתיק האישי שלך התמחות ב${SPECIALIZATIONS[profile.specialization].label}. טוב. ${SPECIALIZATIONS[profile.specialization].perk}`,
        `הכללים שלי פשוטים. עובדים לפי ראיות, לא לפי שמועות. כל ראיה פיזית עוברת במעבדת מז״פ. ${WARRANT_THRESHOLD} ראיות מאומתות על הלוח שמצביעות על אותו חשוד - ואני חותמת על צו מעצר.`,
        `חיבור שגוי בלוח או טעות טקטית בחדר החקירות פוגעים באמינות שלך מולי ומול הפרקליטות. ${g('תהיה', 'תהיי')} ${g('יסודי', 'יסודית')}.`,
        `רפ״ק יוסי כהן יראה לך את השולחן שלך במשרד החוקרים. על השולחן כבר מחכה לך תיק. בהצלחה, ${RANKS[profile.rankIndex]} ${profile.name}.`,
      ]
    : [];

  const deskLines = profile
    ? [
        `${g('אתה החדש', 'את החדשה')}? יוסי כהן, ראש צוות. זה השולחן שלך, ליד החלון. הקפה במטבחון, והמדפסת לא עובדת מאז 2019.`,
        'לוח השעם שמעל השולחן הוא הכלי הכי חשוב שלך. שם מצמידים חשודים, ממצאים מהזירה, מניעים ואליבי, ומותחים חוט אדום בין מה שבאמת מתחבר.',
        `אליבי שמחזיק - מנקה חשוד. שלושה חוטים מאומתים לאותו חשוד - הולכים למפקדת לצו. ואם חיברת משהו שלא מתחבר, ${g('תקבל', 'תקבלי')} על זה הערה.`,
      ]
    : [];

  if (mode === 'profile') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-noir-bg">
        <div className="noir-vignette pointer-events-none fixed inset-0" />
        <div className="relative mx-auto max-w-md px-4 py-8">
          <ProfileForm onCreateProfile={onCreateProfile} />
        </div>
      </div>
    );
  }

  const lines = mode === 'commander' ? commanderLines : deskLines;
  const last = step >= lines.length - 1;
  const showCase = mode === 'desk' && last && caseFile;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="panel w-full max-w-lg animate-fadeUp p-4 shadow-2xl">
        {mode === 'commander' ? (
          <Speaker name='סנ״צ אורנה ברק' role="מפקדת תחנת שרפשטיין" />
        ) : (
          <Speaker name='רפ״ק יוסי כהן' role="ראש צוות חקירות, משרד חוקרים" tone="gold" />
        )}

        <p key={step} className="min-h-[5rem] animate-fadeUp text-[15px] leading-relaxed text-slate-200">
          {lines[step]}
        </p>

        {showCase && (
          <div className="mt-3 animate-fadeUp rounded-lg border border-evidence/50 bg-cork/60 p-3">
            <div className="mb-1 flex items-center gap-2 text-evidence-light">
              <Folder className="h-5 w-5" />
              <span className="text-xs font-bold">תיק חקירה · {caseFile.crimeType}</span>
            </div>
            <div className="font-display text-base font-bold text-slate-50">{caseFile.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{caseFile.summary}</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {lines.map((_, i) => (
              <span key={i} className={`h-1.5 w-5 rounded-full ${i <= step ? 'bg-police-light' : 'bg-noir-border'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {onClose && (
              <button className="btn-ghost" onClick={onClose}>
                אחר כך
              </button>
            )}
            {!last ? (
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
                המשך
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : mode === 'commander' ? (
              <button className="btn-primary" onClick={onComplete}>
                <ShieldAlert className="h-4 w-4" />
                קיבלתי, המפקדת
              </button>
            ) : (
              <button className="btn-gold" onClick={onComplete}>
                <FileText className="h-4 w-4" />
                לקחת את התיק מהשולחן
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
