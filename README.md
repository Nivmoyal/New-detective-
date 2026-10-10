# תיק פתוח

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
npm run test:sim       # headless playthrough of 25 cases (story + generated) through the real reducer
```

## Freedom of play

- Nothing is assigned and nothing points the way: no markers, beacons, guide lines or objective lists.
- Three cases are open from the first day, and two more arrive as you close cases (a phone scam targeting
  the elderly, and an arson tied to a protection racket in the market).
- The game doesn't end after the story cases. From the third solved case on, new files keep landing on the
  desk: generated cases (burglary, street robbery, assault, car theft, theft by an employee, rental scam).
  Each one spreads over about twelve places in four or five neighbourhoods: the scene, the victim, two
  witnesses and a neighbour, a camera, a visit to every suspect's home, the people who confirm alibis and the
  archive at the station. Three or four suspects, all new people. Scenes alternate between ten hand-placed
  sites and any open place in the city, found automatically from the map geometry (`src/data/citySpots.ts`),
  which also puts extra residents on the streets. Every case is deterministic (case N is always the same) and is
  checked by the validator and the simulation like the hand-written ones.
- Street situations happen around the district - a stolen wallet, a lost child, a parking-chair war, a
  printer that ate a court filing. Someone calls out; you decide whether and how to step in, and the choice
  has consequences for your reliability.
- All open cases run at once. Every witness, scene and camera of every case is in the world from the
  start; evidence you find is filed automatically under its own case, whichever case you are focused on.
- Every person can be talked to (staff, witnesses, vendors, passers-by) and every object can be examined.
  Conversations move on only when you press the button. Nobody repeats anyone else: every passer-by and
  resident is a persona of their own (`src/pixel/world/personas.ts`) with their own role, three lines in
  order and their own last word, and the validator fails if two people share a line.
- Some leads stay closed until you have a reason to follow them (a storage unit needs a search warrant, the
  intelligence desk needs a name to run) - the person tells you so in their own words.
- Choices have a price. A locked lead can be opened with an early warrant from the commander (reliability -10,
  and she only signs above 40%); a witness can be pressed for a quick answer (reliability -6). Reliability
  matters: suspects cooperate more with a detective whose reputation is good.
- Generated cases don't all run the same way: some have no camera (a card receipt from a shop in another
  neighbourhood instead), some have an eyewitness who names the wrong person out of an old grudge, and in some
  the culprit has an alibi that collapses when the friend is asked properly. Every kind of suspect has their own
  lines in the interrogation room.
- The case file keeps a notebook of the places you know about, by neighbourhood - places you visited, the scene
  area, the suspects, and anyone whose name came up. No arrows: a place enters the notebook when someone
  mentions it.
- רס״ל דנה עזרא joins about six patrols in ten, walks a step behind and comments - never where to go.
- The phone (header) gets messages from the lab, the commander, the desk sergeant, witnesses who remembered
  something, and the station's group chat.
- You can ask the commander for a warrant at any time. Without three validated links on the board she refuses,
  and your reliability drops.

## Gameplay loop

1. **Arrival.** Type your name and design your detective in the pixel character creator (body, skin tone,
   hairstyle, hair colour, outfit, colours, glasses, beard).
2. **The streets.** Six large maps: the station, שוק לוינסקי, נווה שאנן, התחנה המרכזית הישנה, פלורנטין
   and שכונת שפירא. Buildings open up when you walk in. Move with the on-screen joystick (bottom left; a light push walks slowly), WASD/arrow keys, or tap to walk; tap a person or object to walk over and interact. Travel with the patrol car.
3. **Forensic lab.** Physical items stay "ממתין למז״פ" until analyzed and can't be pinned before that.
4. **Evidence board.** Tap a suspect, then evidence (or the reverse). Red string = implicates, blue = an alibi
   that clears. Wrong links cost reliability.
5. **Interrogation.** Tension and cooperation gauges; tactics are psychological pressure, presenting evidence,
   building trust and confrontation. Push too hard and a lawyer is requested; mistakes lead to silence.
   The suspect never says the same sentence twice: answers depend on their mood (calm, nervous, cracking),
   the kind of evidence (camera, lab, testimony, document), whether it points at them, clears them, or points
   at another suspect (they jump on it, or get rattled when someone else is cleared), and on repetition -
   the same tactic over and over stops working.
6. **Promotion.** מפקח משנה, מפקח, פקד and רפ״ד over the first cases, then סנ״צ (6 solved), נצ״מ (10) and
   תנ״צ (15).

## Project layout

```
src/
  App.tsx                         root: views, modals, game wiring
  types/investigation.ts          domain types
  data/cases/cases.json           the five story cases (Hebrew); hotspots sit on named map anchors
  data/maps.ts                    the six maps
  data/characters.ts              station staff and creator palettes
  data/incidents.ts               street situations with choices and consequences
  services/caseEngine.ts          case loading, evidence, link validation, deduction
  services/caseGenerator.ts       endless generated cases from crime templates, places and people
  data/citySpots.ts               open standing places found from map geometry; extra street residents
  services/interrogationEngine.ts interrogation tactics and outcome rules
  services/interrogationLines.ts  mood- and evidence-aware line pools for suspects and the detective
  state/gameReducer.ts            game state, actions, localStorage persistence
  pixel/
    color.ts                      colour helpers and a tiny pixel buffer
    person.ts                     smooth characters: 4 directions, fluid walk cycle, outfits, hair, glasses,
                                  expressions; the same drawing frames the conversation close-ups
    upscale.ts                    EPX / Scale2x edge smoothing for the remaining pixel-art details
    audio.ts                      procedural ambience (street, rain, station, club) with Web Audio
    world/types.ts                tiles, props, buildings, lights
    world/smooth.ts               the city painted with vector shapes and gradients: roads, curbs, sidewalks,
                                  floors, facades, roofs, cars, trees, lamps and street furniture
    world/tiles.ts                tile lookup and wall colours
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
