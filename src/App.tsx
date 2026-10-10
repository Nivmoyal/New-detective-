import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { connectCloud, type CloudSave } from './state/cloudSave';
import { Compass, Crosshair, Folder, Lock, ShieldAlert, Smartphone } from 'lucide-react';
import type { View } from './types/investigation';
import { MAPS, SCENE_MAP_IDS, STATION_MAP_ID } from './data/maps';
import { PARTNER, partnerQuips } from './pixel/world/partner';
import { GROUP_CHAT, type PhoneMessage } from './state/messages';
import type { PlacedFacility } from './pixel/world/types';
import { EARLY_WARRANT_COST, EARLY_WARRANT_MIN_RELIABILITY, PRESS_WITNESS_COST, emptyProgress, getCase, isCaseUnlocked, isHotspotAvailable, loadCases, validateLink } from './services/caseEngine';
import {
  WARRANT_DENIAL_PENALTY,
  activeProgress,
  storyComplete,
  gameReducer,
  knownCaseIds,
  loadState,
  localSavedAt,
  parseState,
  saveState,
  warrantJustified,
} from './state/gameReducer';
import PoliceHeader from './components/PoliceHeader';
import RookieArrivalModal from './components/RookieArrivalModal';
import PixelWorld, { type WorldHotspot } from './components/PixelWorld';
import ChatDialog from './components/ChatDialog';
import { COMMANDER, INTERROGATION_OFFICER, type ChatNpc } from './data/characters';
import { chatAnnoyed, genderize } from './pixel/world/humor';
import { activeIncident, type Incident } from './data/incidents';
import IncidentDialog from './components/IncidentDialog';
import type { CharacterRef } from './types/investigation';
import EvidenceBoard from './components/EvidenceBoard';
import InterrogationRoom from './components/InterrogationRoom';
import StationHub from './components/StationHub';
import HotspotDialog from './components/HotspotDialog';
import { CaseClosedModal, CommanderModal, EvidenceRoomModal, LabModal, NoticeModal, TravelModal } from './components/StationModals';

// How many lines of each character the detective has already heard, and how often they were pestered since.
const chatHeard = new Map<string, number>();
const chatPestered = new Map<string, number>();

