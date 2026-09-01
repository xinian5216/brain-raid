import { COLS, LANES, PLANTS, ZOMBIES } from "./config";
import { frameRect, type Assets } from "./assets";
import type { Sim } from "./sim";

export interface BoardLayout {
  ori: "h" | "v";
  x0: number;
  y0: number;
  cell: number;
  house: number;
  spawn: number;
  boardW: number;
  boardH: number;
}

export function computeLayout(w: number, h: number): BoardLayout {
  const ori: "h" | "v" = w / Math.max(1, h) > 1.12 ? "h" : "v";
  if (ori === "h") {
    const cell = Math.min(Math.floor((h - 8) / LANES), Math.floor((w - 24) / (COLS + 2.4)));
    const house = Math.round(cell * 1.35);
    const spawn = Math.round(cell * 1.15);
    const boardW = house + COLS * cell + spawn;
    const boardH = LANES * cell;
    return {
      ori,
      cell,
      house,
      spawn,
      boardW,
      boardH,
      x0: Math.floor((w - boardW) / 2),
      y0: Math.floor((h - boardH) / 2),
    };
  }
  const cell = Math.min(Math.floor((w - 8) / LANES), Math.floor((h - 16) / (COLS + 2.3)));
  const house = Math.round(cell * 1.25);
  const spawn = Math.round(cell * 1.05);
  const boardW = LANES * cell;
  const boardH = house + COLS * cell + spawn;
  return {
    ori,
    cell,
    house,
    spawn,
    boardW,
    boardH,
    x0: Math.floor((w - boardW) / 2),
    y0: Math.floor((h - boardH) / 2),
  };
}

export function laneAt(layout: BoardLayout, x: number, y: number): number {
  if (layout.ori === "h") {
    const ly = Math.floor((y - layout.y0) / layout.cell);
    if (ly < 0 || ly >= LANES) return -1;
    if (x < layout.x0 || x > layout.x0 + layout.boardW) return -1;
    return ly;
  }
  const lx = Math.floor((x - layout.x0) / layout.cell);
  if (lx < 0 || lx >= LANES) return -1;
  if (y < layout.y0 || y > layout.y0 + layout.boardH) return -1;
  return lx;
}

function cellOrigin(layout: BoardLayout, lane: number, pos: number) {
  const { ori, x0, y0, cell, house } = layout;
  if (ori === "h") {
    return { x: x0 + house + pos * cell, y: y0 + lane * cell };
  }
  return { x: x0 + lane * cell, y: y0 + house + pos * cell };
}

