// Converts the meshopt-compressed character GLBs into "web-safe" glTF for hosts with a strict
// Content-Security-Policy: no WebAssembly decoder needed, no data: URIs, and only file types
// such hosts serve (.json for the glTF, .webp for textures, base64 .txt for the binary buffer,
// decoded in the browser by WebGLTFLoader in src/components/three/webGltfLoader.ts).
//
// Usage: node scripts/make-web-models.mjs <glb-dir> <out-dir>

import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts/make-web-models.mjs <glb-dir> <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

for (const file of readdirSync(src).filter((f) => f.endsWith('.glb'))) {
  const name = basename(file, '.glb');
  const doc = await io.read(join(src, file));
  // Decoded on read; drop the extension so the output is plain, uncompressed glTF.
  doc.getRoot().listExtensionsUsed().filter((e) => e instanceof EXTMeshoptCompression).forEach((e) => e.dispose());
  doc.getRoot().listBuffers().forEach((b, i) => b.setURI(`${name}${i ? `_${i}` : ''}.bin`));
  doc.getRoot().listTextures().forEach((t, i) => t.setURI(`${name}_${i}.webp`));
  const gltfPath = join(out, `${name}.gltf`);
  await io.write(gltfPath, doc);
  // Rename to served extensions and point the JSON at them.
  const json = JSON.parse(readFileSync(gltfPath, 'utf8'));
  if ((json.buffers ?? []).length > 1) throw new Error(`${name}: expected a single buffer`);
  for (const b of json.buffers ?? []) {
    const bin = readFileSync(join(out, b.uri));
    writeFileSync(join(out, `${name}.b64.txt`), bin.toString('base64'));
    unlinkSync(join(out, b.uri));
    b.uri = `${name}.b64.txt`;
  }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(json));
  renameSync(gltfPath, join(out, `${name}.gltf.bak`));
  console.log(`${name}.json`);
}
for (const f of readdirSync(out).filter((f) => f.endsWith('.gltf.bak'))) {
  // the .json copy replaces it
  renameSync(join(out, f), join(out, f.replace('.gltf.bak', '.unused')));
}
