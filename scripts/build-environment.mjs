// Builds the environment assets from Quaternius' Downtown City MegaKit (Standard, CC0):
//   public/models/city/city_kit.glb  - selected facade modules and street props in one file (shared textures)
//   public/textures/*.webp           - tiling PBR surfaces for floors and walls
//
// Usage: node scripts/build-environment.mjs "<megakit>/Exports/glTF (Godot)"

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/build-environment.mjs <megakit glTF folder>');
  process.exit(1);
}
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const MODULES = [
  'Trim_Window',
  'Trim_FirstFloor_Window_001',
  'Trim_FirstFloor_Wall',
  'Trim_Plain_3',
  'Cornice_Trim_Center',
  'Brick_Window_Square_Single',
  'Brick_Plain_3',
  'Metal_FirstFloor_Window',
  'DoorFrame_Trim',
  'Door_1',
  'Door_2',
  'Prop_ACUnit',
  'Prop_Bollard',
  'Prop_Planter_Single',
  'Prop_ManholeCover',
  'Prop_Drain',
];

// One document with every module as a named top-level node; textures are shared after dedup.
const kit = await io.read(join(SRC, `${MODULES[0]}.gltf`));
for (const name of MODULES.slice(1)) mergeDocuments(kit, await io.read(join(SRC, `${name}.gltf`)));
const scene = kit.getRoot().listScenes()[0];
for (const extra of kit.getRoot().listScenes().slice(1)) {
  for (const node of extra.listChildren()) scene.addChild(node);
  extra.dispose();
}
for (const node of scene.listChildren()) {
  const match = MODULES.find((m) => node.getName().replace('.', '_').startsWith(m.replace(/_00\d$/, '')));
  if (match) node.setName(match);
}
for (const mat of kit.getRoot().listMaterials()) mat.setOcclusionTexture(null);
mkdirSync('public/models/city', { recursive: true });
await kit.transform(
  unpartition(),
  weld(),
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write('public/models/city/city_kit.glb', kit);
console.log('city_kit.glb', (statSync('public/models/city/city_kit.glb').size / 1024).toFixed(0), 'KB', scene.listChildren().map((n) => n.getName()).join(', '));

// Tiling surfaces
mkdirSync('public/textures', { recursive: true });
const SURFACES = {
  concrete: 'T_Concrete',
  marble: 'T_MarbleFloor',
  plaster: 'T_Trim',
  metal_concrete: 'T_MetalConcrete',
  brick: 'T_RedBrick',
};
for (const [out, src] of Object.entries(SURFACES)) {
  await sharp(join(SRC, `${src}_BaseColor.png`)).resize(1024, 1024).webp({ quality: 80 }).toFile(`public/textures/${out}_color.webp`);
  await sharp(join(SRC, `${src}_Normal.png`)).resize(512, 512).webp({ quality: 85 }).toFile(`public/textures/${out}_normal.webp`);
  await sharp(join(SRC, `${src}_ORM.png`)).resize(512, 512).webp({ quality: 85 }).toFile(`public/textures/${out}_orm.webp`);
}
await sharp(join(SRC, 'T_Concrete_Asphalt_BaseColor.png')).resize(1024, 1024).webp({ quality: 80 }).toFile('public/textures/asphalt_color.webp');
await sharp(join(SRC, 'T_Street_Decals.png')).resize(1024, 1024).webp({ quality: 85 }).toFile('public/textures/street_decals.webp');
writeFileSync(
  'public/textures/CREDITS.txt',
  'Surface textures and city models from Downtown City MegaKit (Standard) by Quaternius, CC0 1.0. https://quaternius.com\n',
);
console.log('textures written');