function drawSheet(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  index: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  rot = 0,
  flash = 0,
  flipX = false,
) {
  const fr = frameRect(img, index);
  ctx.save();
  ctx.translate(dx + dw / 2, dy + dh / 2);
  if (rot) ctx.rotate(rot);
  if (flipX) ctx.scale(-1, 1);
  if (flash > 0.04) ctx.filter = `brightness(${1.4 + flash})`;
  ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function hpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  color: string,
) {
  const h = 4;
  ctx.fillStyle = "rgba(12,14,12,0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(1, w * Math.max(0, Math.min(1, ratio))), h);
}

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  assets: Assets,
  layout: BoardLayout,
  hoverLane: number,
  shakeOn: boolean,
  reduced: boolean,
) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);

  const shake = shakeOn && !reduced ? sim.trauma * sim.trauma : 0;
  const ox = shake ? (Math.random() * 2 - 1) * shake * 10 : 0;
  const oy = shake ? (Math.random() * 2 - 1) * shake * 8 : 0;
  ctx.save();
  ctx.translate(ox, oy);

  drawBackdrop(ctx, W, H, sim);
  drawLawn(ctx, assets, layout, hoverLane);
  drawHouse(ctx, assets, layout, sim);
  drawGraves(ctx, assets, layout);

  const plants = sim.plants.filter((p) => p.alive);
  const zombies = sim.zombies.filter((z) => z.alive);
  const shots = sim.shots.filter((s) => s.alive);

  for (const p of plants) drawPlant(ctx, assets, layout, sim, p);
  for (const s of shots) drawShot(ctx, assets, layout, sim, s);
  zombies.sort((a, b) => a.lane - b.lane || a.pos - b.pos);
  for (const z of zombies) drawZombie(ctx, assets, layout, sim, z);

  for (const p of sim.particles) {
    if (!p.alive) continue;
    const o = cellOrigin(layout, p.x, p.y);
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(o.x, o.y, p.size * layout.cell, p.size * layout.cell);
    ctx.globalAlpha = 1;
  }
  ctx.font = `600 ${Math.max(11, Math.round(layout.cell * 0.22))}px "IBM Plex Sans", sans-serif`;
  ctx.textAlign = "center";
  for (const f of sim.floaters) {
    if (!f.alive) continue;
    const o = cellOrigin(layout, f.x, f.y);
    ctx.globalAlpha = Math.max(0, f.life / 0.7);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, o.x + layout.cell * 0.5, o.y);
    ctx.globalAlpha = 1;
  }

  if (sim.dawn < 18) {
    ctx.fillStyle = `rgba(196, 92, 106, ${((18 - sim.dawn) / 18) * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, sim: Sim) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0a1020");
  g.addColorStop(0.45, "#10180f");
  g.addColorStop(1, "#0c140c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(232,236,230,0.85)";
  ctx.beginPath();
  ctx.arc(W * 0.82, H * 0.1, Math.max(10, W * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(232,236,230,0.12)";
  ctx.beginPath();
  ctx.arc(W * 0.82, H * 0.1, Math.max(18, W * 0.055), 0, Math.PI * 2);
  ctx.fill();
  const t = sim.time;
  ctx.fillStyle = "rgba(200,212,204,0.35)";
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97 + t * 3) % 1) * W;
    const y = (i * 53) % (H * 0.35);
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawLawn(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  layout: BoardLayout,
  hoverLane: number,
) {
  const { ori, x0, y0, cell, house, spawn } = layout;
  const grass = assets.photos.grass;
  for (let lane = 0; lane < LANES; lane++) {
    const dark = lane % 2 === 0;
    for (let col = 0; col < COLS; col++) {
      const o = cellOrigin(layout, lane, col);
      ctx.fillStyle = dark ? "#244a22" : "#2f5c28";
      ctx.fillRect(o.x, o.y, cell, cell);
      ctx.globalAlpha = 0.35;
      const sx = (col * 37 + lane * 13) % Math.max(1, grass.width - cell);
      const sy = (lane * 29 + col * 11) % Math.max(1, grass.height - cell);
      ctx.drawImage(grass, sx, sy, cell, cell, o.x, o.y, cell, cell);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(12,14,12,0.18)";
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, cell - 1, cell - 1);
    }
    if (hoverLane === lane) {
      ctx.fillStyle = "rgba(200,212,204,0.12)";
      if (ori === "h") ctx.fillRect(x0, y0 + lane * cell, layout.boardW, cell);
      else ctx.fillRect(x0 + lane * cell, y0, cell, layout.boardH);
    }
  }
  ctx.fillStyle = "#1a2418";
  if (ori === "h") {
    ctx.fillRect(x0 + house + COLS * cell, y0, spawn, LANES * cell);
  } else {
    ctx.fillRect(x0, y0 + house + COLS * cell, LANES * cell, spawn);
  }
}

function drawHouse(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  layout: BoardLayout,
  sim: Sim,
) {
  const { ori, x0, y0, cell, house } = layout;
  ctx.fillStyle = "#1a2a18";
  if (ori === "h") ctx.fillRect(x0, y0, house, LANES * cell);
  else ctx.fillRect(x0, y0, LANES * cell, house);

  const img = assets.sheets.house;
  if (ori === "h") {
    const dw = house * 0.98;
    const dh = Math.min(LANES * cell * 0.95, dw * 1.55);
    ctx.drawImage(img, x0 + house * 0.02, y0 + LANES * cell - dh, dw, dh);
  } else {
    const dw = Math.min(LANES * cell * 0.62, house * 1.1);
    const dh = house * 0.96;
    ctx.drawImage(img, x0 + (LANES * cell - dw) / 2, y0 + house * 0.02, dw, dh);
  }

  const remain = sim.night.endless ? 3 : Math.max(0, sim.night.brains - sim.brains);
  const show = sim.night.endless ? 3 : sim.night.brains;
  const brain = assets.sheets.brain;
  for (let i = 0; i < show; i++) {
    const eaten = sim.night.endless ? false : i >= remain;
    const pulse = 0.85 + Math.sin(sim.time * 3 + i) * 0.15;
    ctx.globalAlpha = eaten ? 0.18 : pulse;
    if (ori === "h") {
      const by = y0 + LANES * cell - cell * 0.85 - i * cell * 0.55;
      ctx.drawImage(brain, x0 + house * 0.22, by, cell * 0.48, cell * 0.48);
    } else {
      const bx = x0 + (i + 0.25) * ((LANES * cell) / Math.max(3, show));
      ctx.drawImage(brain, bx, y0 + house * 0.22, cell * 0.42, cell * 0.42);
    }
    ctx.globalAlpha = 1;
  }
}

function drawGraves(ctx: CanvasRenderingContext2D, assets: Assets, layout: BoardLayout) {
  const { ori, x0, y0, cell, house, spawn } = layout;
  const grave = assets.sheets.grave;
  for (let lane = 0; lane < LANES; lane++) {
    if (ori === "h") {
      const gx = x0 + house + COLS * cell + spawn * 0.12;
      const gy = y0 + lane * cell + cell * 0.12;
      ctx.drawImage(grave, gx, gy, spawn * 0.7, cell * 0.8);
    } else {
      const gx = x0 + lane * cell + cell * 0.18;
      const gy = y0 + house + COLS * cell + spawn * 0.08;
      ctx.drawImage(grave, gx, gy, cell * 0.64, spawn * 0.85);
    }
  }
}

function drawPlant(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  layout: BoardLayout,
  sim: Sim,
  p: { type: keyof typeof PLANTS; lane: number; col: number; hp: number; maxHp: number; bob: number; flash: number; cd: number },
) {
  const def = PLANTS[p.type];
  const img = assets.sheets[def.sheet as keyof Assets["sheets"]];
  const o = cellOrigin(layout, p.lane, p.col);
  const cell = layout.cell;
  const bob = Math.sin(p.bob) * cell * 0.03;
  const shooting = def.fire > 0 && p.cd > def.fire - 0.18;
  const frame = shooting ? 2 + (Math.floor(sim.time * 8) % 2) : Math.floor(p.bob * 1.5) % 4;
  const rot = layout.ori === "v" ? Math.PI / 2 : 0;
  const pad = cell * 0.06;
  drawSheet(ctx, img, frame, o.x + pad, o.y + pad + bob, cell - pad * 2, cell - pad * 2, rot, p.flash);
  if (p.hp < p.maxHp) {
    hpBar(ctx, o.x + cell * 0.15, o.y + cell * 0.08, cell * 0.7, p.hp / p.maxHp, "#c45c6a");
  }
}

function drawZombie(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  layout: BoardLayout,
  sim: Sim,
  z: { type: keyof typeof ZOMBIES; lane: number; pos: number; hp: number; maxHp: number; bob: number; flash: number; slow: number; eating: number | null },
) {
  const def = ZOMBIES[z.type];
  const img = assets.sheets[def.sheet as keyof Assets["sheets"]];
  const o = cellOrigin(layout, z.lane, z.pos - 0.5);
  const cell = layout.cell;
  const size = cell * def.scale;
  const frame = z.eating != null ? Math.floor(sim.time * 6) % 4 : Math.floor(z.bob) % 4;
  const rot = layout.ori === "v" ? Math.PI / 2 : 0;
  const dx = o.x + (cell - size) / 2;
  const dy = o.y + (cell - size) / 2 + Math.sin(z.bob) * 1.5;
  if (z.slow > 0) {
    ctx.fillStyle = "rgba(154,212,212,0.18)";
    ctx.fillRect(dx, dy, size, size);
  }
  drawSheet(ctx, img, frame, dx, dy, size, size, rot, z.flash);
  hpBar(ctx, dx + size * 0.12, dy, size * 0.76, z.hp / z.maxHp, "#7a9b4a");
}

function drawShot(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  layout: BoardLayout,
  sim: Sim,
  s: { lane: number; pos: number; kind: "pea-shot" | "ice-shot" },
) {
  const img = assets.sheets[s.kind];
  const o = cellOrigin(layout, s.lane, s.pos);
  const sz = layout.cell * 0.32;
  const frame = Math.floor(sim.time * 10) % 4;
  const rot = layout.ori === "v" ? Math.PI / 2 : 0;
  drawSheet(ctx, img, frame, o.x, o.y + layout.cell * 0.34, sz, sz, rot, 0);
}
