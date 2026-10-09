import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterLook, HairStyle, Outfit } from '../../types/investigation';
import Humanoid, { type MotionState, type Mood, type Pose } from './Humanoid';

/*
  Realistic rigged characters built from the Quaternius CC0 packs (see public/models/characters/CREDITS.txt).
  Every part shares one 65-joint skeleton: the outfit supplies the body skeleton, and the head, hair,
  eyebrows and beard are re-bound to it by bone name. Animations come from the Universal Animation Library.
*/

const BASE = `${import.meta.env.BASE_URL}models/characters/`;
// Hosts that cannot serve .glb get the same models as embedded glTF JSON (see scripts/glb-to-json.py).
const MODEL_EXT = (import.meta.env.VITE_MODEL_EXT as string | undefined) ?? '.glb';
const url = (f: string) => `${BASE}${f.replace(/\.glb$/, MODEL_EXT)}`;

const ANIMS_BASE = url('anims_base.glb');
const ANIMS_EXTRA = url('anims_extra.glb');

function hairFile(style: HairStyle, female: boolean): string | null {
  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
      return female ? 'hair_buzzed_female.glb' : 'hair_buzzed.glb';
    case 'long':
    case 'ponytail':
      return 'hair_long.glb';
    case 'bun':
      return 'hair_buns.glb';
    case 'curly':
    case 'short':
    default:
      return female ? 'hair_buns.glb' : 'hair_parted.glb';
  }
}

function outfitKind(outfit: Outfit): 'jacket' | 'shirt' {
  return outfit === 'blazer' || outfit === 'suit' || outfit === 'leather' || outfit === 'hoodie' || outfit === 'vest' ? 'jacket' : 'shirt';
}

export function characterFiles(look: CharacterLook): string[] {
  const female = look.body === 'female';
  const g = female ? 'female' : 'male';
  const files = [`head_${g}.glb`, `outfit_${g}_${outfitKind(look.outfit)}.glb`, `eyebrows_${g}.glb`];
  const hair = hairFile(look.hairStyle, female);
  if (hair) files.push(hair);
  if (look.beard && !female) files.push('hair_beard.glb');
  return files.map(url);
}

/* ------------------------------------------------------------------ */
/* Tinting                                                             */
/* ------------------------------------------------------------------ */

// Approximate skin colour baked into the source textures (sRGB). Skin tone = target / reference.
const SKIN_REFERENCE = new THREE.Color('#d9a988');
const SHOE = '#24201d';
const BELT = '#2b2119';

function skinTint(hex: string) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1.7, c.r / SKIN_REFERENCE.r);
  c.g = Math.min(1.7, c.g / SKIN_REFERENCE.g);
  c.b = Math.min(1.7, c.b / SKIN_REFERENCE.b);
  return c;
}

function outfitColors(look: CharacterLook) {
  const top = look.outfit === 'labcoat' ? '#eef1f4' : look.topColor;
  return { top, pants: look.pantsColor };
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

interface RestPose {
  q: THREE.Quaternion;
  p: THREE.Vector3;
}

interface Built {
  root: THREE.Object3D;
  head: THREE.Bone | null;
  rest: Map<string, RestPose>;
  key: string;
}

function restPose(root: THREE.Object3D): Map<string, RestPose> {
  const rest = new Map<string, RestPose>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.name === 'root') rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() });
  });
  return rest;
}

