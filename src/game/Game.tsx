import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { House, Moon, Pause, Volume2, VolumeX } from "lucide-react";
import { NIGHTS, ZOMBIE_ORDER, ZOMBIES, type ZombieId } from "./config";
import { loadAssets, type Assets } from "./assets";
import { asset } from "./paths";
import { GameAudio } from "./audio";
import { computeLayout, laneAt, renderBoard, type BoardLayout } from "./render";
import { loadSave, writeSave } from "./save";
import { Sim } from "./sim";
import type { HudSnap, Scene } from "./types";

const emptyCds = (): Record<ZombieId, number> => ({
  walker: 0,
  imp: 0,
  cone: 0,
  bucket: 0,
  football: 0,
});

function blankHud(): HudSnap {
  const save = typeof window === "undefined" ? null : loadSave();
  return {
    scene: "title",
    night: 1,
    nightName: "",
    moonlight: 0,
    brains: 0,
    brainsNeeded: 2,
    dawn: 0,
    dawnMax: 1,
    selected: "walker",
    cooldowns: emptyCds(),
    unlocked: save?.unlocked ?? 1,
    message: "",
    score: 0,
    bestEndless: save?.bestEndless ?? 0,
    sfx: save?.sfx ?? true,
    music: save?.music ?? true,
    shakeOn: save?.shakeOn ?? true,
    endless: false,
    hoverLane: -1,
  };
}

