import {
  COLS,
  LANES,
  NIGHTS,
  PLANTS,
  TICK,
  ZOMBIES,
  type NightDef,
  type PlantId,
  type ZombieId,
} from "./config";
import type { Floater, Particle, Plant, Shot, Zombie } from "./types";

export interface SimEvents {
  onPlace: () => void;
  onDeny: () => void;
  onShoot: () => void;
  onHit: () => void;
  onEat: () => void;
  onBrain: () => void;
  onGroan: () => void;
  onWin: () => void;
  onLose: () => void;
}

let nextId = 1;
const id = () => nextId++;

export class Sim {
  night: NightDef;
  moonlight: number;
  brains = 0;
  dawn: number;
  zombies: Zombie[] = [];
  plants: Plant[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  cooldowns: Record<ZombieId, number> = {
    walker: 0,
    imp: 0,
    cone: 0,
    bucket: 0,
    football: 0,
  };
  selected: ZombieId = "walker";
  acc = 0;
  plantAcc = 0;
  time = 0;
  trauma = 0;
  hitstop = 0;
  won = false;
  lost = false;
  ended = false;
  events: SimEvents;
  reducedMotion = false;

  constructor(night: NightDef, events: SimEvents, reducedMotion: boolean) {
    this.night = night;
    this.moonlight = night.startMoon;
    this.dawn = night.dawn;
    this.events = events;
    this.reducedMotion = reducedMotion;
    for (const p of night.startPlants) this.spawnPlant(p.type, p.lane, p.col);
  }

  spawnPlant(type: PlantId, lane: number, col: number): boolean {
    if (col < 0 || col >= COLS || lane < 0 || lane >= LANES) return false;
    if (this.plants.some((p) => p.alive && p.lane === lane && p.col === col)) return false;
    const def = PLANTS[type];
    this.plants.push({
      id: id(),
      type,
      lane,
      col,
      hp: def.hp,
      maxHp: def.hp,
      cd: 0.4 + Math.random() * 0.6,
      flash: 0,
      bob: Math.random() * Math.PI * 2,
      alive: true,
    });
    return true;
  }

  spawnZombie(type: ZombieId, lane: number) {
    const def = ZOMBIES[type];
    this.zombies.push({
      id: id(),
      type,
      lane,
      pos: COLS + 0.42,
      hp: def.hp,
      maxHp: def.hp,
      eating: null,
      slow: 0,
      flash: 0,
      bob: Math.random() * Math.PI * 2,
      alive: true,
    });
    this.events.onGroan();
  }

  canAfford(type: ZombieId) {
    const def = ZOMBIES[type];
    return this.moonlight >= def.cost && this.cooldowns[type] <= 0;
  }

  deploy(lane: number): boolean {
    if (this.ended || lane < 0 || lane >= LANES) return false;
    const type = this.selected;
    const def = ZOMBIES[type];
    if (this.moonlight < def.cost || this.cooldowns[type] > 0) {
      this.events.onDeny();
      return false;
    }
    this.moonlight -= def.cost;
    this.cooldowns[type] = def.cooldown;
    this.spawnZombie(type, lane);
    this.events.onPlace();
    return true;
  }

  step(dt: number) {
    if (this.ended) {
      this.tickFx(dt);
      return;
    }
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= TICK) {
      if (this.hitstop > 0) {
        this.hitstop -= TICK;
        this.tickFx(TICK);
      } else {
        this.fixed(TICK);
      }
      this.acc -= TICK;
    }
  }

