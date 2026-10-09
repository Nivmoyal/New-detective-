import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/*
  Loads the "web-safe" models written by scripts/make-web-models.mjs: glTF JSON whose binary buffer
  is stored as base64 text. The buffer is decoded here and the model is reassembled as an in-memory
  GLB, so loading needs no WebAssembly and no data: URLs (both are blocked by strict page policies).
  Textures stay external .webp files resolved next to the JSON.
*/

function packGlb(json: unknown, bin: Uint8Array): ArrayBuffer {
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20);
    padded.set(jsonBytes);
    jsonBytes = padded;
  }
  const binPad = (4 - (bin.length % 4)) % 4;
  const binLen = bin.length + binPad;
  const total = 12 + 8 + jsonBytes.length + (bin.length ? 8 + binLen : 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  bytes.set(jsonBytes, 20);
  if (bin.length) {
    const at = 20 + jsonBytes.length;
    view.setUint32(at, binLen, true);
    view.setUint32(at + 4, 0x004e4942, true); // 'BIN\0'
    bytes.set(bin, at + 8);
  }
  return out;
}

export class WebGLTFLoader extends GLTFLoader {
  load(url: string, onLoad: (gltf: GLTF) => void, _onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) {
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const json = await res.json();
      let bin = new Uint8Array(0);
      const buffer = json.buffers?.[0];
      if (buffer?.uri) {
        const text = await (await fetch(base + buffer.uri)).text();
        const raw = atob(text.trim());
        bin = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
        delete buffer.uri;
      }
      this.parse(packGlb(json, bin), base, onLoad, onError);
    })().catch((e) => onError?.(e));
  }
}
