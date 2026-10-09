import * as THREE from 'three';
import type { CharacterLook } from '../../types/investigation';

/*
  Fitted clothing generated from the realistic base body.

  The build labels every body vertex with a region (_REGION, see scripts/build-characters.mjs). A garment
  is a copy of the body triangles in some regions, pushed out along the normals by a thickness and skinned
  to the same skeleton, so it fits and animates perfectly and can never have holes. The body triangles
  hidden under clothing are removed so skin never pokes through.
*/

export const R = { head: 0, torso: 1, upperArm: 2, foreArm: 3, hand: 4, hips: 5, thigh: 6, shin: 7, foot: 8 } as const;

type Fabric = 'cotton' | 'denim' | 'leather' | 'wool' | 'rubber' | 'canvas';

export interface Garment {
  regions: number[];
  /** Thickness in metres pushed out along the surface normal. */
  offset: number;
  color: string;
  fabric: Fabric;
  /** Extra thickness per region, for looser trousers or a coat skirt. */
  loose?: Partial<Record<number, number>>;
  /** Keep only the front (z > 0) of the regions: aprons. */
  frontOnly?: boolean;
}

/* ---------------------------- fabric textures --------------------------- */

const fabricCache = new Map<Fabric, THREE.CanvasTexture>();

function fabricTexture(kind: Fabric): THREE.CanvasTexture {
  const hit = fabricCache.get(kind);
  if (hit) return hit;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, size, size);
  let seed = kind.length * 977;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  if (kind === 'denim') {
    // diagonal twill
    for (let i = -size; i < size; i += 3) {
      g.strokeStyle = `rgba(0,0,0,${0.08 + rnd() * 0.08})`;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + size, size);
      g.stroke();
    }
  } else if (kind === 'wool' || kind === 'cotton' || kind === 'canvas') {
    // fine weave
    const step = kind === 'canvas' ? 3 : 2;
    for (let y = 0; y < size; y += step) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`;
      g.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += step) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`;
      g.fillRect(x, 0, 1, size);
    }
  } else if (kind === 'leather') {
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
      g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},0.025)`;
    g.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'denim' ? 6 : 8, kind === 'denim' ? 6 : 8);
  fabricCache.set(kind, tex);
  return tex;
}

function fabricMaterial(g: Garment): THREE.MeshStandardMaterial {
  const roughness = { cotton: 0.9, denim: 0.85, leather: 0.42, wool: 0.95, rubber: 0.55, canvas: 0.88 }[g.fabric];
  return new THREE.MeshStandardMaterial({
    color: g.color,
    map: fabricTexture(g.fabric),
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

/* ------------------------------ wardrobe -------------------------------- */

const SHOES = '#1c1a19';
const UPPER = [R.torso, R.upperArm, R.hips];
const LONG_UPPER = [R.torso, R.upperArm, R.foreArm, R.hips];
/** Jackets end at the waist, over the shirt and trousers. */
const JACKET = [R.torso, R.upperArm, R.foreArm];
const LEGS = [R.hips, R.thigh, R.shin];

/** What a character wears, from its look. Layers are listed inner to outer. */
export function wardrobe(look: CharacterLook): Garment[] {
  const pants: Garment = { regions: LEGS, offset: 0.014, color: look.pantsColor, fabric: 'denim', loose: { [R.thigh]: 0.008, [R.shin]: 0.016 } };
  const shoes: Garment = { regions: [R.foot], offset: 0.014, color: SHOES, fabric: 'rubber' };
  // Tops reach over the waistband (hips get extra room) so there is never a gap above the trousers.
  const tee = (color: string): Garment => ({ regions: UPPER, offset: 0.008, color, fabric: 'cotton', loose: { [R.hips]: 0.012 } });
  switch (look.outfit) {
    case 'uniform':
      return [{ regions: UPPER, offset: 0.009, color: look.topColor, fabric: 'canvas', loose: { [R.hips]: 0.012 } }, { ...pants, fabric: 'canvas' }, shoes];
    case 'labcoat':
      return [
        tee('#c9d3de'),
        { ...pants, fabric: 'canvas' },
        shoes,
        { regions: [R.torso, R.upperArm, R.foreArm, R.hips, R.thigh], offset: 0.03, color: '#eef1f4', fabric: 'canvas', loose: { [R.hips]: 0.018, [R.thigh]: 0.028 } },
      ];
    case 'apron':
      return [tee('#9aa3ad'), pants, shoes, { regions: [R.torso, R.hips, R.thigh], offset: 0.022, color: look.topColor, fabric: 'canvas', frontOnly: true }];
    case 'vest':
      return [tee('#2d3440'), pants, shoes, { regions: [R.torso], offset: 0.026, color: look.topColor, fabric: 'canvas' }];
    case 'blazer':
    case 'suit':
      return [
        { regions: LONG_UPPER, offset: 0.008, color: '#e9ecef', fabric: 'cotton', loose: { [R.hips]: 0.012 } },
        { ...pants, color: look.outfit === 'suit' ? look.topColor : look.pantsColor, fabric: 'wool' },
        shoes,
        { regions: JACKET, offset: 0.026, color: look.topColor, fabric: 'wool' },
      ];
    case 'leather':
      return [tee('#2b2b2e'), pants, shoes, { regions: JACKET, offset: 0.026, color: look.topColor, fabric: 'leather' }];
    case 'hoodie':
      return [{ regions: LONG_UPPER, offset: 0.018, color: look.topColor, fabric: 'cotton', loose: { [R.hips]: 0.012 } }, pants, shoes];
    case 'tshirt':
    default:
      return [tee(look.topColor), pants, shoes];
  }
}

/* ------------------------------ geometry -------------------------------- */

function regionOf(attr: THREE.BufferAttribute, i: number): number {
  return Math.round(attr.getX(i));
}

/** Taubin smoothing of the vertices used by `tris` (open-edge vertices stay put), with smoothed normals. */
function smoothShell(pos: Float32Array, nrm: Float32Array, tris: number[], count: number) {
  const positions = pos.slice();
  const normals = nrm.slice();
  const neighbours = new Map<number, Set<number>>();
  const edgeUse = new Map<string, number>();
  const link = (a: number, b: number) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1);
  };
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    link(a, b);
    link(b, a);
    link(b, c);
    link(c, b);
    link(c, a);
    link(a, c);
  }
  // Edges used by one triangle (counted twice above) lie on the garment's hem.
  const pinned = new Set<number>();
  edgeUse.forEach((uses, k) => {
    if (uses <= 2) k.split('_').forEach((v) => pinned.add(Number(v)));
  });
  const verts = [...neighbours.keys()].filter((v) => !pinned.has(v));
  const tmp = new Float32Array(count * 3);
  const pass = (factor: number, src: Float32Array) => {
    tmp.set(src);
    for (const v of verts) {
      const ns = neighbours.get(v)!;
      let x = 0;
      let y = 0;
      let z = 0;
      ns.forEach((u) => {
        x += src[u * 3];
        y += src[u * 3 + 1];
        z += src[u * 3 + 2];
      });
      const k = 1 / ns.size;
      tmp[v * 3] = src[v * 3] + factor * (x * k - src[v * 3]);
      tmp[v * 3 + 1] = src[v * 3 + 1] + factor * (y * k - src[v * 3 + 1]);
      tmp[v * 3 + 2] = src[v * 3 + 2] + factor * (z * k - src[v * 3 + 2]);
    }
    src.set(tmp);
  };
  for (let i = 0; i < 10; i++) {
    pass(0.6, positions);
    pass(-0.62, positions);
  }
  for (let i = 0; i < 4; i++) pass(0.6, normals);
  for (const v of neighbours.keys()) {
    const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1;
    normals[v * 3] /= l;
    normals[v * 3 + 1] /= l;
    normals[v * 3 + 2] /= l;
  }
  return { positions, normals };
}

/**
 * Build the garment meshes for a skinned body and hide the covered body triangles.
 * Returns the new meshes, already bound to the body's skeleton.
 */
export function dress(body: THREE.SkinnedMesh, garments: Garment[]): THREE.SkinnedMesh[] {
  const geo = body.geometry;
  const regionAttr = geo.getAttribute('_region') as THREE.BufferAttribute | undefined;
  const index = geo.getIndex();
  if (!regionAttr || !index) return [];

  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const count = pos.count;
  const bind = body.bindMatrix;
  const bindInv = body.bindMatrixInverse;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(bind);
  const normalInv = new THREE.Matrix3().getNormalMatrix(bindInv);

  // Rest positions/normals in bind space (metres), independent of any quantization.
  const restPos = new Float32Array(count * 3);
  const restNrm = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(bind);
    n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
    v.toArray(restPos, i * 3);
    n.toArray(restNrm, i * 3);
  }

  const covered = new Set<number>();
  const out: THREE.SkinnedMesh[] = [];

  garments.forEach((g, layer) => {
    const regions = new Set(g.regions);
    g.regions.forEach((r) => covered.add(r));
    const tris: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      if (!regions.has(regionOf(regionAttr, a)) || !regions.has(regionOf(regionAttr, b)) || !regions.has(regionOf(regionAttr, c))) continue;
      if (g.frontOnly && (restPos[a * 3 + 2] < 0.02 || restPos[b * 3 + 2] < 0.02 || restPos[c * 3 + 2] < 0.02)) continue;
      tris.push(a, b, c);
    }
    if (!tris.length) return;

    // Fabric drapes over muscles: smooth the shell (Taubin, boundary pinned), then push it out.
    const smooth = smoothShell(restPos, restNrm, tris, count);
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      n.fromArray(smooth.normals, i * 3);
      const extra = g.loose?.[regionOf(regionAttr, i)] ?? 0;
      p.fromArray(smooth.positions, i * 3).addScaledVector(n, g.offset + extra + layer * 0.0015).applyMatrix4(bindInv);
      p.toArray(positions, i * 3);
      n.applyMatrix3(normalInv).normalize().toArray(normals, i * 3);
    }
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    shell.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    const uv = geo.getAttribute('uv');
    if (uv) shell.setAttribute('uv', uv);
    shell.setAttribute('skinIndex', geo.getAttribute('skinIndex'));
    shell.setAttribute('skinWeight', geo.getAttribute('skinWeight'));
    shell.setIndex(tris);
    shell.computeBoundingSphere();

    const mesh = new THREE.SkinnedMesh(shell, fabricMaterial(g));
    mesh.name = `garment_${layer}`;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    body.parent?.add(mesh);
    mesh.bind(body.skeleton, body.bindMatrix);
    out.push(mesh);
  });

  // Hide skin under the clothes (keep triangles that touch any uncovered vertex, so edges stay sealed).
  const keep: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const hidden = covered.has(regionOf(regionAttr, a)) && covered.has(regionOf(regionAttr, b)) && covered.has(regionOf(regionAttr, c));
    if (!hidden) keep.push(a, b, c);
  }
  const bodyGeo = geo.clone();
  bodyGeo.setIndex(keep);
  body.geometry = bodyGeo;
  return out;
}
