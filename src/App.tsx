import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Compass, Crosshair, Folder, Lock, ShieldAlert } from 'lucide-react';
import type { FacilityHotspot, MapHotspot, View } from './types/investigation';
import { MAPS, STATION_MAP_ID } from './data/maps';
import {
  getCase,
  getVisibleHotspots,
  nextCaseId,
  pendingLabClues,
  validateLink,
} from './services/caseEngine';
import { activeProgress, allCasesSolved, gameReducer, loadState, saveState } from './state/gameReducer';
import PoliceHeader from './components/PoliceHeader';
import RookieArrivalModal from './components/RookieArrivalModal';
import TopDownCanvasMap from './components/TopDownCanvasMap';
import EvidenceBoard from './components/EvidenceBoard';
import InterrogationRoom from './components/InterrogationRoom';
import StationHub from './components/StationHub';
import HotspotDialog from './components/HotspotDialog';
import {
  CaseClosedModal,
  CommanderModal,
  EvidenceRoomModal,
  LabModal,
  Modal,
  NoticeModal,
  TravelModal,
} from './components/StationModals';

type ModalState =
  | { type: 'arrivalCommander' }
  | { type: 'arrivalDesk' }
  | { type: 'newCase' }
  | { type: 'commander' }
  | { type: 'lab' }
  | { type: 'evidenceRoom' }
  | { type: 'travel' }
  | { type: 'hotspot'; hotspot: MapHotspot }
  | { type: 'notice'; title: string; text: string }
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

  const hotspots = useMemo(
    () => (caseFile && progress ? getVisibleHotspots(caseFile, map.id, progress) : []),
    [caseFile, progress, map.id],
  );

  // Blue guide line on the station map pointing at the next sensible stop.
  const guideFacilityId = useMemo(() => {
    if (map.id !== STATION_MAP_ID) return null;
    if (arrivalStep === 'toCommander') return 'f-commander';
    if (arrivalStep === 'toDesk') return 'f-desk';
    if (!caseFile && profile && nextCaseId(profile.solvedCases)) return 'f-desk';
    if (caseFile && progress && pendingLabClues(caseFile, progress).length > 0) return 'f-lab';
    if (progress?.warrantSuspectId && !progress.solved) return 'f-interrogation';
    return null;
  }, [map.id, arrivalStep, caseFile, progress, profile]);

  const savePosition = useCallback(
    (mapId: string, x: number, y: number) => dispatch({ type: 'SAVE_POSITION', mapId, x, y }),
    [],
  );

  const setView = (view: View) => dispatch({ type: 'SET_VIEW', view });

  const openInterrogation = () => {
    if (state.interrogation) return setView('interrogation');
    if (progress?.warrantSuspectId) dispatch({ type: 'START_INTERROGATION' });
    else
      setModal({
        type: 'notice',
        title: 'חדר החקירות נעול',
        text: `אין צו מעצר בתוקף. ${g('חבר', 'חברי')} שלוש ראיות מאומתות לחשוד אחד בלוח הראיות כדי שהמפקדת תחתום על צו.`,
      });
  };

  const handleFacility = useCallback(
    (f: FacilityHotspot) => {
      if (arrivalStep === 'toCommander' && f.action !== 'commander') {
        setModal({
          type: 'notice',
          title: 'רגע, עוד לא התייצבת',
          text: 'היום הראשון מתחיל במשרד המפקדת. עקבו אחרי הקו הכחול אל משרד המפקד.',
        });
        return;
      }
      switch (f.action) {
        case 'commander':
          setModal(arrivalStep === 'toCommander' ? { type: 'arrivalCommander' } : { type: 'commander' });
          return;
        case 'desk':
          if (arrivalStep === 'toDesk') setModal({ type: 'arrivalDesk' });
          else if (!state.activeCaseId && profile && nextCaseId(profile.solvedCases)) setModal({ type: 'newCase' });
          else if (state.activeCaseId) setView('board');
          else setModal({ type: 'notice', title: 'השולחן ריק', text: 'אין תיקים פתוחים. כל התיקים במרחב נסגרו.' });
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
          if (arrivalStep !== 'done') {
            setModal({ type: 'notice', title: 'עוד לא', text: 'קודם לוקחים תיק מהשולחן במשרד החוקרים. השטח יחכה.' });
            return;
          }
          setModal({ type: 'travel' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arrivalStep, state.activeCaseId, profile, progress, state.interrogation],
  );

  const handleHotspot = useCallback((h: MapHotspot) => setModal({ type: 'hotspot', hotspot: h }), []);

  /* ---------------- Onboarding: character creation ---------------- */
  if (!profile) {
    return (
      <div dir="rtl" className="min-h-[100dvh] bg-noir-bg font-sans text-slate-100">
        <RookieArrivalModal
          mode="profile"
          profile={null}
          onCreateProfile={(name, specialization, addressForm) =>
            dispatch({ type: 'CREATE_PROFILE', name, specialization, addressForm })
          }
        />
      </div>
    );
  }

  const nextCase = nextCaseId(profile.solvedCases);
  const promotionCase = state.promotionCaseId ? getCase(state.promotionCaseId) : null;
  const navItems: { view: View; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { view: 'map', label: 'מפה', icon: <Compass className="h-5 w-5" /> },
    { view: 'hub', label: 'תיק', icon: <Folder className="h-5 w-5" /> },
    { view: 'board', label: 'לוח ראיות', icon: <Crosshair className="h-5 w-5" />, disabled: !caseFile },
    {
      view: 'interrogation',
      label: 'חקירה',
      icon: progress?.warrantSuspectId ? <ShieldAlert className="h-5 w-5" /> : <Lock className="h-5 w-5" />,
      disabled: !progress?.warrantSuspectId,
    },
  ];

  return (
    <div dir="rtl" className="flex h-[100dvh] flex-col overflow-hidden bg-noir-bg font-sans text-slate-100">
      <PoliceHeader profile={profile} activeCaseTitle={caseFile?.shortTitle ?? null} onReset={() => dispatch({ type: 'RESET' })} />

      <main className="relative min-h-0 flex-1">
        {state.view === 'map' && (
          <TopDownCanvasMap
            key={map.id}
            map={map}
            hotspots={hotspots}
            visitedHotspotIds={progress?.visitedHotspots ?? []}
            startPosition={state.positions[map.id]}
            guideFacilityId={guideFacilityId}
            paused={modal !== null}
            onFacility={handleFacility}
            onHotspot={handleHotspot}
            onPositionChange={savePosition}
          />
        )}

        {state.view === 'hub' && (
          <StationHub
            profile={profile}
            arrivalStep={arrivalStep}
            caseFile={caseFile}
            progress={progress}
            allProgress={state.progress}
            onOpenMap={() => (map.id === STATION_MAP_ID ? setView('map') : dispatch({ type: 'TRAVEL', mapId: STATION_MAP_ID }))}
            onOpenTravel={() => setModal({ type: 'travel' })}
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
            onIssueWarrant={(suspectId) => dispatch({ type: 'ISSUE_WARRANT', suspectId })}
            onStartInterrogation={openInterrogation}
          />
        )}

        {state.view === 'interrogation' &&
          (state.interrogation && caseFile && progress ? (
            <InterrogationRoom
              caseFile={caseFile}
              progress={progress}
              session={state.interrogation}
              onTactic={(tactic, evidenceId) => dispatch({ type: 'INTERROGATION_ACTION', tactic, evidenceId })}
              onEnd={() => dispatch({ type: 'END_INTERROGATION' })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <ShieldAlert className="h-10 w-10 text-alert" />
              <div className="font-display text-lg font-bold">חדר חקירות באזהרה</div>
              <p className="max-w-sm text-sm text-steel">
                {progress?.warrantSuspectId
                  ? 'החשוד ממתין בחדר. החקירה תתועד במצלמה ובהקלטה.'
                  : 'אין עצור לחקירה. נדרש צו מעצר מהמפקדת.'}
              </p>
              {progress?.warrantSuspectId && (
                <button className="btn-primary" onClick={() => dispatch({ type: 'START_INTERROGATION' })}>
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
          caseFile={nextCase ? getCase(nextCase) : null}
          onComplete={() => {
            dispatch({ type: 'TAKE_CASE' });
            setModal(null);
            setView('hub');
          }}
        />
      )}
      {modal?.type === 'newCase' && nextCase && (
        <Modal title="תיק חדש על השולחן" subtitle={getCase(nextCase).crimeType} icon={<Folder className="h-5 w-5" />} tone="gold" onClose={() => setModal(null)}>
          <div className="rounded-lg border border-evidence/50 bg-cork/60 p-3">
            <div className="font-display text-base font-bold">{getCase(nextCase).title}</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{getCase(nextCase).summary}</p>
          </div>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
            {getCase(nextCase).briefing.map((b, i) => (
              <p key={i}>
                <span className="font-bold text-sky-300">{i === 0 ? 'סנ״צ ברק: ' : ''}</span>
                {b}
              </p>
            ))}
          </div>
          <button
            className="btn-gold mt-4 w-full"
            onClick={() => {
              dispatch({ type: 'TAKE_CASE' });
              setModal(null);
              setView('hub');
            }}
          >
            <Folder className="h-4 w-4" />
            פתיחת התיק
          </button>
        </Modal>
      )}
      {modal?.type === 'commander' && (
        <CommanderModal
          profile={profile}
          caseFile={caseFile}
          progress={progress}
          onHint={() => dispatch({ type: 'USE_HINT' })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'lab' && (
        <LabModal caseFile={caseFile} progress={progress} onAnalyze={() => dispatch({ type: 'ANALYZE_LAB' })} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'evidenceRoom' && <EvidenceRoomModal caseFile={caseFile} progress={progress} onClose={() => setModal(null)} />}
      {modal?.type === 'travel' && (
        <TravelModal
          currentMapId={map.id}
          caseFile={caseFile}
          onTravel={(mapId) => {
            dispatch({ type: 'TRAVEL', mapId });
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'hotspot' && caseFile && progress && (
        <HotspotDialog
          hotspot={modal.hotspot}
          caseFile={caseFile}
          progress={progress}
          onCollect={() => dispatch({ type: 'VISIT_HOTSPOT', hotspotId: modal.hotspot.id })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'notice' && <NoticeModal title={modal.title} text={modal.text} onClose={() => setModal(null)} />}

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