export function BrainRaid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Sim | null>(null);
  const assetsRef = useRef<Assets | null>(null);
  const audioRef = useRef(new GameAudio());
  const layoutRef = useRef<BoardLayout | null>(null);
  const hoverRef = useRef(-1);
  const keysRef = useRef(new Set<string>());
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const hudRef = useRef<HudSnap>(blankHud());
  const [hud, setHud] = useState<HudSnap>(blankHud);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);

  const patch = useCallback((partial: Partial<HudSnap>) => {
    hudRef.current = { ...hudRef.current, ...partial };
    setHud(hudRef.current);
  }, []);

  const persist = useCallback((partial?: Partial<HudSnap>) => {
    const h = { ...hudRef.current, ...partial };
    writeSave({
      version: 1,
      unlocked: h.unlocked,
      bestEndless: h.bestEndless,
      sfx: h.sfx,
      music: h.music,
      shakeOn: h.shakeOn,
    });
  }, []);

  const syncFromSim = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const h = hudRef.current;
    patch({
      moonlight: Math.floor(sim.moonlight),
      brains: sim.brains,
      brainsNeeded: sim.night.brains,
      dawn: sim.dawn,
      dawnMax: sim.night.dawn,
      selected: sim.selected,
      cooldowns: { ...sim.cooldowns },
      score: sim.score(),
      endless: !!sim.night.endless,
      hoverLane: hoverRef.current,
    });
    if (sim.ended && (h.scene === "play" || h.scene === "pause")) {
      if (sim.night.endless) {
        const best = Math.max(h.bestEndless, sim.brains);
        patch({ scene: "result", bestEndless: best, unlocked: Math.max(h.unlocked, 2) });
        persist({ bestEndless: best, unlocked: Math.max(h.unlocked, 2) });
      } else if (sim.won) {
        const unlocked = Math.max(h.unlocked, sim.night.id + 1);
        patch({ scene: "win", unlocked });
        persist({ unlocked });
      } else {
        patch({ scene: "lose" });
      }
    }
  }, [patch, persist]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutRef.current = computeLayout(w, h);
  }, []);

  const startNight = useCallback(
    (id: number) => {
      if (!assetsRef.current) return;
      const night = NIGHTS.find((n) => n.id === id);
      if (!night) return;
      const audio = audioRef.current;
      audio.unlock();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const sim = new Sim(
        night,
        {
          onPlace: () => audio.place(),
          onDeny: () => audio.deny(),
          onShoot: () => audio.shoot(),
          onHit: () => audio.hit(),
          onEat: () => audio.eat(),
          onBrain: () => audio.brain(),
          onGroan: () => audio.groan(),
          onWin: () => audio.win(),
          onLose: () => audio.lose(),
        },
        reduced,
      );
      simRef.current = sim;
      hoverRef.current = -1;
      patch({
        scene: "play",
        night: night.id,
        nightName: night.name,
        moonlight: night.startMoon,
        brains: 0,
        brainsNeeded: night.brains,
        dawn: night.dawn,
        dawnMax: night.dawn,
        selected: "walker",
        cooldowns: emptyCds(),
        endless: !!night.endless,
        message: "",
      });
      requestAnimationFrame(resize);
    },
    [patch, resize],
  );

  useEffect(() => {
    let alive = true;
    loadAssets()
      .then((a) => {
        if (!alive) return;
        assetsRef.current = a;
        setAssetsReady(true);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadErr(e instanceof Error ? e.message : "素材加载失败");
      });
    return () => {
      alive = false;
    };
  }, [patch]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") audioRef.current.resume();
      else keysRef.current.clear();
      persist();
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [persist]);

  useEffect(() => {
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [resize, hud.scene]);

  useEffect(() => {
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const last = lastRef.current || now;
      const dt = Math.min(0.1, (now - last) / 1000);
      lastRef.current = now;
      const canvas = canvasRef.current;
      const assets = assetsRef.current;
      const sim = simRef.current;
      const layout = layoutRef.current;
      if (!canvas || !assets) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const scene = hudRef.current.scene;

      if (scene === "play" && sim && layout) {
        const keys = keysRef.current;
        if (keys.has("Space") || keys.has("Escape") || keys.has("KeyP")) {
          keys.delete("Space");
          keys.delete("Escape");
          keys.delete("KeyP");
          patch({ scene: "pause" });
        }
        for (let i = 0; i < ZOMBIE_ORDER.length; i++) {
          if (keys.has(`Digit${i + 1}`) || keys.has(`Numpad${i + 1}`)) {
            const id = ZOMBIE_ORDER[i]!;
            if (ZOMBIES[id].unlockNight <= hudRef.current.night || hudRef.current.endless) {
              sim.selected = id;
            }
          }
        }
        sim.step(dt);
        audioRef.current.tickMusic(dt);
        renderBoard(ctx, sim, assets, layout, hoverRef.current, hudRef.current.shakeOn, sim.reducedMotion);
        if ((now | 0) % 2 === 0) syncFromSim();
      } else if (scene === "pause" && sim && layout) {
        renderBoard(ctx, sim, assets, layout, -1, false, true);
      } else {
        ctx.clearRect(0, 0, cssW, cssH);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [patch, syncFromSim]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      keysRef.current.add(e.code);
      if (e.code === "Escape" && hudRef.current.scene === "pause") {
        patch({ scene: "play" });
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [patch]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    const sim = simRef.current;
    if (!canvas || !layout || !sim || hud.scene !== "play") return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lane = laneAt(layout, x, y);
    hoverRef.current = lane;
    if (e.type === "pointerdown" && lane >= 0) {
      audioRef.current.unlock();
      sim.deploy(lane);
      syncFromSim();
    }
  };

  const selectZombie = (id: ZombieId) => {
    audioRef.current.unlock();
    audioRef.current.ui();
    const sim = simRef.current;
    if (sim) sim.selected = id;
    patch({ selected: id });
  };

  const toggle = (key: "sfx" | "music" | "shakeOn") => {
    audioRef.current.unlock();
    const next = !hudRef.current[key];
    if (key === "sfx") audioRef.current.setSfx(next);
    if (key === "music") audioRef.current.setMusic(next);
    patch({ [key]: next });
    persist({ [key]: next });
  };

  const playing = hud.scene === "play" || hud.scene === "pause" || hud.scene === "win" || hud.scene === "lose" || hud.scene === "result";

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={() => {
            hoverRef.current = -1;
          }}
          onPointerCancel={() => {
            hoverRef.current = -1;
          }}
        />
        {hud.scene !== "play" && hud.scene !== "pause" && hud.scene !== "win" && hud.scene !== "lose" && hud.scene !== "result" && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/sprites/title.jpg)" }}
          >
            <div className="absolute inset-0 bg-bg/70" />
          </div>
        )}
        {hud.scene === "title" && (
          <TitleScreen
            onStart={() => startNight(Math.min(hud.unlocked, 5))}
            onNights={() => patch({ scene: "nights" })}
            onHow={() => patch({ scene: "how" })}
            onEndless={() => startNight(6)}
            best={hud.bestEndless}
            ready={assetsReady}
            loadErr={loadErr}
          />
        )}
        {hud.scene === "nights" && (
          <NightSelect
            unlocked={hud.unlocked}
            best={hud.bestEndless}
            onPick={(id) => startNight(id)}
            onBack={() => patch({ scene: "title" })}
          />
        )}
        {hud.scene === "how" && <HowTo onBack={() => patch({ scene: "title" })} />}
        {playing && (
          <HudBar
            hud={hud}
            onPause={() => {
              if (hud.scene === "play") patch({ scene: "pause" });
            }}
          />
        )}
        {hud.scene === "pause" && (
          <Modal>
            <p className="font-display text-2xl">暂停</p>
            <p className="mt-1 text-sm text-muted">黎明还在逼近。</p>
            <div className="mt-5 flex flex-col gap-2">
              <Primary onClick={() => patch({ scene: "play" })}>继续</Primary>
              <Ghost onClick={() => toggle("sfx")}>音效 {hud.sfx ? "开" : "关"}</Ghost>
              <Ghost onClick={() => toggle("music")}>音乐 {hud.music ? "开" : "关"}</Ghost>
              <Ghost onClick={() => toggle("shakeOn")}>震动 {hud.shakeOn ? "开" : "关"}</Ghost>
              <Ghost onClick={() => { simRef.current = null; patch({ scene: "title" }); }}>
                返回墓园
              </Ghost>
            </div>
          </Modal>
        )}
        {hud.scene === "win" && (
          <Modal>
            <p className="font-display text-2xl">脑子入腹</p>
            <p className="mt-1 text-sm text-muted">
              {hud.nightName} 攻破。吃掉 {hud.brains} 颗脑子。
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {hud.night < 5 && (
                <Primary onClick={() => startNight(hud.night + 1)}>下一夜</Primary>
              )}
              <Ghost onClick={() => startNight(hud.night)}>再打一次</Ghost>
              <Ghost onClick={() => patch({ scene: "nights" })}>选择夜晚</Ghost>
            </div>
          </Modal>
        )}
        {hud.scene === "lose" && (
          <Modal>
            <p className="font-display text-2xl">黎明已至</p>
            <p className="mt-1 text-sm text-muted">
              只吃到 {hud.brains} / {hud.brainsNeeded} 颗。尸骨被阳光收回。
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Primary onClick={() => startNight(hud.night)}>再袭一次</Primary>
              <Ghost onClick={() => patch({ scene: "nights" })}>换一夜</Ghost>
            </div>
          </Modal>
        )}
        {hud.scene === "result" && (
          <Modal>
            <p className="font-display text-2xl">无尽结算</p>
            <p className="mt-1 text-sm text-muted">
              本夜吃掉 {hud.brains} 颗。最高 {hud.bestEndless} 颗。
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Primary onClick={() => startNight(6)}>再来一波</Primary>
              <Ghost onClick={() => patch({ scene: "title" })}>返回</Ghost>
            </div>
          </Modal>
        )}
      </div>
      {hud.scene === "play" && (
        <Picker
          hud={hud}
          onSelect={selectZombie}
          onPause={() => patch({ scene: "pause" })}
          onMute={() => toggle("sfx")}
        />
      )}
    </div>
  );
}