function assemble(look: CharacterLook, scenes: THREE.Object3D[]): Built {
  const [headScene, outfitScene, ...extras] = scenes;
  const root = cloneSkinned(outfitScene);
  root.updateMatrixWorld(true);
  const rest = restPose(root);

  let master: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!master && (o as THREE.SkinnedMesh).isSkinnedMesh) master = o as THREE.SkinnedMesh;
  });
  if (!master) throw new Error('outfit without skinned mesh');
  const masterMesh: THREE.SkinnedMesh = master;
  const bones = new Map(masterMesh.skeleton.bones.map((b) => [b.name, b]));
  const meshParent = masterMesh.parent ?? root;

  const colors = outfitColors(look);
  const skin = skinTint(look.skin);
  const hair = new THREE.Color(look.hairColor);

  const tint = (mesh: THREE.Mesh) => {
    const src = mesh.material as THREE.MeshStandardMaterial;
    const m = src.clone();
    const name = src.name;
    const meshName = mesh.name;
    if (/Hair/i.test(name)) m.color.copy(hair);
    else if (/Eyes/i.test(name)) {
      // leave eyes untouched
    } else if (/Regular|Superhero/i.test(name)) {
      m.color.copy(skin);
    } else if (/Peasant|Ranger/i.test(name)) {
      if (/Feet|Boots/i.test(meshName)) m.color.set(SHOE);
      else if (/Belt/i.test(meshName)) m.color.set(BELT);
      else if (/Legs/i.test(meshName)) m.color.set(colors.pants);
      else m.color.set(colors.top);
    }
    // COLOR_0 holds masks for the original engine shaders; multiplying by it darkens everything.
    m.vertexColors = false;
    m.roughness = Math.max(m.roughness, /Hair/i.test(name) ? 0.6 : 0.7);
    mesh.material = m;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  };

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) tint(o as THREE.Mesh);
  });

  const attach = (scene: THREE.Object3D) => {
    const part = cloneSkinned(scene);
    const meshes: THREE.SkinnedMesh[] = [];
    part.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
    });
    for (const mesh of meshes) {
      const remapped = mesh.skeleton.bones.map((b) => bones.get(b.name) ?? b);
      const skeleton = new THREE.Skeleton(remapped, mesh.skeleton.boneInverses);
      meshParent.add(mesh);
      mesh.bind(skeleton, mesh.bindMatrix);
      tint(mesh);
    }
  };

  attach(headScene);
  extras.forEach((s) => attach(s));

  // Accessories in model space, parented to the head bone so they follow it.
  const head = bones.get('Head') ?? null;
  if (head && (look.glasses || look.cap)) {
    root.updateMatrixWorld(true);
    const headWorld = head.matrixWorld.clone();
    const inv = headWorld.clone().invert();
    const headPos = new THREE.Vector3().setFromMatrixPosition(headWorld);
    const place = (obj: THREE.Object3D, offset: THREE.Vector3) => {
      const world = new THREE.Matrix4().makeTranslation(headPos.x + offset.x, headPos.y + offset.y, headPos.z + offset.z);
      const local = inv.clone().multiply(world);
      local.decompose(obj.position, obj.quaternion, obj.scale);
      head.add(obj);
    };
    if (look.glasses) {
      const frame = new THREE.MeshStandardMaterial({ color: '#0e0f12', roughness: 0.25, metalness: 0.6 });
      const g = new THREE.Group();
      const ring = new THREE.TorusGeometry(0.022, 0.0035, 6, 18);
      const l = new THREE.Mesh(ring, frame);
      l.position.x = 0.032;
      const r = new THREE.Mesh(ring, frame);
      r.position.x = -0.032;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.004), frame);
      g.add(l, r, bridge);
      place(g, new THREE.Vector3(0, 0.072, 0.098));
    }
    if (look.cap) {
      const capMat = new THREE.MeshStandardMaterial({ color: look.outfit === 'uniform' ? '#1b2433' : '#2b2b2e', roughness: 0.7 });
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.105, 0.07, 20), capMat);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.08), capMat);
      visor.position.set(0, -0.025, 0.1);
      visor.rotation.x = 0.15;
      g.add(top, visor);
      place(g, new THREE.Vector3(0, 0.155, 0.005));
    }
  }

  return { root, head, rest, key: `${look.body}-${outfitKind(look.outfit)}` };
}

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */

const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;

const retargetCache = new Map<string, THREE.AnimationClip>();

/**
 * Re-express a clip authored on the animation mannequin for a skeleton whose bones have different
 * rest orientations: target = anim * inverse(sourceRest) * targetRest (positions use rest deltas).
 */
function retarget(clip: THREE.AnimationClip, source: Map<string, RestPose>, target: Map<string, RestPose>, key: string) {
  const id = `${clip.uuid}|${key}`;
  const hit = retargetCache.get(id);
  if (hit) return hit;
  const qa = new THREE.Quaternion();
  const tmp = new THREE.Quaternion();
  const tracks = clip.tracks.map((track) => {
    const [bone, prop] = track.name.split('.');
    const s = source.get(bone);
    const t = target.get(bone);
    if (!s || !t) return track;
    const values = Float32Array.from(track.values);
    if (prop === 'quaternion') {
      const invSource = s.q.clone().invert();
      for (let i = 0; i < values.length; i += 4) {
        qa.fromArray(values, i);
        tmp.copy(qa).multiply(invSource).multiply(t.q).toArray(values, i);
      }
    } else if (prop === 'position') {
      for (let i = 0; i < values.length; i += 3) {
        values[i] = t.p.x + (values[i] - s.p.x);
        values[i + 1] = t.p.y + (values[i + 1] - s.p.y);
        values[i + 2] = t.p.z + (values[i + 2] - s.p.z);
      }
    }
    const Ctor = track.constructor as new (n: string, t: ArrayLike<number>, v: ArrayLike<number>) => THREE.KeyframeTrack;
    return new Ctor(track.name, track.times, values);
  });
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  retargetCache.set(id, out);
  return out;
}