type ModalState =
  | { type: 'arrivalCommander' }
  | { type: 'arrivalDesk' }
  | { type: 'commander' }
  | { type: 'lab' }
  | { type: 'evidenceRoom' }
  | { type: 'travel' }
  | { type: 'hotspot'; spot: WorldHotspot }
  | { type: 'chat'; npc: ChatNpc; annoyed: string }
  | { type: 'incident'; incident: Incident }
  | { type: 'notice'; title: string; text: string; character?: CharacterRef; tone?: 'red' | 'gold' | 'police'; earlyWarrant?: WorldHotspot }
  | null;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadState);
  const [modal, setModal] = useState<ModalState>(null);

  /* ---------------- Saving ---------------- */
  // Every change is saved in the browser at once and, when the player has a
  // claude.ai space, in the cloud a moment later. On open, the newer copy wins.
  const [cloudStatus, setCloudStatus] = useState<'connecting' | 'cloud' | 'local'>('connecting');
  const lastSaved = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const cloud = useRef<CloudSave | null>(null);
  const pending = useRef<{ json: string; at: number } | null>(null);
  const writing = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flushCloud = useCallback(async () => {
    window.clearTimeout(timer.current);
    const c = cloud.current;
    const next = pending.current;
    if (!c || !next || writing.current) return;
    writing.current = true;
    pending.current = null;
    const ok = await c.save(next.json, next.at);
    writing.current = false;
    if (!ok) {
      // This viewer can't keep a cloud save; the browser save carries on.
      cloud.current = null;
      setCloudStatus('local');
      return;
    }
    if (pending.current) void flushCloud();
  }, []);

  useEffect(() => {
    const json = JSON.stringify(state);
    // The game as it was loaded is not a new save.
    if (lastSaved.current === null) {
      lastSaved.current = json;
      return;
    }
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    const at = Date.now();
    saveState(state, at);
    pending.current = { json, at };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushCloud(), 1500);
  }, [state, flushCloud]);

  useEffect(() => {
    let alive = true;
    void connectCloud().then(async (c) => {
      if (!alive) return;
      if (!c) {
        setCloudStatus('local');
        return;
      }
      const remote = await c.load().catch(() => null);
      if (!alive) return;
      const localAt = localSavedAt();
      if (remote && remote.savedAt > localAt) {
        const loaded = parseState(remote.raw);
        if (loaded) {
          lastSaved.current = JSON.stringify(loaded);
          saveState(loaded, remote.savedAt);
          dispatch({ type: 'LOAD_GAME', state: loaded });
        }
      } else if (stateRef.current.profile && (!remote || localAt > remote.savedAt)) {
        // This device has the newer game: send it up.
        pending.current = { json: JSON.stringify(stateRef.current), at: localAt || Date.now() };
      }
      cloud.current = c;
      setCloudStatus('cloud');
      void flushCloud();
    });
    // Leaving the page: don't wait for the pause.
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushCloud();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flushCloud]);

  const { profile, arrivalStep } = state;
  const caseFile = state.activeCaseId ? getCase(state.activeCaseId) : null;
  const progress = activeProgress(state);
  const map = MAPS[state.currentMapId] ?? MAPS[STATION_MAP_ID];
  /* ---------------- Phone ---------------- */
  // A new message pops up for a few seconds; the full list is in the header.
  const [toast, setToast] = useState<PhoneMessage | null>(null);
  const seenMessages = useRef(state.messages.length ? state.messages[state.messages.length - 1].id : '');
  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (!last || last.id === seenMessages.current) return;
    seenMessages.current = last.id;
    if (last.read) return;
    setToast(last);
    const t = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(t);
  }, [state.messages]);
  // The station's group chat buzzes every few minutes of play.
  const playing = !!profile && state.arrivalStep === 'done';
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        const s = stateRef.current;
        const k = s.messages.filter((m) => m.from === 'קבוצת התחנה').length + (s.profile?.solvedCases.length ?? 0);
        dispatch({ type: 'ADD_MESSAGE', from: 'קבוצת התחנה', text: GROUP_CHAT[k % GROUP_CHAT.length] });
        schedule();
      }, 180000 + Math.random() * 180000);
    };
    schedule();
    return () => window.clearTimeout(id);
  }, [playing]);

  // Dana comes along on about six patrols out of ten.
  const partner = useMemo(
    () =>
      profile && SCENE_MAP_IDS.includes(map.id) && Math.random() < 0.6
        ? { look: PARTNER.look, quips: partnerQuips(map.id).map((q) => genderize(q, profile.addressForm)) }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map.id, profile?.addressForm],
  );
  const g = (m: string, f: string) => (profile?.addressForm === 'female' ? f : m);

  // Every lead of every case lives in the world from the start.
  const worldHotspots = useMemo<WorldHotspot[]>(() => {
    const out: WorldHotspot[] = [];
    const solvedCount = state.profile?.solvedCases.length ?? 0;
    for (const c of loadCases()) {
      if (!isCaseUnlocked(c, solvedCount)) continue;
      const p = state.progress[c.id] ?? emptyProgress();
      for (const h of c.hotspots) {
        if (h.mapId !== map.id) continue;
        out.push({ hotspot: h, caseId: c.id, available: isHotspotAvailable(h, p), visited: p.visitedHotspots.includes(h.id) });
      }
    }
    return out;
  }, [state.progress, map.id, state.profile?.solvedCases.length]);

  // Case waiting in the interrogation room: the focused one first, then any other.
  const warrantCaseId = useMemo(() => {
    const open = loadCases().filter((c) => state.progress[c.id]?.warrantSuspectId && !state.progress[c.id]?.solved);
    return (open.find((c) => c.id === state.activeCaseId) ?? open[0])?.id ?? null;
  }, [state.progress, state.activeCaseId]);

  const savePosition = useCallback((mapId: string, x: number, y: number) => dispatch({ type: 'SAVE_POSITION', mapId, x, y }), []);
  const setView = (view: View) => dispatch({ type: 'SET_VIEW', view });

  const openInterrogation = () => {
    if (state.interrogation) return setView('interrogation');
    if (warrantCaseId) dispatch({ type: 'START_INTERROGATION', caseId: warrantCaseId });
    else
      setModal({
        type: 'notice',
        title: 'חדר החקירות ריק',
        text: `אין לי עצור בשבילך. בלי צו מעצר אני לא מכניס אף אחד לחדר. צו חותמת רק המפקדת. ${g('אתה רוצה', 'את רוצה')} לחקור מישהו בינתיים? יש את מכונת הקפה. היא אשמה בהרבה דברים.`,
        character: INTERROGATION_OFFICER,
      });
  };

  const handleFacility = useCallback(
    (f: PlacedFacility) => {
      switch (f.action) {
        case 'commander':
          setModal(arrivalStep === 'toCommander' ? { type: 'arrivalCommander' } : { type: 'commander' });
          return;
        case 'desk':
          if (arrivalStep !== 'done') setModal({ type: 'arrivalDesk' });
          else setView(state.activeCaseId ? 'board' : 'hub');
          return;
        case 'lab':
          setModal({ type: 'lab' });
          return;
        case 'evidenceRoom':
          setModal({ type: 'evidenceRoom' });
          return;
        case 'interrogation':
          openInterrogation();
          return;
        case 'exit':
          setModal({ type: 'travel' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arrivalStep, state.activeCaseId, warrantCaseId, state.interrogation],
  );

  const handleHotspot = useCallback((spot: WorldHotspot) => {
    if (!spot.available) {
      setModal({
        type: 'notice',
        title: spot.hotspot.lockedLabel ?? spot.hotspot.title,
        text: spot.hotspot.lockedText ?? 'אין פה כרגע מה לעשות.',
        character: spot.hotspot.character,
        tone: 'gold',
        earlyWarrant: spot.hotspot.requires?.length ? spot : undefined,
      });
      return;
    }
    setModal({ type: 'hotspot', spot });
  }, []);
  const handleChat = useCallback(
    (npc: ChatNpc) => {
      // Their own last word first; after that the grumbles, starting at a
      // different one for every person.
      const lines = chatAnnoyed((m, f) => (profile?.addressForm === 'female' ? f : m));
      const own = npc.done ? [npc.done] : [];
      let offset = 0;
      for (const ch of npc.id) offset = (offset * 31 + ch.charCodeAt(0)) >>> 0;
      let annoyed = own[0] ?? lines[offset % lines.length];
      if ((chatHeard.get(npc.id) ?? 0) >= npc.lines.length) {
        const n = chatPestered.get(npc.id) ?? 0;
        chatPestered.set(npc.id, n + 1);
        annoyed = n < own.length ? own[n] : lines[(offset + n - own.length) % lines.length];
      }
      setModal({ type: 'chat', npc, annoyed });
    },
    [profile?.addressForm],
  );
  const handleIncident = useCallback((incident: Incident) => setModal({ type: 'incident', incident }), []);
  const handleExamine = useCallback((title: string, text: string) => setModal({ type: 'notice', title, text, tone: 'police' }), []);

  /* ---------------- Onboarding: character creation ---------------- */
  if (!profile) {
    return (
      <div dir="rtl" className="min-h-full bg-noir-bg font-sans text-slate-100">
        <RookieArrivalModal
          mode="profile"
          profile={null}
          onCreateProfile={(name, specialization, addressForm, look) => dispatch({ type: 'CREATE_PROFILE', name, specialization, addressForm, look })}
        />
      </div>
    );
  }

  const promotionCase = state.promotionCaseId ? getCase(state.promotionCaseId) : null;
  const interrogationCase = state.interrogationCaseId ? getCase(state.interrogationCaseId) : caseFile;
  const interrogationProgress = interrogationCase ? (state.progress[interrogationCase.id] ?? emptyProgress()) : null;
  const navItems: { view: View; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { view: 'map', label: 'שטח', icon: <Compass className="h-5 w-5" /> },
    { view: 'hub', label: 'תיקים', icon: <Folder className="h-5 w-5" /> },
    { view: 'board', label: 'לוח ראיות', icon: <Crosshair className="h-5 w-5" />, disabled: !caseFile },
    {
      view: 'interrogation',
      label: 'חקירה',
      icon: warrantCaseId ? <ShieldAlert className="h-5 w-5" /> : <Lock className="h-5 w-5" />,
      disabled: !warrantCaseId && !state.interrogation,
    },
  ];

  const requestWarrant = (suspectId: string) => {
    const ok = warrantJustified(state, suspectId);
    const suspect = caseFile?.suspects.find((s) => s.id === suspectId);
    dispatch({ type: 'REQUEST_WARRANT', suspectId });
    setModal({
      type: 'notice',
      title: ok ? 'הצו נחתם' : 'בקשת הצו נדחתה',
      tone: ok ? 'police' : 'red',
      character: COMMANDER,
      text: ok
        ? `קראתי. הראיות מחזיקות. אני חותמת על צו מעצר נגד ${suspect?.name}. הוא בדרך לחדר החקירות - ${g('תהיה מוכן', 'תהיי מוכנה')}.`
        : `על סמך מה? אני לא חותמת על צו בגלל תחושת בטן. מה שיש לך על הלוח לא יחזיק חמש דקות מול שופט מעצרים. ${g('תחזור', 'תחזרי')} כשיהיה לך תיק. (אמינות -${WARRANT_DENIAL_PENALTY})`,
    });
  };

  return (
    <div dir="rtl" className="relative flex h-full flex-col overflow-hidden bg-noir-bg font-sans text-slate-100">
      {state.view !== 'interrogation' && (
        <PoliceHeader profile={profile} activeCaseTitle={caseFile?.shortTitle ?? null} cloudSaved={cloudStatus === 'cloud'} messages={state.messages} onReadMessages={() => dispatch({ type: 'READ_MESSAGES' })} onReset={() => dispatch({ type: 'RESET' })} />
      )}
      {toast && (
          <button
            className="absolute left-1/2 top-12 z-30 flex w-[min(92%,26rem)] -translate-x-1/2 animate-fadeUp items-start gap-2 rounded-xl border border-police/50 bg-noir-panel/95 p-2.5 text-right shadow-2xl"
            onClick={() => setToast(null)}
          >
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-police-light" />
            <span className="min-w-0 text-xs leading-relaxed">
              <span className="font-bold text-sky-300">{toast.from}: </span>
              <span className="text-slate-200">{toast.text}</span>
            </span>
          </button>
        )}

      <main className="relative min-h-0 flex-1">
        {state.view === 'map' && (
          <PixelWorld
            key={map.id}
            map={map}
            playerLook={profile.look}
            addressForm={profile.addressForm}
            hotspots={worldHotspots}
            incident={activeIncident(map.id, state.incidentsDone)}
            onIncident={handleIncident}
            startPosition={state.positions[map.id]}
            paused={modal !== null}
            onFacility={handleFacility}
            onHotspot={handleHotspot}
            onChat={handleChat}
            onExamine={handleExamine}
            onPositionChange={savePosition}
            partner={partner}
          />
        )}

        {state.view === 'hub' && (
          <StationHub
            profile={profile}
            arrivalStep={arrivalStep}
            knownCaseIds={knownCaseIds(state)}
            activeCaseId={state.activeCaseId}
            allProgress={state.progress}
            onFocus={(caseId) => dispatch({ type: 'FOCUS_CASE', caseId })}
            onOpenBoard={() => setView('board')}
            onOpenInterrogation={openInterrogation}
          />
        )}

        {state.view === 'board' && caseFile && progress && (
          <EvidenceBoard
            caseFile={caseFile}
            progress={progress}
            onLink={(suspectId, evidenceId) => {
              const verdict = validateLink(caseFile, suspectId, evidenceId);
              dispatch({ type: 'LINK_RESULT', suspectId, evidenceId, verdict });
              return verdict;
            }}
            onRemoveLink={(suspectId, evidenceId) => dispatch({ type: 'REMOVE_LINK', suspectId, evidenceId })}
            onIssueWarrant={requestWarrant}
            onStartInterrogation={openInterrogation}
          />
        )}

        {state.view === 'interrogation' &&
          (state.interrogation && interrogationCase && interrogationProgress ? (
            <InterrogationRoom
              detectiveLook={profile.look}
              caseFile={interrogationCase}
              progress={interrogationProgress}
              session={state.interrogation}
              onTactic={(tactic, evidenceId) => dispatch({ type: 'INTERROGATION_ACTION', tactic, evidenceId })}
              onEnd={() => dispatch({ type: 'END_INTERROGATION' })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <ShieldAlert className="h-10 w-10 text-alert" />
              <div className="font-display text-lg font-bold">חדר חקירות באזהרה</div>
              <p className="max-w-sm text-sm text-steel">
                {warrantCaseId ? 'החשוד ממתין בחדר. החקירה תתועד במצלמה ובהקלטה.' : 'אין עצור לחקירה.'}
              </p>
              {warrantCaseId && (
                <button className="btn-primary" onClick={() => dispatch({ type: 'START_INTERROGATION', caseId: warrantCaseId })}>
                  כניסה לחדר החקירות
                </button>
              )}
            </div>
          ))}
      </main>

      <nav className="grid grid-cols-4 border-t border-noir-border bg-noir-panel pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <button
            key={item.view}
            disabled={item.disabled}
            onClick={() => (item.view === 'interrogation' ? openInterrogation() : setView(item.view))}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition disabled:opacity-30 ${
              state.view === item.view ? 'text-police-light' : 'text-steel'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* ---------------- Modals ---------------- */}
      {modal?.type === 'arrivalCommander' && (
        <RookieArrivalModal
          mode="commander"
          profile={profile}
          onClose={() => setModal(null)}
          onComplete={() => {
            dispatch({ type: 'ARRIVAL_COMMANDER_DONE' });
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'arrivalDesk' && (
        <RookieArrivalModal
          mode="desk"
          profile={profile}
          cases={loadCases().filter((c) => isCaseUnlocked(c, profile.solvedCases.length))}
          onClose={() => setModal(null)}
          onComplete={() => {
            dispatch({ type: 'OPEN_CASE_FILES' });
            setModal(null);
            setView('hub');
          }}
        />
      )}
      {modal?.type === 'commander' && (
        <CommanderModal profile={profile} caseFile={caseFile} progress={progress} onHint={() => dispatch({ type: 'USE_HINT' })} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'lab' && <LabModal allProgress={state.progress} addressForm={profile.addressForm} onAnalyze={() => dispatch({ type: 'ANALYZE_LAB' })} onClose={() => setModal(null)} />}
      {modal?.type === 'evidenceRoom' && <EvidenceRoomModal caseFile={caseFile} progress={progress} addressForm={profile.addressForm} onClose={() => setModal(null)} />}
      {modal?.type === 'travel' && (
        <TravelModal
          currentMapId={map.id}
          addressForm={profile.addressForm}
          onTravel={(mapId) => {
            dispatch({ type: 'TRAVEL', mapId });
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'hotspot' && (
        <HotspotDialog
          hotspot={modal.spot.hotspot}
          caseFile={getCase(modal.spot.caseId)}
          progress={state.progress[modal.spot.caseId] ?? emptyProgress()}
          onCollect={() => dispatch({ type: 'VISIT_HOTSPOT', caseId: modal.spot.caseId, hotspotId: modal.spot.hotspot.id })}
          onPress={() => dispatch({ type: 'PRESS_WITNESS', caseId: modal.spot.caseId, hotspotId: modal.spot.hotspot.id })}
          pressCost={PRESS_WITNESS_COST}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'notice' && (
        <NoticeModal
          title={modal.title}
          text={modal.text}
          character={modal.character}
          tone={modal.tone}
          action={
            modal.earlyWarrant && profile
              ? {
                  label: `לבקש מהמפקדת צו מוקדם (אמינות -${EARLY_WARRANT_COST})`,
                  note:
                    profile.reliability >= EARLY_WARRANT_MIN_RELIABILITY
                      ? 'בלי הראיה שפותחת את הדלת הזאת, המפקדת תחתום - אבל תזכור. מי שמבקש צווים בלי בסיס מאבד אמון.'
                      : `המפקדת לא תחתום על צו מוקדם למי שהאמינות שלו מתחת ל-${EARLY_WARRANT_MIN_RELIABILITY}%. קודם תחזיר${g('', 'י')} לה את האמון.`,
                  disabled: profile.reliability < EARLY_WARRANT_MIN_RELIABILITY,
                  onClick: () => {
                    const spot = modal.earlyWarrant!;
                    dispatch({ type: 'FORCE_HOTSPOT', caseId: spot.caseId, hotspotId: spot.hotspot.id });
                    setModal({ type: 'hotspot', spot: { ...spot, available: true } });
                  },
                }
              : undefined
          }
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'incident' && (
        <IncidentDialog
          incident={modal.incident}
          addressForm={profile.addressForm}
          onResolve={(c) => dispatch({ type: 'RESOLVE_INCIDENT', id: modal.incident.id, reliability: c.reliability, intel: c.intel })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'chat' && (
        <ChatDialog
          npc={modal.npc}
          heard={chatHeard.get(modal.npc.id) ?? 0}
          annoyed={modal.annoyed}
          addressForm={profile.addressForm}
          onHeard={(n) => chatHeard.set(modal.npc.id, Math.max(n, chatHeard.get(modal.npc.id) ?? 0))}
          onClose={() => setModal(null)}
        />
      )}

      {promotionCase && state.progress[promotionCase.id] && (
        <CaseClosedModal
          profile={profile}
          caseFile={promotionCase}
          progress={state.progress[promotionCase.id]}
          allSolved={storyComplete(state) && !promotionCase.generated}
          newCases={loadCases().filter((c) => (c.unlockAfter ?? 0) > 0 && c.unlockAfter === profile.solvedCases.length)}
          onClose={() => dispatch({ type: 'DISMISS_PROMOTION' })}
        />
      )}
    </div>
  );
}
