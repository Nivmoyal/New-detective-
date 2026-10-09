import { useState } from 'react';
import {
  Activity,
  ChevronLeft,
  Eye,
  FileText,
  Fingerprint,
  Folder,
  MapPin,
  Pause,
  Play,
  Search,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import type { AddressForm, CaseFile, CharacterLook, DetectiveProfile, Specialization } from '../types/investigation';
import { RANKS, SPECIALIZATIONS, WARRANT_THRESHOLD } from '../services/caseEngine';
import {
  COMMANDER,
  HAIR_COLORS,
  HAIR_STYLE_OPTIONS,
  MENTOR,
  PANTS_COLORS,
  PLAYER_OUTFITS,
  SKIN_TONES,
  TOP_COLORS,
  defaultPlayerLook,
} from '../data/characters';
import CharacterPortrait from './three/CharacterPortrait';
import CharacterBanner from './CharacterBanner';

type Mode = 'profile' | 'commander' | 'desk';

interface Props {
  mode: Mode;
  profile: DetectiveProfile | null;
  caseFile?: CaseFile | null;
  onCreateProfile?: (name: string, specialization: Specialization, addressForm: AddressForm, look: CharacterLook) => void;
  onComplete?: () => void;
  onClose?: () => void;
}

const SPEC_ICONS: Record<Specialization, React.ReactNode> = {
  criminal: <Search className="h-5 w-5" />,
  intel: <Activity className="h-5 w-5" />,
  forensic: <Fingerprint className="h-5 w-5" />,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold text-steel">{title}</div>
      {children}
    </div>
  );
}

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          aria-label={`צבע ${c}`}
          onClick={() => onChange(c)}
          className={`h-9 w-9 rounded-full border-2 transition ${value === c ? 'scale-110 border-evidence-light' : 'border-noir-border'}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
            value === o.id ? 'border-police-light bg-police/20 text-white' : 'border-noir-border bg-noir-deep text-steel'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProfileForm({ onCreateProfile }: { onCreateProfile: Props['onCreateProfile'] }) {
  const [name, setName] = useState('');
  const [spec, setSpec] = useState<Specialization>('criminal');
  const [look, setLook] = useState<CharacterLook>(defaultPlayerLook('male'));
  const [walking, setWalking] = useState(false);
  const valid = name.trim().length >= 2;
  const set = (patch: Partial<CharacterLook>) => setLook((l) => ({ ...l, ...patch }));

  return (
    <div>
      {/* Live 3D preview */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-noir-border bg-noir-bg/95 backdrop-blur">
        <div className="relative h-[38vh] max-h-80 min-h-56">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,rgba(37,99,235,0.18),transparent_60%)]" />
          <CharacterPortrait look={look} framing="full" turntable walking={walking} className="absolute inset-0" />
          <div className="absolute right-3 top-3">
            <div className="font-display text-xl font-black text-slate-50">התחנה</div>
            <div className="text-[11px] font-bold text-evidence-light">מרחב יפתח · תחנת שרפשטיין</div>
          </div>
          <button
            onClick={() => setWalking((w) => !w)}
            className="btn-ghost absolute bottom-3 left-3 px-3 py-1.5 text-xs"
            aria-label={walking ? 'עצירה' : 'הליכה'}
          >
            {walking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {walking ? 'עצירה' : 'הדגמת הליכה'}
          </button>
          {name.trim() && (
            <div className="absolute bottom-3 right-3 rounded-md bg-noir-panel/90 px-2 py-1 text-sm font-bold">{name.trim()}</div>
          )}
        </div>
      </div>

      <div className="space-y-5 py-5">
        <div className="rounded-lg border border-noir-border bg-noir-deep/70 p-3 text-sm leading-relaxed text-slate-300">
          שש וחצי בבוקר. גשם דק על רחוב סלמה. סיימת את קורס החוקרים לפני שבוע, והיום זה היום הראשון שלך במחלק החקירות של
          מרחב יפתח. לפני שנכנסים - איך נראה החוקר או החוקרת החדשים של התחנה?
        </div>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-steel">
            <UserPlus className="h-4 w-4" /> השם שלך
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="לדוגמה: נועם אברהמי"
            className="w-full rounded-lg border border-noir-border bg-noir-deep px-3 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-police-light focus:outline-none"
          />
        </label>

        <Section title="דמות">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['male', 'בלש'],
                ['female', 'בלשית'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  set({
                    body: id,
                    beard: id === 'female' ? false : look.beard,
                    hairStyle: look.body !== id ? defaultPlayerLook(id).hairStyle : look.hairStyle,
                  })
                }
                className={`btn border ${look.body === id ? 'border-police-light bg-police/20 text-white' : 'border-noir-border bg-noir-deep text-steel'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="גוון עור">
          <Swatches colors={SKIN_TONES} value={look.skin} onChange={(skin) => set({ skin })} />
        </Section>

        <Section title="תסרוקת">
          <Chips options={HAIR_STYLE_OPTIONS} value={look.hairStyle} onChange={(hairStyle) => set({ hairStyle })} />
        </Section>

        <Section title="צבע שיער">
          <Swatches colors={HAIR_COLORS} value={look.hairColor} onChange={(hairColor) => set({ hairColor })} />
        </Section>

        <Section title="לבוש">
          <Chips options={PLAYER_OUTFITS} value={look.outfit} onChange={(outfit) => set({ outfit })} />
        </Section>

        <Section title="צבע הז׳קט">
          <Swatches colors={TOP_COLORS} value={look.topColor} onChange={(topColor) => set({ topColor })} />
        </Section>

        <Section title="צבע מכנסיים">
          <Swatches colors={PANTS_COLORS} value={look.pantsColor} onChange={(pantsColor) => set({ pantsColor })} />
        </Section>

        <Section title="אביזרים">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => set({ glasses: !look.glasses })}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                look.glasses ? 'border-police-light bg-police/20 text-white' : 'border-noir-border bg-noir-deep text-steel'
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> משקפיים
            </button>
            {look.body === 'male' && (
              <button
                onClick={() => set({ beard: !look.beard })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                  look.beard ? 'border-police-light bg-police/20 text-white' : 'border-noir-border bg-noir-deep text-steel'
                }`}
              >
                זקן
              </button>
            )}
          </div>
        </Section>

        <Section title="התמחות">
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
        </Section>

        <button
          className="btn-primary w-full py-3 text-base"
          disabled={!valid}
          onClick={() => onCreateProfile?.(name, spec, look.body, look)}
        >
          <MapPin className="h-5 w-5" />
          {valid ? 'הגעה לתחנה' : 'כתבו את השם שלכם כדי להמשיך'}
        </button>
      </div>
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
        `הכללים שלי פשוטים. עובדים לפי ראיות, לא לפי שמועות. כל ראיה פיזית עוברת אצל ד״ר מאיה שטרן במעבדת מז״פ. ${WARRANT_THRESHOLD} ראיות מאומתות על הלוח שמצביעות על אותו חשוד - ואני חותמת על צו מעצר.`,
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
        <div className="relative mx-auto max-w-md px-4">
          <ProfileForm onCreateProfile={onCreateProfile} />
        </div>
      </div>
    );
  }

  const lines = mode === 'commander' ? commanderLines : deskLines;
  const last = step >= lines.length - 1;
  const showCase = mode === 'desk' && last && caseFile;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="panel w-full max-w-lg animate-fadeUp overflow-hidden shadow-2xl">
        <CharacterBanner character={mode === 'commander' ? COMMANDER : MENTOR} tone={mode === 'commander' ? 'police' : 'gold'} />
        <div className="p-4">
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
    </div>
  );
}

