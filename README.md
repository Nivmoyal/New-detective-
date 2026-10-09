# התחנה - מרחב יפתח

A mobile-first, Hebrew/RTL detective game set in the South Tel Aviv police district (תחנת שרפשטיין).
You play a rookie detective on their first day: report to the station commander, take your first case file
off your desk, explore crime scenes top-down, send evidence to the forensic lab, pin it on the corkboard,
and break the suspect in a cautioned interrogation.

Built with React 18, Vite, TypeScript, Tailwind CSS and a real-time 3D engine (Three.js through React Three Fiber).
Icons are `lucide-react` SVGs only; there are no emoji anywhere.

## Playing

A playable build is published at https://claude.ai/artifact/VY8XK9i6MHoyF8VaYWeTL8 (private until shared).
That host enforces a strict Content-Security-Policy (no WebAssembly, no `data:` fetches) and serves only common
file types, so its build uses "web-safe" models: plain glTF JSON, `.webp` textures and the binary buffer as base64
text, reassembled in the browser by `src/components/three/webGltfLoader.ts`:

```bash
VITE_MODEL_EXT=.json npx vite build --base ./
for d in characters city; do
  node scripts/make-web-models.mjs dist/models/$d dist/models/web_$d
  rm dist/models/$d/*.glb && mv dist/models/web_$d/* dist/models/$d/ && rmdir dist/models/web_$d
done
```

## Running

```bash
npm install
npm run dev          # local dev server
npm run build        # typecheck + production build
npm run validate:data  # map geometry and case-file integrity checks
npm run test:sim       # headless playthrough of all three cases through the real reducer
```

## Gameplay loop

1. **Arrival (onboarding).** Type your name and design your detective in a live 3D character creator (body,
   skin tone, hairstyle, hair colour, outfit, colours, glasses, beard), pick a specialization, walk into the
   station, get briefed by סנ״צ אורנה ברק, then take the first case from your desk in משרד החוקרים.
2. **3D exploration.** A lit 3D world with a following camera, a walking animated detective, and walls that cut away
   when they block the view. Move with the on-screen joystick, WASD/arrow keys, or tap-to-move. Walk up to people and
   talk to them: the station commander, the forensic lab chief, the team lead, the evidence clerk, the desk sergeant,
   the patrol driver, and every witness in the case. Gold markers are case items, blue markers are station staff, and
   a blue light beacon marks the next sensible stop.
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
  data/characters.ts              station staff, chat characters, pedestrians, creator palettes
  state/gameReducer.ts            game state, actions, localStorage persistence
  components/
    RookieArrivalModal.tsx        character creation + first-day commander/desk dialogue
    World3D.tsx                   3D world: player controller, follow camera, characters, joystick
    three/RiggedCharacter.tsx     realistic rigged characters: outfit skeleton + head/hair/beard re-bound by bone name,
                                  per-character colours, animation retargeting and blending (idle, walk, jog, talk,
                                  sit, sit-talk, folded arms, head shake)
    three/Humanoid.tsx            lightweight procedural figure, shown while models stream in or if they fail
    three/MapScene.tsx            builds streets, offices, stalls, cars and lighting from the tile maps
    three/CharacterPortrait.tsx   live 3D portraits for conversations and the creator
    three/InterrogationScene.tsx  3D interrogation room; the suspect's body language follows the gauges
    CharacterBanner.tsx, ChatDialog.tsx  conversation UI
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

## 3D characters and credits

The people in the game are realistic rigged characters from **Quaternius**, all released under **CC0 1.0**
(public domain): Universal Base Characters, Modular Character Outfits - Fantasy, and Universal Animation
Library 1 and 2. All parts share one 65-joint humanoid skeleton, so heads, hairstyles, beards and clothing
combine freely and every character uses the same animation set. Licenses and credits ship in
`public/models/characters/`.

The optimized files in `public/models/characters/` (about 2.2 MB in total) are generated by
`npm run build:characters -- <path-to-quaternius-folder>` from the source copy at
https://github.com/OpenAgentsInc/openagents/tree/main/assets/verse/characters/quaternius. The script cuts
the base body down to head and neck, removes fantasy accessories (hoods, pauldrons, bracers), converts
clothing and hair to tintable greyscale, resizes textures to WebP, drops unused maps, strips redundant
animation tracks, and applies meshopt compression.

## Clothing and environment

People wear fitted modern clothing generated at load time from the realistic base body
(`src/components/three/clothing.ts`): the build labels body regions, and each garment is a smoothed,
offset shell of those regions on the same skeleton, so clothes fit, animate and never show holes.

Streets, sidewalks, floors, walls, facades and street props use Quaternius' **Downtown City MegaKit**
(Standard, CC0): `npm run build:environment -- "<megakit>/Exports/glTF (Godot)"` writes
`public/models/city/city_kit.glb` and the PBR textures in `public/textures/`.
`lookbook.html` (dev server only) shows the outfits side by side for inspection.
