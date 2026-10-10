# התחנה - מרחב יפתח

A mobile-first, Hebrew/RTL detective game set in the South Tel Aviv police district (תחנת שרפשטיין),
drawn in retro noir pixel art from a top-down view. You play a rookie detective: report to the station
commander, open the district's case files, and work them however you want - walk the streets, talk to
anyone, examine anything, send evidence to the forensic lab, pin it on the corkboard, ask for a warrant,
and break the suspect in a cautioned interrogation.

Built with React 18, Vite, TypeScript and Tailwind CSS. All graphics are painted procedurally in code -
there are no image assets. The city (tiles, buildings, props) is pixel art smoothed with an edge-aware
upscaler; people are drawn with smooth canvas paths at full screen resolution, so the walking figures and
conversation close-ups stay crisp. Icons are `lucide-react` SVGs only; there are no emoji anywhere.

## Playing

A playable build is published at https://claude.ai/artifact/VY8XK9i6MHoyF8VaYWeTL8 (private until shared).
It is a plain static build (`npx vite build --base ./`), so it runs under strict Content-Security-Policy hosts.

## Running

```bash
npm install
npm run dev            # local dev server (world.html opens a single map: ?map=levinsky&x=20&y=20; person.html shows every character)
npm run build          # typecheck + production build
npm run validate:data  # every person, place and object reachable; case-file integrity
npm run test:sim       # headless playthrough of all three cases through the real reducer
```

## Freedom of play

- Nothing is assigned and nothing points the way: no markers, beacons, guide lines or objective lists.
- Three cases are open from the first day, and two more arrive as you close cases (a phone scam targeting
  the elderly, and an arson tied to a protection racket in the market).
- Street situations happen around the district - a stolen wallet, a lost child, a parking-chair war, a
  printer that ate a court filing. Someone calls out; you decide whether and how to step in, and the choice
  has consequences for your reliability.
- All open cases run at once. Every witness, scene and camera of every case is in the world from the
  start; evidence you find is filed automatically under its own case, whichever case you are focused on.
- Every person can be talked to (staff, witnesses, vendors, passers-by) and every object can be examined.
- Some leads stay closed until you have a reason to follow them (a storage unit needs a search warrant, the
  intelligence desk needs a name to run) - the person tells you so in their own words.
- You can ask the commander for a warrant at any time. Without three validated links on the board she refuses,
  and your reliability drops.

## Gameplay loop

1. **Arrival.** Type your name and design your detective in the pixel character creator (body, skin tone,
   hairstyle, hair colour, outfit, colours, glasses, beard) and pick a specialization.
2. **The streets.** Six large maps: the station, שוק לוינסקי, נווה שאנן, התחנה המרכזית הישנה, פלורנטין
   and שכונת שפירא. Buildings open up when you walk in. Move with WASD/arrow keys, drag anywhere as a
   joystick, or tap to walk; tap a person or object to walk over and interact. Travel with the patrol car.
3. **Forensic lab.** Physical items stay "ממתין למז״פ" until analyzed and can't be pinned before that.
4. **Evidence board.** Tap a suspect, then evidence (or the reverse). Red string = implicates, blue = an alibi
   that clears. Wrong links cost reliability.
5. **Interrogation.** Tension and cooperation gauges; tactics are psychological pressure, presenting evidence,
   building trust and confrontation. Push too hard and a lawyer is requested; mistakes lead to silence.
6. **Promotion.** Each solved case promotes you: מפקח משנה, then מפקח, then פקד, then רפ״ד.

## Project layout

```
src/
  App.tsx                         root: views, modals, game wiring
  types/investigation.ts          domain types
  data/cases/cases.json           the three case files (Hebrew); hotspots sit on named map anchors
  data/maps.ts                    the six maps
  data/characters.ts              station staff and creator palettes
  data/incidents.ts               street situations with choices and consequences
  services/caseEngine.ts          case loading, evidence, link validation, deduction
  services/interrogationEngine.ts interrogation tactics and outcome rules
  state/gameReducer.ts            game state, actions, localStorage persistence
  pixel/
    color.ts                      colour helpers and a tiny pixel buffer
    person.ts                     smooth characters: 4 directions, fluid walk cycle, outfits, hair, glasses,
                                  expressions; the same drawing frames the conversation close-ups
    upscale.ts                    EPX / Scale2x edge smoothing for the pixel-art city
    world/types.ts                tiles, props, buildings, lights
    world/tiles.ts                floors, roads, sidewalks, two-storey facades, walls
    world/props.ts                furniture, stalls, vehicles, street furniture, signs - each with examine text
    world/builder.ts              map-building DSL (buildings, roads, anchors, people)
    world/maps/*.ts               the six maps
    world/renderer.ts             ground cache, depth sorting, opening roofs, night lighting, rain
  components/
    PixelWorld.tsx                the playable world: movement, tap-to-walk, interactions, crisp Hebrew signs
    pixel/                        portrait, sprite preview and interrogation-room canvases
    RookieArrivalModal.tsx        character creator + first-day conversations
    EvidenceBoard.tsx             corkboard with string links and warrant requests
    InterrogationRoom.tsx         gauges, transcript, tactics
    StationHub.tsx                all case files, focus selector, suspects
    HotspotDialog.tsx, ChatDialog.tsx, StationModals.tsx, PoliceHeader.tsx
```

## Adding a case

Append an entry to `src/data/cases/cases.json`. Each hotspot names a `mapId` and an `anchor` defined in that
map's file (`b.anchor(...)`). A hotspot can be gated with `requires` (evidence ids) plus a `lockedText` the
person says until then. Each clue lists the suspects it `implicates` or `clears`. `npm run validate:data` checks
that every anchor exists and is reachable, every clue is obtainable, the culprit can reach the warrant
threshold, and no innocent suspect can.
