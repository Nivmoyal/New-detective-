import { createRoot } from 'react-dom/client';
import '../index.css';
import PixelWorld from '../components/PixelWorld';
import { MAPS } from '../data/maps';
import { defaultPlayerLook } from '../data/characters';
import { loadCases } from '../services/caseEngine';

const params = new URLSearchParams(location.search);
const map = MAPS[params.get('map') ?? 'station'];
const x = Number(params.get('x') ?? map.spawn.x);
const y = Number(params.get('y') ?? map.spawn.y);
const hotspots = loadCases().flatMap((c) => c.hotspots.filter((h) => h.mapId === map.id).map((h) => ({ hotspot: h, caseId: c.id, available: !h.requires, visited: false })));
createRoot(document.getElementById('root')!).render(
  <div style={{ height: '100vh' }}>
    <PixelWorld
      map={map}
      playerLook={defaultPlayerLook('male')}
      hotspots={hotspots}
      startPosition={{ x, y }}
      paused={false}
      onFacility={(f) => console.log('facility', f.id)}
      onHotspot={(h) => console.log('hotspot', h.hotspot.id)}
      onChat={(n) => console.log('chat', n.character.name)}
      onExamine={(a, b) => console.log('examine', a, b)}
      onPositionChange={() => {}}
    />
  </div>,
);
