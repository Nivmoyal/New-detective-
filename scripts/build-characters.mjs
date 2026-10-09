// Builds the optimized character GLBs in public/models/characters from the
// Quaternius CC0 packs (Universal Base Characters, Modular Character Outfits,
// Universal Animation Library 1 + 2).
//
// Usage: node scripts/build-characters.mjs <path-to-quaternius-folder>
// The folder layout matches OpenAgentsInc/openagents assets/verse/characters/quaternius.

import { mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/build-characters.mjs <quaternius-folder>');
  process.exit(1);
}
const OUT = 'public/models/characters';
mkdirSync(OUT, { recursive: true });

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

/** Desaturate and brighten base colours so the game can tint them to any colour. */
async function makeTintable(doc, matcher) {
  for (const mat of doc.getRoot().listMaterials()) {
    if (!matcher.test(mat.getName())) continue;
    const tex = mat.getBaseColorTexture();
    if (!tex || tex.getExtras().tintable) continue;
    const img = tex.getImage();
    // Normalise to a bright mid-grey so the tint colour reads true in game.
    const grey = sharp(Buffer.from(img)).modulate({ saturation: 0 });
    const { channels } = await grey.clone().stats();
    const gain = Math.min(3.2, 205 / Math.max(1, channels[0].mean));
    const out = await grey.linear(gain, 0).png().toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType('image/png').setExtras({ tintable: true });
  }
}

/** Remove accessors referenced by nothing but the document root (left behind by dispose/transforms). */
function dropOrphans(doc) {
  for (const acc of doc.getRoot().listAccessors()) {
    if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
  }
}

function stripExtraMaps(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setNormalTexture(null);
    mat.setMetallicFactor(0);
  }
}

function dropMeshes(doc, names) {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh && names.some((n) => node.getName().includes(n) || mesh.getName().includes(n))) node.setMesh(null).setSkin(null);
  }
}

/**
 * Keep only the head and neck of the full base body: the outfit supplies everything below.
 * Thresholds are relative to the top of the head, in the source's metre units.
 */
function cutToHead(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!/Superhero/i.test(prim.getMaterial()?.getName() ?? '')) continue;
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      const top = pos.getMax([])[1];
      const neck = top - 0.43;
      const keep = (i) => {
        const [x, y] = pos.getElement(i, []);
        // head, plus a neck collar that tucks under the clothing
        return y >= neck && Math.abs(x) <= 0.13 && !(y < neck + 0.12 && Math.abs(x) > 0.085);
      };
      const kept = [];
      for (let t = 0; t < idx.getCount(); t += 3) {
        const a = idx.getScalar(t);
        const b = idx.getScalar(t + 1);
        const c = idx.getScalar(t + 2);
        if (keep(a) && keep(b) && keep(c)) kept.push(a, b, c);
      }
      idx.setArray(new Uint32Array(kept));
    }
  }
}

/**
 * Region codes for the full base body (T-pose, metres), written as the custom vertex attribute _REGION.
 * The game builds fitted clothing layers from these regions. Thresholds are fractions of height and arm span.
 */
export const REGION = { head: 0, torso: 1, upperArm: 2, foreArm: 3, hand: 4, hips: 5, thigh: 6, shin: 7, foot: 8 };

function labelRegions(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!/Superhero/i.test(prim.getMaterial()?.getName() ?? '')) continue;
      const pos = prim.getAttribute('POSITION');
      const H = pos.getMax([])[1];
      const A = pos.getMax([])[0];
      const out = new Float32Array(pos.getCount());
      const v = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const [x, y] = v;
        const ax = Math.abs(x);
        let r;
        if (ax >= 0.775 * A) r = REGION.hand;
        else if (ax >= 0.54 * A) r = REGION.foreArm;
        else if (ax >= 0.23 * A && y > 0.68 * H) r = REGION.upperArm;
        else if (y >= H - 0.285) r = REGION.head;
        else if (y >= 0.565 * H) r = REGION.torso;
        else if (y >= 0.5 * H) r = REGION.hips;
        else if (y >= 0.28 * H) r = REGION.thigh;
        else if (y >= 0.062 * H) r = REGION.shin;
        else r = REGION.foot;
        out[i] = r;
      }
      prim.setAttribute('_REGION', doc.createAccessor().setType('SCALAR').setArray(out).setBuffer(pos.getBuffer()));
      // Engine-specific mask channels and extra UV sets are not used by the game.
      for (const sem of prim.listSemantics()) if (/^(COLOR_\d|TEXCOORD_[1-9])$/.test(sem)) prim.setAttribute(sem, null);
    }
  }
}

