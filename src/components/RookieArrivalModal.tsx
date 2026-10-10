import { useState } from 'react';
import {
  ChevronLeft,
  Eye,
  FileText,
  Folder,
  MapPin,
  Pause,
  Play,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import type { AddressForm, CaseFile, CharacterLook, DetectiveProfile, Specialization } from '../types/investigation';
import { RANKS, WARRANT_THRESHOLD } from '../services/caseEngine';
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
import CharacterBanner from './CharacterBanner';
import SpritePreview from './pixel/SpritePreview';
import PixelPortrait from './pixel/PixelPortrait';

type Mode = 'profile' | 'commander' | 'desk';

interface Props {
  mode: Mode;
  profile: DetectiveProfile | null;
  cases?: CaseFile[];
  onCreateProfile?: (name: string, specialization: Specialization, addressForm: AddressForm, look: CharacterLook) => void;
  onComplete?: () => void;
  onClose?: () => void;
}


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
  const [look, setLook] = useState<CharacterLook>(defaultPlayerLook('male'));
  const [walking, setWalking] = useState(true);
  const valid = name.trim().length >= 2;
  const set = (patch: Partial<CharacterLook>) => setLook((l) => ({ ...l, ...patch }));

  return (
    <div>
      {/* Live pixel-art preview */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-noir-border bg-noir-bg/95 backdrop-blur">
        <div className="relative h-[34vh] max-h-72 min-h-52 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,rgba(37,99,235,0.2),transparent_60%)]" />
          <div className="crt-overlay pointer-events-none absolute inset-0" />
          <div className="absolute inset-x-0 bottom-9 flex items-end justify-center gap-6">
            <SpritePreview look={look} walking={walking} scale={5} />
            <div className="mb-2 rounded-lg border-2 border-noir-border bg-[#141b26]">
              <PixelPortrait look={look} size={120} className="block" />
            </div>
          </div>
          <div className="absolute right-3 top-3">
            <div className="font-display text-xl font-black text-slate-50">תיק פתוח</div>
            <div className="text-[11px] font-bold text-evidence-light">מרחב יפתח · תחנת שרפשטיין</div>
          </div>
          <button
            onClick={() => setWalking((w) => !w)}
            className="btn-ghost absolute bottom-3 left-3 px-3 py-1.5 text-xs"
            aria-label={walking ? 'עצירה' : 'הליכה'}
          >
            {walking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {walking ? 'עמידה' : 'הליכה'}
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

        <button
          className="btn-primary w-full py-3 text-base"
          disabled={!valid}
          onClick={() => onCreateProfile?.(name, 'criminal', look.body, look)}
        >
          <MapPin className="h-5 w-5" />
          {valid ? 'הגעה לתחנה' : 'כתבו את השם שלכם כדי להמשיך'}
        </button>
      </div>
    </div>
  );
}

export default function RookieArrivalModal({ mode, profile, cases = [], onCreateProfile, onComplete, onClose }: Props) {
  const [step, setStep] = useState(0);
  const g = (male: string, female: string) => (profile?.addressForm === 'female' ? female : male);

  const commanderLines = profile
    ? [
        `אז ${g('אתה', 'את')} ${profile.name}. ${g('ברוך הבא', 'ברוכה הבאה')} למרחב יפתח, תחנת שרפשטיין. אני סנ״צ אורנה ברק, מפקדת התחנה.`,
        `דרום תל אביב זה לא תרגיל בבית הספר לשוטרים. נווה שאנן, שוק לוינסקי, התחנה המרכזית הישנה, פלורנטין, שכונת שפירא. כל רחוב פה מספר סיפור, ורוב האנשים לא רוצים ש${g('תשמע', 'תשמעי')} אותו.`,
        `הכללים שלי פשוטים. עובדים לפי ראיות, לא לפי שמועות. כל ראיה פיזית עוברת אצל ד״ר מאיה שטרן במעבדת מז״פ. ${WARRANT_THRESHOLD} ראיות מאומתות על הלוח שמצביעות על אותו חשוד - ואני חותמת על צו מעצר.`,
        `חיבור שגוי בלוח או טעות טקטית בחדר החקירות פוגעים באמינות שלך מולי ומול הפרקליטות. ${g('תהיה', 'תהיי')} ${g('יסודי', 'יסודית')}.`,
        `על השולחן שלך במשרד החוקרים מחכים תיקים פתוחים. באיזה סדר, איפה מתחילים ואת מי מתשאלים - זה שלך. אני רוצה תוצאות, לא דיווחים. בהצלחה, ${RANKS[profile.rankIndex]} ${profile.name}.`,
      ]
    : [];

  const deskLines = profile
    ? [
        `${g('אתה החדש', 'את החדשה')}? יוסי כהן, ראש צוות. זה השולחן שלך, ליד החלון. הקפה במטבחון, והמדפסת לא עובדת מאז 2019.`,
        'לוח השעם ליד השולחן הוא הכלי הכי חשוב שלך. שם מצמידים חשודים, ממצאים מהזירה, מניעים ואליבי, ומותחים חוט אדום בין מה שבאמת מתחבר.',
        `שלושה תיקים פתוחים במרחב, ויגיעו עוד. אף אחד לא יגיד לך מאיפה להתחיל. כל ראיה ש${g('תמצא', 'תמצאי')} בשטח תיכנס אוטומטית לתיק שלה.`,
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
  const showCases = mode === 'desk' && last && cases.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="panel w-full max-w-lg animate-fadeUp overflow-hidden shadow-2xl">
        <CharacterBanner character={mode === 'commander' ? COMMANDER : MENTOR} tone={mode === 'commander' ? 'police' : 'gold'} />
        <div className="p-4">
          <p key={step} className="min-h-[5rem] animate-fadeUp text-[15px] leading-relaxed text-slate-200">
            {lines[step]}
          </p>

          {showCases && (
            <div className="mt-3 max-h-[38vh] space-y-2 overflow-y-auto scrollbar-thin">
              {cases.map((c) => (
                <div key={c.id} className="animate-fadeUp rounded-lg border border-evidence/50 bg-cork/60 p-3">
                  <div className="mb-1 flex items-center gap-2 text-evidence-light">
                    <Folder className="h-4 w-4" />
                    <span className="text-[11px] font-bold">{c.crimeType} · {c.locationName}</span>
                  </div>
                  <div className="font-display text-sm font-bold text-slate-50">{c.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{c.summary}</p>
                </div>
              ))}
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
                  פתיחת התיקים
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

