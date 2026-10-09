import { useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';
import { WebGLTFLoader } from './webGltfLoader';

/*
  One place that decides how 3D files load. Normal hosting uses meshopt-compressed GLB. Hosts with a
  strict Content-Security-Policy get "web-safe" glTF JSON from scripts/make-web-models.mjs, decoded
  without WebAssembly by WebGLTFLoader.
*/

export const MODEL_EXT = (import.meta.env.VITE_MODEL_EXT as string | undefined) ?? '.glb';
export const WEB_SAFE = MODEL_EXT !== '.glb';

/** Public asset URL; `.glb` paths are mapped to the build's model format. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/\.glb$/, MODEL_EXT)}`;
}

export type Model = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };

/** Loads 3D files (suspends). WEB_SAFE is fixed per build, so hook order never changes. */
export function useModels(urls: string[]): Model[] {
  if (WEB_SAFE) return useLoader(WebGLTFLoader, urls) as unknown as Model[];
  return useGLTF(urls, false, true) as unknown as Model[];
}

export function preloadModels(urls: string[]) {
  if (WEB_SAFE) urls.forEach((u) => useLoader.preload(WebGLTFLoader, u));
  else urls.forEach((u) => useGLTF.preload(u, false, true));
}