  private fixed(dt: number) {
    this.time += dt;
    this.dawn = Math.max(0, this.dawn - dt);
    this.moonlight = Math.min(350, this.moonlight + this.night.moonRegen * dt);
    for (const k of Object.keys(this.cooldowns) as ZombieId[]) {
      this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    this.plantAcc += dt;
    const interval = this.night.endless
      ? Math.max(4.2, this.night.ai.interval - this.time * 0.025)
      : this.night.ai.interval;
    if (this.plantAcc >= interval) {
      this.plantAcc = 0;
      this.aiPlace();
    }

    this.tickPlants(dt);
    this.tickZombies(dt);
    this.tickShots(dt);
    this.tickFx(dt);
    this.prune();

    if (!this.ended && this.brains >= this.night.brains && !this.night.endless) {
      this.ended = true;
      this.won = true;
      this.events.onWin();
    }
    if (!this.ended && this.dawn <= 0) {
      this.ended = true;
      if (this.night.endless) {
        this.won = true;
        this.events.onWin();
      } else {
        this.lost = true;
        this.events.onLose();
      }
    }
  }

  private occupied(lane: number, col: number) {
    return this.plants.some((p) => p.alive && p.lane === lane && p.col === col);
  }

  private aiPlace() {
    const live = this.plants.filter((p) => p.alive).length;
    if (live >= this.night.ai.maxPlants) return;
    const types = this.night.ai.types;
    const threat = Array.from({ length: LANES }, (_, lane) => {
      let t = 0;
      for (const z of this.zombies) {
        if (z.alive && z.lane === lane) t += z.hp / Math.max(0.4, z.pos);
      }
      return t;
    });
    const order = [0, 1, 2, 3, 4].sort((a, b) => threat[b]! - threat[a]! || Math.random() - 0.5);
    const type = types[Math.floor(Math.random() * types.length)]!;
    const preferredCols =
      type === "sun" ? [0, 1] : type === "nut" ? [5, 6, 4, 7] : [2, 3, 4, 1];
    for (const lane of order) {
      for (const col of preferredCols) {
        if (!this.occupied(lane, col)) {
          this.spawnPlant(type, lane, col);
          return;
        }
      }
      for (let col = 0; col < COLS; col++) {
        if (!this.occupied(lane, col)) {
          this.spawnPlant(type, lane, col);
          return;
        }
      }
    }
  }

  private frontZombie(lane: number): Zombie | null {
    let best: Zombie | null = null;
    for (const z of this.zombies) {
      if (!z.alive || z.lane !== lane) continue;
      if (!best || z.pos < best.pos) best = z;
    }
    return best;
  }

  private tickPlants(dt: number) {
    for (const p of this.plants) {
      if (!p.alive) continue;
      p.bob += dt * 2.2;
      p.flash = Math.max(0, p.flash - dt * 6);
      const def = PLANTS[p.type];
      if (!def.fire || !def.projectile) continue;
      p.cd -= dt;
      const target = this.frontZombie(p.lane);
      if (target && target.pos > p.col + 0.2 && p.cd <= 0) {
        p.cd = def.fire;
        this.shots.push({
          id: id(),
          lane: p.lane,
          pos: p.col + 0.35,
          dmg: def.dmg,
          slow: def.slow,
          kind: def.projectile,
          alive: true,
        });
        this.events.onShoot();
      }
    }
  }

  private blocker(z: Zombie): Plant | null {
    let best: Plant | null = null;
    for (const p of this.plants) {
      if (!p.alive || p.lane !== z.lane) continue;
      if (z.pos <= p.col + 0.48 && z.pos >= p.col - 0.12) {
        if (!best || p.col > best.col) best = p;
      }
    }
    return best;
  }

  private ahead(z: Zombie): Zombie | null {
    let best: Zombie | null = null;
    for (const o of this.zombies) {
      if (!o.alive || o === z || o.lane !== z.lane) continue;
      if (o.pos < z.pos && z.pos - o.pos < 0.42) {
        if (!best || o.pos > best.pos) best = o;
      }
    }
    return best;
  }

  private tickZombies(dt: number) {
    for (const z of this.zombies) {
      if (!z.alive) continue;
      z.bob += dt * (z.slow > 0 ? 4 : 7);
      z.flash = Math.max(0, z.flash - dt * 8);
      z.slow = Math.max(0, z.slow - dt);
      const def = ZOMBIES[z.type];
      const plant = this.blocker(z);
      if (plant) {
        z.eating = plant.id;
        z.pos = Math.max(z.pos - dt * 0.04, plant.col + 0.38);
        plant.hp -= def.dmg * dt;
        plant.flash = 1;
        if (plant.hp <= 0) {
          this.killPlant(plant, z);
        }
        continue;
      }
      z.eating = null;
      if (this.ahead(z)) continue;
      const spd = def.speed * (z.slow > 0 ? 0.48 : 1);
      z.pos -= spd * dt;
      if (z.pos <= 0.02) {
        this.eatBrain(z);
      }
    }
  }

  private tickShots(dt: number) {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.pos += 3.6 * dt;
      if (s.pos > COLS + 0.8) {
        s.alive = false;
        continue;
      }
      for (const z of this.zombies) {
        if (!z.alive || z.lane !== s.lane) continue;
        if (s.pos >= z.pos - 0.28 && s.pos <= z.pos + 0.15) {
          z.hp -= s.dmg;
          z.flash = 1;
          if (s.slow) z.slow = Math.max(z.slow, s.slow);
          s.alive = false;
          this.events.onHit();
          this.burst(s.lane, z.pos, s.kind === "ice-shot" ? "#9ad4d4" : "#b6de6a", 6);
          this.addFloater(s.lane, z.pos, `-${s.dmg}`, "#e8ece6");
          if (z.hp <= 0) this.killZombie(z);
          break;
        }
      }
    }
  }

