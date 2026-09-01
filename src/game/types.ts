import type { PlantId, ZombieId } from "./config";

export type Scene =
  | "title"
  | "nights"
  | "how"
  | "play"
  | "pause"
  | "win"
  | "lose"
  | "result";

export interface Zombie {
  id: number;
  type: ZombieId;
  lane: number;
  pos: number;
  hp: number;
  maxHp: number;
  eating: number | null;
  slow: number;
  flash: number;
  bob: number;
  alive: boolean;
}

export interface Plant {
  id: number;
  type: PlantId;
  lane: number;
  col: number;
  hp: number;
  maxHp: number;
  cd: number;
  flash: number;
  bob: number;
  alive: boolean;
}

export interface Shot {
  id: number;
  lane: number;
  pos: number;
  dmg: number;
  slow: number;
  kind: "pea-shot" | "ice-shot";
  alive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  alive: boolean;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  alive: boolean;
}

export interface HudSnap {
  scene: Scene;
  night: number;
  nightName: string;
  moonlight: number;
  brains: number;
  brainsNeeded: number;
  dawn: number;
  dawnMax: number;
  selected: ZombieId;
  cooldowns: Record<ZombieId, number>;
  unlocked: number;
  message: string;
  score: number;
  bestEndless: number;
  sfx: boolean;
  music: boolean;
  shakeOn: boolean;
  endless: boolean;
  hoverLane: number;
}

export interface SaveData {
  version: number;
  unlocked: number;
  bestEndless: number;
  sfx: boolean;
  music: boolean;
  shakeOn: boolean;
}
