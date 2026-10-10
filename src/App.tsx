import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Compass, Crosshair, Folder, Lock, ShieldAlert } from 'lucide-react';
import type { View } from './types/investigation';
import { MAPS, STATION_MAP_ID } from './data/maps';
import type { PlacedFacility } from './pixel/world/types';
import { emptyProgress, getCase, isHotspotAvailable, loadCases, validateLink } from './services/caseEngine';
import {
  WARRANT_DENIAL_PENALTY,
  activeProgress,
  allCasesSolved,
  gameReducer,
  knownCaseIds,
  loadState,
  saveState,
  warrantJustified,
} from './state/gameReducer';
import PoliceHeader from './components/PoliceHeader';
import RookieArrivalModal from './components/RookieArrivalModal';
import PixelWorld, { type WorldHotspot } from './components/PixelWorld';
import ChatDialog from './components/ChatDialog';
import { COMMANDER, INTERROGATION_OFFICER, type ChatNpc } from './data/characters';
import { chatAnnoyed } from './pixel/world/humor';
import type { CharacterRef } from './types/investigation';
import EvidenceBoard from './components/EvidenceBoard';
import InterrogationRoom from './components/InterrogationRoom';
import StationHub from './components/StationHub';
import HotspotDialog from './components/HotspotDialog';
import { CaseClosedModal, CommanderModal, EvidenceRoomModal, LabModal, NoticeModal, TravelModal } from './components/StationModals';

// How many times each background character has been talked to this session.
const chatVisits = new Map<string, number>();

type ModalState =
  | { type: 'arrivalCommander' }
  | { type: 'arrivalDesk' }
  | { type: 'commander' }
  | { type: 'lab' }
  | { type: 'evidenceRoom' }
  | { type: 'travel' }
  | { type: 'hotspot'; spot: WorldHotspot }
  | { type: 'chat'; npc: ChatNpc; opener?: string }
  | { type: 'notice'; title: string; text: string; character?: CharacterRef; tone?: 'red' | 'gold' | 'police' }
  | null;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadState);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => saveState(state), [state]);

  const { profile, arrivalStep } = state;
  const caseFile = state.activeCaseId ? getCase(state.activeCaseId) : null;
  const progress = activeProgress(state);
  const map = MAPS[state.currentMapId] ?? MAPS[STATION_MAP_ID];
  const g = (m: string, f: string) => (profile?.addressForm === 'female' ? f : m);

  // Every lead of every case lives in the world from the start.
  const worldHotspots = useMemo<WorldHotspot[]>(() => {
    const out: WorldHotspot[] = [];
    for (const c of loadCases()) {
      const p = state.progress[c.id] ?? emptyProgress();
      for (const h of c.hotspots) {
        if (h.mapId !== map.id) continue;
        out.push({ hotspot: h, caseId: c.id, available: isHotspotAvailable(h, p), visited: p.visitedHotspots.includes(h.id) });
      }
    }
    return out;
  }, [state.progress, map.id]);

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
      });
      return;
    }
    setModal({ type: 'hotspot', spot });
  }, []);
  const handleChat = useCallback(
    (npc: ChatNpc) => {
      const visits = (chatVisits.get(npc.id) ?? 0) + 1;
      chatVisits.set(npc.id, visits);
      const annoyed = chatAnnoyed((m, f) => (profile?.addressForm === 'female' ? f : m));
      setModal({ type: 'chat', npc, opener: visits >= 3 ? annoyed[(visits - 3) % annoyed.length] : undefined });
    },
    [profile?.addressForm],
  );
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
    <div dir="rtl" className="flex h-full flex-col overflow-hidden bg-noir-bg font-sans text-slate-100">
      {state.view !== 'interrogation' && (
        <PoliceHeader profile={profile} activeCaseTitle={caseFile?.shortTitle ?? null} onReset={() => dispatch({ type: 'RESET' })} />
      )}

      <main className="relative min-h-0 flex-1">
        {state.view === 'map' && (
          <PixelWorld
            key={map.id}
            map={map}
            playerLook={profile.look}
            addressForm={profile.addressForm}
            hotspots={worldHotspots}
            startPosition={state.positions[map.id]}
            paused={modal !== null}
            onFacility={handleFacility}
            onHotspot={handleHotspot}
            onChat={handleChat}
            onExamine={handleExamine}
            onPositionChange={savePosition}
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
          cases={loadCases()}
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
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'notice' && (
        <NoticeModal title={modal.title} text={modal.text} character={modal.character} tone={modal.tone} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'chat' && <ChatDialog npc={modal.npc} opener={modal.opener} addressForm={profile.addressForm} onClose={() => setModal(null)} />}

      {promotionCase && state.progress[promotionCase.id] && (
        <CaseClosedModal
          profile={profile}
          caseFile={promotionCase}
          progress={state.progress[promotionCase.id]}
          allSolved={allCasesSolved(state)}
          onClose={() => dispatch({ type: 'DISMISS_PROMOTION' })}
        />
      )}
    </div>
  );
}