function subClip(clip: THREE.AnimationClip, name: string, lower: boolean) {
  const tracks = clip.tracks.filter((t) => LOWER.test(t.name.split('.')[0]) === lower);
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

interface Props {
  look: CharacterLook;
  motion?: MutableRefObject<MotionState>;
  talking?: boolean;
  pose?: Pose;
  mood?: Mood;
  fidget?: number;
  seed?: number;
}

function Rigged({ look, motion, talking = false, pose = 'stand', mood = 'neutral', fidget = 0, seed = 0 }: Props) {
  const files = useMemo(() => characterFiles(look), [look]);
  const parts = useGLTF(files, false, true) as unknown as { scene: THREE.Object3D }[];
  const animsBase = useGLTF(ANIMS_BASE, false, true);
  const animsExtra = useGLTF(ANIMS_EXTRA, false, true);

  const built = useMemo(() => assemble(look, parts.map((p) => p.scene)), [look, parts]);
  const mixer = useMemo(() => new THREE.AnimationMixer(built.root), [built]);

  const actions = useMemo(() => {
    const baseRest = restPose(animsBase.scene);
    const extraRest = restPose(animsExtra.scene);
    const byName = new Map<string, THREE.AnimationClip>();
    animsBase.animations.forEach((c) => byName.set(c.name, retarget(c, baseRest, built.rest, built.key)));
    animsExtra.animations.forEach((c) => byName.set(c.name, retarget(c, extraRest, built.rest, built.key)));
    const get = (n: string) => byName.get(n)!;
    const make = (clip: THREE.AnimationClip) => mixer.clipAction(clip);
    return {
      idle: make(get('Idle_Loop')),
      talk: make(get('Idle_Talking_Loop')),
      walk: make(get('Walk_Loop')),
      jog: make(get('Jog_Fwd_Loop')),
      sit: make(get('Sitting_Idle_Loop')),
      sitTalk: make(get('Sitting_Talking_Loop')),
      sitLower: make(subClip(get('Sitting_Idle_Loop'), 'sit_lower', true)),
      foldUpper: make(subClip(get('Idle_FoldArms_Loop'), 'fold_upper', false)),
      no: make(subClip(get('Idle_No_Loop'), 'no_upper', false)),
    };
  }, [mixer, animsBase, animsExtra, built]);

  const current = useRef<THREE.AnimationAction[]>([]);
  const key = useRef('');

  useEffect(() => {
    // A new look builds a new rig and mixer: forget what was playing on the previous one.
    key.current = '';
    current.current = [];
    // desynchronise crowds
    mixer.setTime((seed * 0.731) % 3);
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(built.root);
    };
  }, [mixer, built, seed]);

  const play = (next: THREE.AnimationAction[], id: string, fade = 0.3) => {
    if (key.current === id) return;
    key.current = id;
    // The very first clip starts at full weight: fading in from zero would flash the T-pose.
    if (current.current.length === 0) fade = 0;
    for (const a of current.current) if (!next.includes(a)) a.fadeOut(fade);
    for (const a of next) if (!current.current.includes(a)) (fade > 0 ? a.reset().setEffectiveWeight(1).fadeIn(fade) : a.reset().setEffectiveWeight(1)).play();
    current.current = next;
  };

  useFrame((_, dt) => {
    const speed = motion ? motion.current.speed : 0;
    if (pose === 'sit') {
      if (mood === 'defiant') play([actions.sitLower, actions.foldUpper], 'sit-defiant');
      else if (mood === 'tense' && !talking) play([actions.sitLower, actions.no], 'sit-tense');
      else if (talking) play([actions.sitTalk], 'sit-talk');
      else play([actions.sit], 'sit');
      const rate = 1 + fidget * 0.6;
      current.current.forEach((a) => (a.timeScale = rate));
    } else if (speed > 0.6) {
      play([actions.jog], 'jog', 0.2);
      actions.jog.timeScale = 0.75 + speed * 0.35;
    } else if (speed > 0.06) {
      play([actions.walk], 'walk', 0.2);
      actions.walk.timeScale = 0.7 + speed * 0.8;
    } else {
      play([talking ? actions.talk : actions.idle], talking ? 'talk' : 'idle', 0.35);
    }
    mixer.update(Math.min(dt, 0.05));
    if (pose === 'sit' && mood === 'broken' && built.head) {
      // head hangs after the confession
      built.head.rotateX(0.5);
    }
  });

  const scale = look.height ?? 1;
  return <primitive object={built.root} scale={scale} />;
}

/* ------------------------------------------------------------------ */
/* Public component with graceful fallback                             */
/* ------------------------------------------------------------------ */

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * A realistic rigged character. While the models stream in (or if they fail to load),
 * the lightweight procedural figure stands in so the scene is never empty.
 */
export default function Character(props: Props & { castShadow?: boolean }) {
  const fallback = <Humanoid {...props} />;
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>
        <Rigged {...props} />
      </Suspense>
    </Fallback>
  );
}

// Warm the cache with the shared files.
useGLTF.preload(ANIMS_BASE, false, true);
useGLTF.preload(ANIMS_EXTRA, false, true);
for (const f of ['head_male.glb', 'head_female.glb', 'outfit_male_jacket.glb', 'outfit_male_shirt.glb', 'outfit_female_shirt.glb', 'eyebrows_male.glb', 'eyebrows_female.glb']) {
  useGLTF.preload(url(f), false, true);
}
