# התחנה - מרחב יפתח

A mobile-first, Hebrew/RTL detective game set in the South Tel Aviv police district (תחנת שרפשטיין).
You play a rookie detective on their first day: report to the station commander, take your first case file
off your desk, explore crime scenes top-down, send evidence to the forensic lab, pin it on the corkboard,
and break the suspect in a cautioned interrogation.

Built with React 18, Vite, TypeScript and Tailwind CSS. Icons are `lucide-react` SVGs only; there are no emoji anywhere.

## Running

```bash
npm install
npm run dev          # local dev server
npm run build        # typecheck + production build
npm run validate:data  # map geometry and case-file integrity checks
npm run test:sim       # headless playthrough of all three cases through the real reducer
```

## Gameplay loop

1. **Arrival (onboarding).** Create a detective (name, form of address, specialization), walk into the station,
   get briefed by סנ״צ אורנה ברק, then take the first case from your desk in משרד החוקרים.
2. **Top-down exploration.** Canvas map with D-pad, WASD/arrow keys, or tap-to-move. Gold markers are case hotspots
   (evidence collection, witnesses, security cameras); blue markers are station facilities. A dashed blue line
   points to the next sensible stop on the station map.
3. **Forensic lab.** Physical items stay "ממתין למז״פ" until analyzed and can't be pinned before that.
4. **Evidence board.** Tap a suspect, then evidence (or the reverse). The deduction engine checks every link:
   red string = implicates, blue = an alibi that clears. Wrong links cost reliability. Three validated red links to
   one suspect unlock the arrest warrant.
5. **Interrogation.** Tension and cooperation gauges; tactics are psychological pressure, presenting evidence,
   building trust and confrontation. Tension at 100 means a lawyer is requested. Three mistakes, zero cooperation
   or running out of turns means the suspect invokes the right to remain silent.
6. **Promotion.** Each solved case promotes you: מפקח משנה, then מפקח, then פקד, then רפ״ד.

Specializations change the numbers: criminal investigations (better interrogation start), intelligence
(double intel from witnesses/CCTV, cheaper commander hints), forensics (stronger lab rewards).

## Project layout

```
src/
  App.tsx                         root: views, modals, game wiring
  types/investigation.ts          domain types
  data/cases/cases.json           the three case files (Hebrew)
  data/maps.ts                    tile maps: station + five South TLV locations
  services/caseEngine.ts          case loading, evidence, link validation, deduction, objectives
  services/interrogationEngine.ts interrogation tactics and outcome rules
  state/gameReducer.ts            game state, actions, localStorage persistence
  components/
    RookieArrivalModal.tsx        character creation + first-day commander/desk dialogue
    TopDownCanvasMap.tsx          canvas renderer, movement, lighting, hotspots
    EvidenceBoard.tsx             corkboard with string links and the warrant panel
    InterrogationRoom.tsx         gauges, transcript, tactics
    PoliceHeader.tsx              rank, solved cases, reliability, intel points
    StationHub.tsx                case file, objectives, suspects, archive
    HotspotDialog.tsx             witness/evidence/CCTV dialogue
    StationModals.tsx             lab, evidence room, patrol car travel, commander, case closed
```

## Adding a case

Append an entry to `src/data/cases/cases.json`. Hotspots reference a `mapId` from `src/data/maps.ts` and tile
coordinates, and can be gated with `requires` (evidence ids). Each clue lists the suspects it `implicates` or
`clears`. Run `npm run validate:data`: it checks that every hotspot is reachable, every clue is obtainable, the
culprit can reach the warrant threshold, and no innocent suspect can.