async function build(src, out, { tint, drop = [], size = 512, head = false, regions = false } = {}) {
  const doc = await io.read(join(SRC, src));
  if (drop.length) dropMeshes(doc, drop);
  if (head) cutToHead(doc);
  if (regions) labelRegions(doc);
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  stripExtraMaps(doc);
  if (tint) await makeTintable(doc, tint);
  await doc.transform(
    weld(),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  dropOrphans(doc);
  const file = join(OUT, out);
  await io.write(file, doc);
  console.log(`${out.padEnd(26)} ${(statSync(file).size / 1024).toFixed(0)} KB`);
}

async function buildAnimations(src, out, keep) {
  const doc = await io.read(join(SRC, src));
  for (const a of doc.getRoot().listAnimations()) {
    if (keep.includes(a.getName())) continue;
    // Animation.dispose() leaves its samplers (and their keyframe data) alive.
    a.listSamplers().forEach((smp) => smp.dispose());
    a.listChannels().forEach((ch) => ch.dispose());
    a.dispose();
  }
  for (const node of doc.getRoot().listNodes()) node.setMesh(null).setSkin(null);
  for (const m of doc.getRoot().listMaterials()) m.dispose();
  for (const t of doc.getRoot().listTextures()) t.dispose();
  // Bone scale never changes and only the hips/root translate; the rest is dead weight.
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const path = ch.getTargetPath();
      const bone = ch.getTargetNode()?.getName() ?? '';
      if (path === 'scale' || (path === 'translation' && bone !== 'root' && bone !== 'pelvis')) {
        const sampler = ch.getSampler();
        ch.dispose();
        sampler?.dispose();
      }
    }
  }
  await doc.transform(resample({ tolerance: 1e-4 }));
  await doc.transform(prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  dropOrphans(doc);
  const file = join(OUT, out);
  await io.write(file, doc);
  const names = doc.getRoot().listAnimations().map((a) => a.getName());
  console.log(`${out.padEnd(26)} ${(statSync(file).size / 1024).toFixed(0)} KB  [${names.join(', ')}]`);
}

const HAIR = /Hair|Eyebrow/i;
const CLOTH = /Peasant|Ranger/i;

// Full realistic bodies; the game dresses them in fitted clothing generated from the labelled regions.
await build('base/Superhero_Male_FullBody.gltf', 'body_male.glb', { size: 1024, regions: true });
await build('base/Superhero_Female_FullBody.gltf', 'body_female.glb', { size: 1024, regions: true });

// Hair
for (const [src, out] of [
  ['hair/Hair_SimpleParted.gltf', 'hair_parted.glb'],
  ['hair/Hair_Buzzed.gltf', 'hair_buzzed.glb'],
  ['hair/Hair_BuzzedFemale.gltf', 'hair_buzzed_female.glb'],
  ['hair/Hair_Long.gltf', 'hair_long.glb'],
  ['hair/Hair_Buns.gltf', 'hair_buns.glb'],
  ['hair/Hair_Beard.gltf', 'hair_beard.glb'],
  ['hair/Eyebrows_Regular.gltf', 'eyebrows_male.glb'],
  ['hair/Eyebrows_Female.gltf', 'eyebrows_female.glb'],
]) {
  await build(src, out, { tint: HAIR, size: 256 });
}

// Animations (same 65-joint skeleton)
await buildAnimations('gaits.glb', 'anims_base.glb', [
  'Idle_Loop',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Idle_Talking_Loop',
  'Sitting_Idle_Loop',
  'Sitting_Talking_Loop',
]);
await buildAnimations('animations.glb', 'anims_extra.glb', ['Idle_FoldArms_Loop', 'Idle_No_Loop', 'Yes', 'Idle_TalkingPhone_Loop']);

for (const f of ['base-license.txt', 'animations-license.txt']) copyFileSync(join(SRC, f), join(OUT, f));
writeFileSync(
  join(OUT, 'CREDITS.txt'),
  `3D characters, outfits, hair and animations by Quaternius (https://quaternius.com), CC0 1.0.
Packs: Universal Base Characters (Standard),
Universal Animation Library (Standard), Universal Animation Library 2 (Standard).
Source copy: https://github.com/OpenAgentsInc/openagents/tree/main/assets/verse/characters/quaternius
Optimized for this game by scripts/build-characters.mjs (textures resized to WebP, unused maps removed,
hair converted to tintable greyscale, body regions labelled for the game's generated clothing).
`,
);
