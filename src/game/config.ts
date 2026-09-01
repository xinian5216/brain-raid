export const LANES = 5;
export const COLS = 8;
export const TICK = 1 / 60;
export const SAVE_KEY = "brain-raid-save-v1";
export const SAVE_VERSION = 1;

export type ZombieId = "walker" | "imp" | "cone" | "bucket" | "football";
export type PlantId = "pea" | "nut" | "ice" | "sun";

export interface ZombieDef {
  id: ZombieId;
  name: string;
  desc: string;
  cost: number;
  hp: number;
  speed: number;
  dmg: number;
  cooldown: number;
  sheet: string;
  unlockNight: number;
  scale: number;
}

export interface PlantDef {
  id: PlantId;
  name: string;
  hp: number;
  dmg: number;
  fire: number;
  slow: number;
  loot: number;
  sheet: string;
  projectile?: "pea-shot" | "ice-shot";
}

export interface NightDef {
  id: number;
  name: string;
  blurb: string;
  brains: number;
  dawn: number;
  startMoon: number;
  moonRegen: number;
  endless?: boolean;
  startPlants: { type: PlantId; lane: number; col: number }[];
  ai: {
    interval: number;
    types: PlantId[];
    maxPlants: number;
  };
}

export const ZOMBIES: Record<ZombieId, ZombieDef> = {
  walker: {
    id: "walker",
    name: "腐行者",
    desc: "廉价步兵",
    cost: 50,
    hp: 170,
    speed: 0.34,
    dmg: 18,
    cooldown: 0,
    sheet: "walker",
    unlockNight: 1,
    scale: 1,
  },
  imp: {
    id: "imp",
    name: "小鬼",
    desc: "又矮又快",
    cost: 50,
    hp: 72,
    speed: 0.78,
    dmg: 14,
    cooldown: 1.2,
    sheet: "imp",
    unlockNight: 1,
    scale: 0.72,
  },
  cone: {
    id: "cone",
    name: "锥帽",
    desc: "路障硬壳",
    cost: 75,
    hp: 360,
    speed: 0.32,
    dmg: 18,
    cooldown: 2.2,
    sheet: "cone",
    unlockNight: 2,
    scale: 1.05,
  },
  bucket: {
    id: "bucket",
    name: "铁桶",
    desc: "铁皮坦克",
    cost: 125,
    hp: 680,
    speed: 0.26,
    dmg: 20,
    cooldown: 3.6,
    sheet: "bucket",
    unlockNight: 3,
    scale: 1.08,
  },
  football: {
    id: "football",
    name: "冲锋尸",
    desc: "高速重甲",
    cost: 175,
    hp: 540,
    speed: 0.6,
    dmg: 28,
    cooldown: 5.5,
    sheet: "football",
    unlockNight: 4,
    scale: 1.12,
  },
};

export const ZOMBIE_ORDER: ZombieId[] = ["walker", "imp", "cone", "bucket", "football"];

export const PLANTS: Record<PlantId, PlantDef> = {
  pea: {
    id: "pea",
    name: "豆炮",
    hp: 95,
    dmg: 20,
    fire: 1.42,
    slow: 0,
    loot: 16,
    sheet: "pea",
    projectile: "pea-shot",
  },
  ice: {
    id: "ice",
    name: "霜叶",
    hp: 90,
    dmg: 15,
    fire: 1.5,
    slow: 2.4,
    loot: 18,
    sheet: "ice",
    projectile: "ice-shot",
  },
  nut: {
    id: "nut",
    name: "坚盾",
    hp: 460,
    dmg: 0,
    fire: 0,
    slow: 0,
    loot: 22,
    sheet: "nut",
  },
  sun: {
    id: "sun",
    name: "日轮",
    hp: 68,
    dmg: 0,
    fire: 0,
    slow: 0,
    loot: 55,
    sheet: "sun",
  },
};