  private killPlant(p: Plant, by: Zombie) {
    p.alive = false;
    const loot = PLANTS[p.type].loot;
    this.moonlight = Math.min(350, this.moonlight + loot);
    this.events.onEat();
    this.trauma = Math.min(1, this.trauma + 0.18);
    this.burst(p.lane, p.col, "#7a9b4a", 10);
    this.addFloater(p.lane, p.col, `+${loot}`, "#c8d4cc");
    by.eating = null;
  }

  private killZombie(z: Zombie) {
    z.alive = false;
    this.burst(z.lane, z.pos, "#7a9b4a", 8);
    this.trauma = Math.min(1, this.trauma + 0.12);
  }

  private eatBrain(z: Zombie) {
    z.alive = false;
    this.brains += 1;
    this.events.onBrain();
    this.trauma = Math.min(1, this.trauma + 0.55);
    if (!this.reducedMotion) this.hitstop = 0.09;
    this.burst(z.lane, 0, "#c45c6a", 14);
    this.addFloater(z.lane, 0.2, "脑子!", "#c45c6a");
  }

  burst(lane: number, pos: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: lane,
        y: pos,
        vx: (Math.random() - 0.5) * 2.4,
        vy: (Math.random() - 0.5) * 2.4,
        life: 0.28 + Math.random() * 0.25,
        max: 0.5,
        size: 0.06 + Math.random() * 0.08,
        color,
        alive: true,
      });
    }
  }

  addFloater(lane: number, pos: number, text: string, color: string) {
    this.floaters.push({
      x: lane,
      y: pos,
      text,
      life: 0.7,
      color,
      alive: true,
    });
  }

  private tickFx(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.y -= dt * 0.55;
      f.life -= dt;
      if (f.life <= 0) f.alive = false;
    }
  }

  private prune() {
    if (this.zombies.length > 80) this.zombies = this.zombies.filter((z) => z.alive);
    if (this.plants.length > 80) this.plants = this.plants.filter((p) => p.alive);
    if (this.shots.length > 80) this.shots = this.shots.filter((s) => s.alive);
    if (this.particles.length > 160) this.particles = this.particles.filter((p) => p.alive);
    if (this.floaters.length > 40) this.floaters = this.floaters.filter((f) => f.alive);
  }

  score() {
    return this.brains * 200 + Math.floor(this.moonlight);
  }
}