function TitleScreen({
  onStart,
  onNights,
  onHow,
  onEndless,
  best,
  ready,
  loadErr,
}: {
  onStart: () => void;
  onNights: () => void;
  onHow: () => void;
  onEndless: () => void;
  best: number;
  ready: boolean;
  loadErr: string | null;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12 sm:justify-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <p className="text-xs tracking-[0.28em] text-muted uppercase">Brain Raid</p>
        <h1 className="mt-1 font-display text-4xl leading-tight text-fg sm:text-5xl">尸潮夜袭</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          你是僵尸一方。从墓园派出部队，啃穿植物防线，冲进屋子吃掉脑子。
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Primary onClick={onStart} disabled={!ready}>
            {loadErr ? "素材失败" : "开始夜袭"}
          </Primary>
          <Ghost onClick={onNights}>选择夜晚</Ghost>
          <Ghost onClick={onEndless}>无尽模式{best > 0 ? ` · 最高 ${best}` : ""}</Ghost>
          <Ghost onClick={onHow}>怎么玩</Ghost>
        </div>
      </div>
    </div>
  );
}

function NightSelect({
  unlocked,
  best,
  onPick,
  onBack,
}: {
  unlocked: number;
  best: number;
  onPick: (id: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center overflow-auto px-4 py-6 sm:items-center">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface/92 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">选择夜晚</h2>
          <Ghost onClick={onBack}>返回</Ghost>
        </div>
        <div className="mt-4 grid gap-2">
          {NIGHTS.map((n) => {
            const locked = n.id < 6 ? n.id > unlocked : false;
            return (
              <button
                key={n.id}
                disabled={locked}
                onClick={() => onPick(n.id)}
                className="flex min-h-11 items-center justify-between rounded-md border border-border bg-surface-2 px-4 py-3 text-left disabled:opacity-40"
              >
                <span>
                  <span className="block font-display text-lg">{n.name}</span>
                  <span className="block text-xs text-muted">{n.blurb}</span>
                </span>
                <span className="text-xs text-muted">
                  {locked ? "未解锁" : n.endless ? `最高 ${best}` : `${n.brains} 脑`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center overflow-auto px-4 py-6 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface/92 p-5">
        <h2 className="font-display text-2xl">怎么玩</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          <li>底部选择僵尸，点花园里的一条行道部署。它们会走向屋子。</li>
          <li>电脑：按 1–5 选兵，点击行道放出。Esc 暂停。</li>
          <li>啃掉植物能拿月光。月光也会随时间回复。</li>
          <li>僵尸摸到屋子就吃一颗脑子。吃够目标即胜。</li>
          <li>黎明到了还没吃够，尸潮就会散掉。</li>
        </ul>
        <div className="mt-5">
          <Primary onClick={onBack}>明白了</Primary>
        </div>
      </div>
    </div>
  );
}

function HudBar({ hud, onPause }: { hud: HudSnap; onPause: () => void }) {
  const pct = Math.max(0, hud.dawn / Math.max(1, hud.dawnMax));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface/90 px-3 py-2">
        <Moon className="size-4 text-moon" />
        <span className="font-display text-lg tabular-nums">{hud.moonlight}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className="rounded-md border border-border bg-surface/90 px-3 py-1 font-display text-sm">
          {hud.nightName}
        </div>
        <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brain transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)]"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="flex min-h-11 items-center gap-1 rounded-md border border-border bg-surface/90 px-3 py-2">
          <House className="size-4 text-brain" />
          <span className="font-display text-lg tabular-nums">
            {hud.endless ? hud.brains : `${hud.brains}/${hud.brainsNeeded}`}
          </span>
        </div>
        {hud.scene === "play" && (
          <button
            type="button"
            onClick={onPause}
            className="flex size-11 items-center justify-center rounded-md border border-border bg-surface/90"
            aria-label="暂停"
          >
            <Pause className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Picker({
  hud,
  onSelect,
  onPause,
  onMute,
}: {
  hud: HudSnap;
  onSelect: (id: ZombieId) => void;
  onPause: () => void;
  onMute: () => void;
}) {
  return (
    <div className="z-10 flex items-end gap-2 border-t border-border bg-surface/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {ZOMBIE_ORDER.map((id, i) => {
          const z = ZOMBIES[id];
          const unlocked = z.unlockNight <= hud.night || hud.endless;
          const cd = hud.cooldowns[id] ?? 0;
          const selected = hud.selected === id;
          const poor = hud.moonlight < z.cost;
          return (
            <button
              key={id}
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && onSelect(id)}
              className={`relative flex min-h-16 min-w-[4.5rem] flex-1 flex-col items-center justify-center overflow-hidden rounded-md border px-1 py-1 text-center disabled:opacity-35 ${
                selected ? "border-accent bg-surface-2" : "border-border bg-bg"
              }`}
            >
              <span className="h-9 w-9 overflow-hidden">
              <img
                src={asset(`sprites/${z.sheet}.png`)}
                alt=""
                className="h-[4.5rem] w-[4.5rem] max-w-none -translate-x-1 -translate-y-1"
                draggable={false}
              />
              </span>
              <span className="font-display text-xs leading-none">{z.name}</span>
              <span className={`mt-0.5 text-xs tabular-nums ${poor ? "text-brain" : "text-muted"}`}>
                {z.cost} · {i + 1}
              </span>
              {cd > 0 && (
                <span className="absolute inset-0 grid place-items-center rounded-md bg-bg/60 font-display text-sm tabular-nums">
                  {cd.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onMute}
          className="flex size-11 items-center justify-center rounded-md border border-border bg-bg"
          aria-label="音效"
        >
          {hud.sfx ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onPause}
          className="flex size-11 items-center justify-center rounded-md border border-border bg-bg sm:hidden"
          aria-label="暂停"
        >
          <Pause className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-bg/55 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">{children}</div>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 font-display text-base text-accent-fg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface-2 px-4 text-sm text-fg"
    >
      {children}
    </button>
  );
}