export const NIGHTS: NightDef[] = [
  {
    id: 1,
    name: "初夜",
    blurb: "豆炮还没睡醒。从空行道冲进去。",
    brains: 2,
    dawn: 95,
    startMoon: 150,
    moonRegen: 8,
    startPlants: [
      { type: "sun", lane: 1, col: 0 },
      { type: "pea", lane: 0, col: 3 },
      { type: "pea", lane: 2, col: 2 },
      { type: "pea", lane: 4, col: 3 },
    ],
    ai: { interval: 14, types: ["pea", "sun"], maxPlants: 7 },
  },
  {
    id: 2,
    name: "路障夜",
    blurb: "坚盾挡在路中间。上锥帽。",
    brains: 3,
    dawn: 105,
    startMoon: 145,
    moonRegen: 7.5,
    startPlants: [
      { type: "sun", lane: 0, col: 0 },
      { type: "sun", lane: 3, col: 0 },
      { type: "pea", lane: 1, col: 2 },
      { type: "pea", lane: 2, col: 3 },
      { type: "pea", lane: 4, col: 2 },
      { type: "nut", lane: 2, col: 5 },
    ],
    ai: { interval: 11, types: ["pea", "nut", "sun"], maxPlants: 10 },
  },
  {
    id: 3,
    name: "霜降",
    blurb: "霜叶会拖慢你的步伐。",
    brains: 3,
    dawn: 115,
    startMoon: 145,
    moonRegen: 7.5,
    startPlants: [
      { type: "sun", lane: 2, col: 0 },
      { type: "ice", lane: 0, col: 3 },
      { type: "pea", lane: 1, col: 2 },
      { type: "ice", lane: 3, col: 3 },
      { type: "pea", lane: 4, col: 2 },
      { type: "nut", lane: 1, col: 5 },
      { type: "nut", lane: 3, col: 5 },
    ],
    ai: { interval: 10, types: ["pea", "ice", "nut", "sun"], maxPlants: 12 },
  },
  {
    id: 4,
    name: "重甲冲锋",
    blurb: "冲锋尸可以撕开防线。",
    brains: 4,
    dawn: 125,
    startMoon: 160,
    moonRegen: 8,
    startPlants: [
      { type: "sun", lane: 0, col: 0 },
      { type: "sun", lane: 4, col: 0 },
      { type: "pea", lane: 0, col: 2 },
      { type: "ice", lane: 1, col: 3 },
      { type: "pea", lane: 2, col: 2 },
      { type: "ice", lane: 3, col: 3 },
      { type: "pea", lane: 4, col: 2 },
      { type: "nut", lane: 0, col: 5 },
      { type: "nut", lane: 2, col: 6 },
      { type: "nut", lane: 4, col: 5 },
    ],
    ai: { interval: 8.5, types: ["pea", "ice", "nut", "sun"], maxPlants: 14 },
  },
  {
    id: 5,
    name: "脑园终夜",
    blurb: "吃掉五颗脑子。黎明之前。",
    brains: 5,
    dawn: 140,
    startMoon: 175,
    moonRegen: 8.5,
    startPlants: [
      { type: "sun", lane: 1, col: 0 },
      { type: "sun", lane: 3, col: 0 },
      { type: "pea", lane: 0, col: 2 },
      { type: "ice", lane: 1, col: 2 },
      { type: "pea", lane: 2, col: 3 },
      { type: "ice", lane: 3, col: 2 },
      { type: "pea", lane: 4, col: 3 },
      { type: "nut", lane: 0, col: 5 },
      { type: "nut", lane: 1, col: 6 },
      { type: "nut", lane: 2, col: 5 },
      { type: "nut", lane: 3, col: 6 },
      { type: "nut", lane: 4, col: 5 },
    ],
    ai: { interval: 7, types: ["pea", "ice", "nut", "sun"], maxPlants: 18 },
  },
  {
    id: 6,
    name: "无尽夜袭",
    blurb: "黎明两分钟。能吃几颗算几颗。",
    brains: 99,
    dawn: 120,
    startMoon: 170,
    moonRegen: 9,
    endless: true,
    startPlants: [
      { type: "pea", lane: 0, col: 3 },
      { type: "pea", lane: 2, col: 2 },
      { type: "pea", lane: 4, col: 3 },
      { type: "sun", lane: 1, col: 0 },
    ],
    ai: { interval: 8, types: ["pea", "sun", "nut", "ice"], maxPlants: 22 },
  },
];
