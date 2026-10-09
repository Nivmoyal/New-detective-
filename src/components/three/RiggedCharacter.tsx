import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterLook, HairStyle } from '../../types/investigation';
import Humanoid, { type MotionState, type Mood, type Pose } from './Humanoid';
import { dress, wardrobe } from './clothing';
import { assetUrl, preloadModels, useModels } from './loaders';

/*
  Realistic rigged characters built from the Quaternius CC0 packs (see public/models/characters/CREDITS.txt).
  Every part shares one 65-joint skeleton: the outfit supplies the body skeleton, and the head, hair,
  eyebrows and beard are re-bound to it by bone name. Animations come from the Universal Animation Library.
*/

const url = (f: string) => assetUrl(`models/characters/${f}`);

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

export function characterFiles(look: CharacterLook): string[] {
  const female = look.body === 'female';
  const g = female ? 'female' : 'male';
  const files = [`body_${g}.glb`, `eyebrows_${g}.glb`];
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

function skinTint(hex: string) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1.7, c.r / SKIN_REFERENCE.r);
  c.g = Math.min(1.7, c.g / SKIN_REFERENCE.g);
  c.b = Math.min(1.7, c.b / SKIN_REFERENCE.b);
  return c;
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
  const [bodyScene, ...extras] = scenes;
  const root = cloneSkinned(bodyScene);
  root.updateMatrixWorld(true);
  const rest = restPose(root);

  let master: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && /Superhero/i.test((m.material as THREE.Material).name)) master = m;
  });
  if (!master) throw new Error('body without skinned mesh');
  const masterMesh: THREE.SkinnedMesh = master;
  const bones = new Map(masterMesh.skeleton.bones.map((b) => [b.name, b]));
  const meshParent = masterMesh.parent ?? root;

  const skin = skinTint(look.skin);
  const hair = new THREE.Color(look.hairColor);

  const tint = (mesh: THREE.Mesh) => {
    if (/^garment_/.test(mesh.name)) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const m = src.clone();
    const name = src.name;
    if (/Hair/i.test(name)) m.color.copy(hair);
    else if (/Superhero|Regular/i.test(name)) m.color.copy(skin);
    // COLOR_0 holds masks for the original engine shaders; multiplying by it darkens everything.
    m.vertexColors = false;
    m.roughness = Math.max(m.roughness, /Hair/i.test(name) ? 0.6 : 0.62);
    mesh.material = m;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  };

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) tint(o as THREE.Mesh);
  });

  // Modern fitted clothing generated from the body itself.
  dress(masterMesh, wardrobe(look));

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

  return { root, head, rest, key: look.body };
}

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */

const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;

// Ground speed (m/s) of the animation clips at playback rate 1, measured from foot travel.
const WALK_MPS = 1.0;
const JOG_MPS = 2.5;

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
  const [animsBase, animsExtra, ...parts] = useModels([ANIMS_BASE, ANIMS_EXTRA, ...files]);

  // `parts` is a fresh array each render; key the rig on the loaded scenes themselves.
  const partsKey = parts.map((p) => p.scene.uuid).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => assemble(look, parts.map((p) => p.scene)), [look, partsKey]);
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

  const scale = look.height ?? 1;

  useFrame((_, dt) => {
    const mps = motion ? motion.current.mps ?? motion.current.speed * 2.9 : 0;
    if (pose === 'sit') {
      if (mood === 'defiant') play([actions.sitLower, actions.foldUpper], 'sit-defiant');
      else if (mood === 'tense' && !talking) play([actions.sitLower, actions.no], 'sit-tense');
      else if (talking) play([actions.sitTalk], 'sit-talk');
      else play([actions.sit], 'sit');
      const rate = 1 + fidget * 0.6;
      current.current.forEach((a) => (a.timeScale = rate));
    } else if (mps > 1.9) {
      // Playback rate follows the real ground speed so the feet plant instead of sliding.
      play([actions.jog], 'jog', 0.25);
      actions.jog.timeScale = THREE.MathUtils.clamp(mps / (JOG_MPS * scale), 0.75, 1.35);
    } else if (mps > 0.12) {
      play([actions.walk], 'walk', 0.25);
      actions.walk.timeScale = THREE.MathUtils.clamp(mps / (WALK_MPS * scale), 0.6, 1.5);
    } else {
      play([talking ? actions.talk : actions.idle], talking ? 'talk' : 'idle', 0.35);
    }
    mixer.update(Math.min(dt, 0.05));
    if (pose === 'sit' && mood === 'broken' && built.head) {
      // head hangs after the confession
      built.head.rotateX(0.5);
    }
  });

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
preloadModels([
  ANIMS_BASE,
  ANIMS_EXTRA,
  ...['body_male.glb', 'body_female.glb', 'eyebrows_male.glb', 'eyebrows_female.glb'].map(url),
]);
