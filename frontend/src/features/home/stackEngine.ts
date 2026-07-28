/**
 * Stack game engine — plain TypeScript, no React.
 *
 * Owns its canvas, loop, input, particles and timers. The React shell only
 * constructs it and calls destroy(); nothing here ever touches component
 * state, so a running game causes zero re-renders and cannot perturb
 * matchmaking polling or socket traffic.
 */

const BLOCK_H = 26;
const PERFECT_EPS = 4; // px of slack that still counts as a perfect drop
const BASE_SPEED = 210; // px/s at tower height 0
const SPEED_PER_ROW = 7; // px/s gained per placed block
const MAX_SPEED = 520;
const VISIBLE_ROWS = 9; // rows kept on screen before the camera pans
const RESTART_DELAY = 2000;

type Phase = "idle" | "running" | "over";

interface Block {
  x: number;
  w: number;
  tone: number;
}

interface Particle {
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  life: number;
  tone: number;
}

/** Survives remounts within a session so the wait keeps its high score. */
let sessionBest = 0;

export interface StackEngineOptions {
  /** Shown in the start overlay; differs on touch devices. */
  coarsePointer: boolean;
}

export class StackEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: StackEngineOptions;

  private width = 0;
  private height = 0;
  private dpr = 1;

  private phase: Phase = "idle";
  private blocks: Block[] = [];
  private current: Block & { dir: number } = { x: 0, w: 0, tone: 0, dir: 1 };
  private particles: Particle[] = [];

  private score = 0;
  private combo = 0;
  private flash = 0; // perfect-drop pulse, decays to 0
  private shake = 0; // game-over shake, decays to 0
  private cameraY = 0;
  private cameraTarget = 0;

  private frame = 0;
  private restartTimer: number | undefined;
  private lastTime = 0;

  private ink = "#0a0a0a";
  private bg = "#fbf9f5";
  private tones: string[] = ["#ffd600", "#ccff00", "#e8ebff"];

  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, options: StackEngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.options = options;

    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    this.ink = token("--color-ink", this.ink);
    this.bg = token("--color-canvas", this.bg);
    this.tones = [
      token("--color-brand-yellow", "#ffd600"),
      token("--color-brand-lime", "#ccff00"),
      token("--color-brand-lavender", "#e8ebff"),
    ];

    this.measure();
    this.reset();

    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(canvas);

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    canvas.addEventListener("pointerdown", this.onPointerDown, { passive: false });

    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Cancels the loop, drops listeners and timers, releases canvas refs. */
  destroy(): void {
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.restartTimer);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.blocks = [];
    this.particles = [];
  }

  /* --------------------------------- setup -------------------------------- */

  private measure = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    // Keep the base block proportional when the viewport changes.
    if (this.blocks.length === 1 && this.phase === "idle") this.reset();
  };

  private reset(): void {
    const baseWidth = Math.min(260, Math.max(120, this.width * 0.42));
    this.blocks = [{ x: (this.width - baseWidth) / 2, w: baseWidth, tone: 0 }];
    this.particles = [];
    this.score = 0;
    this.combo = 0;
    this.flash = 0;
    this.shake = 0;
    this.cameraY = 0;
    this.cameraTarget = 0;
    this.spawn();
  }

  private spawn(): void {
    const top = this.blocks[this.blocks.length - 1];
    // Alternate the entry side so the rhythm doesn't become predictable.
    const fromLeft = this.blocks.length % 2 === 0;
    this.current = {
      x: fromLeft ? -top.w : this.width,
      w: top.w,
      tone: this.blocks.length % this.tones.length,
      dir: fromLeft ? 1 : -1,
    };
  }

  private get speed(): number {
    return Math.min(MAX_SPEED, BASE_SPEED + this.blocks.length * SPEED_PER_ROW);
  }

  /* --------------------------------- input -------------------------------- */

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    this.act();
  };

  private onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.act();
  };

  private act(): void {
    if (this.phase === "idle") {
      this.phase = "running";
      return;
    }
    if (this.phase === "running") this.drop();
    // While "over" the auto-restart timer owns the transition; taps do nothing
    // so a frustrated player cannot skip past their own score.
  }

  private drop(): void {
    const top = this.blocks[this.blocks.length - 1];
    const offset = this.current.x - top.x;

    // No overlap at all — the tower is done.
    if (Math.abs(offset) >= top.w) {
      this.spawnParticles(this.current.x, this.current.w, this.current.tone, 16);
      this.phase = "over";
      this.shake = 1;
      sessionBest = Math.max(sessionBest, this.score);
      this.restartTimer = window.setTimeout(() => {
        this.reset();
        this.phase = "running";
      }, RESTART_DELAY);
      return;
    }

    if (Math.abs(offset) <= PERFECT_EPS) {
      // Snap flush and reward the streak.
      this.blocks.push({ x: top.x, w: top.w, tone: this.current.tone });
      this.combo += 1;
      this.score += 1 + Math.min(this.combo, 5);
      this.flash = 1;
    } else {
      const overlap = top.w - Math.abs(offset);
      const x = offset > 0 ? this.current.x : top.x;
      // The offcut shears away as shards.
      const cutX = offset > 0 ? x + overlap : this.current.x;
      this.spawnParticles(cutX, Math.abs(offset), this.current.tone, 7);
      this.blocks.push({ x, w: overlap, tone: this.current.tone });
      this.combo = 0;
      this.score += 1;
    }

    this.cameraTarget = Math.max(0, (this.blocks.length - VISIBLE_ROWS) * BLOCK_H);
    this.spawn();
  }

  private spawnParticles(x: number, w: number, tone: number, count: number): void {
    const y = this.blockScreenY(this.blocks.length);
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x: x + Math.random() * Math.max(w, 6),
        y: y + Math.random() * BLOCK_H,
        w: 3 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 130,
        vy: -40 - Math.random() * 120,
        life: 1,
        tone,
      });
    }
  }

  /* -------------------------------- drawing ------------------------------- */

  /** Screen Y of the row at `index`, accounting for the camera. */
  private blockScreenY(index: number): number {
    return this.height - 26 - (index + 1) * BLOCK_H + this.cameraY;
  }

  private drawBlock(x: number, y: number, w: number, tone: number, lift = 0): void {
    // Hard offset shadow — the same language as the surrounding UI.
    this.ctx.fillStyle = this.ink;
    this.ctx.fillRect(x + 4, y + 4, w, BLOCK_H);
    this.ctx.fillStyle = this.tones[tone % this.tones.length];
    this.ctx.fillRect(x, y - lift, w, BLOCK_H);
    this.ctx.strokeStyle = this.ink;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 1, y - lift + 1, w - 2, BLOCK_H - 2);
  }

  private drawHud(): void {
    const { ctx } = this;
    ctx.textAlign = "right";
    ctx.fillStyle = this.ink;
    ctx.font = "800 30px ui-monospace, monospace";
    ctx.fillText(String(this.score), this.width - 18, 42);

    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = "#6b675f";
    ctx.fillText(`BEST ${sessionBest}`, this.width - 18, 60);

    if (this.combo > 1 && this.phase === "running") {
      ctx.fillStyle = this.ink;
      ctx.font = "800 11px ui-monospace, monospace";
      ctx.fillText(`PERFECT ×${this.combo}`, this.width - 18, 80);
    }
    ctx.textAlign = "left";
  }

  private drawOverlay(): void {
    const { ctx } = this;
    ctx.textAlign = "center";

    if (this.phase === "idle") {
      ctx.fillStyle = this.ink;
      ctx.font = "800 22px ui-monospace, monospace";
      ctx.fillText(
        this.options.coarsePointer ? "TAP TO START" : "PRESS SPACE TO START",
        this.width / 2,
        this.height / 2 - 6,
      );
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillStyle = "#6b675f";
      ctx.fillText("STACK THE BLOCKS", this.width / 2, this.height / 2 + 16);
    }

    if (this.phase === "over") {
      const boxW = 260;
      const boxH = 84;
      const boxX = this.width / 2 - boxW / 2;
      const boxY = this.height / 2 - boxH / 2;

      ctx.fillStyle = this.ink;
      ctx.fillRect(boxX + 5, boxY + 5, boxW, boxH);
      ctx.fillStyle = this.tones[0];
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = this.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

      ctx.fillStyle = this.ink;
      ctx.font = "800 20px ui-monospace, monospace";
      ctx.fillText("GAME OVER", this.width / 2, boxY + 32);
      ctx.font = "800 26px ui-monospace, monospace";
      ctx.fillText(String(this.score), this.width / 2, boxY + 60);
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillStyle = "#6b675f";
      ctx.fillText("RESTARTING…", this.width / 2, boxY + 74);
    }

    ctx.textAlign = "left";
  }

  private draw(): void {
    const { ctx } = this;

    ctx.save();
    if (this.shake > 0) {
      const magnitude = this.shake * 7;
      ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
    }

    ctx.fillStyle = this.bg;
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    // Ground rule.
    ctx.fillStyle = this.ink;
    ctx.fillRect(0, this.height - 26 + this.cameraY, this.width, 2);

    this.blocks.forEach((block, index) => {
      const y = this.blockScreenY(index);
      if (y > this.height + BLOCK_H || y < -BLOCK_H * 2) return; // offscreen
      const lift = index === this.blocks.length - 1 ? this.flash * 3 : 0;
      this.drawBlock(block.x, y, block.w, block.tone, lift);
    });

    if (this.phase === "running") {
      this.drawBlock(
        this.current.x,
        this.blockScreenY(this.blocks.length),
        this.current.w,
        this.current.tone,
      );
    }

    this.particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = this.tones[particle.tone % this.tones.length];
      ctx.fillRect(particle.x, particle.y, particle.w, particle.w);
      ctx.strokeStyle = this.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(particle.x, particle.y, particle.w, particle.w);
    });
    ctx.globalAlpha = 1;

    this.drawHud();
    this.drawOverlay();
    ctx.restore();
  }

  /* --------------------------------- loop --------------------------------- */

  private tick = (now: number): void => {
    // Clamped so a backgrounded tab cannot fling the block across the canvas.
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.phase === "running") {
      const speed = this.speed;
      this.current.x += this.current.dir * speed * delta;

      // Bounce just past the edges so the block fully clears the frame.
      const leftLimit = -this.current.w;
      const rightLimit = this.width;
      if (this.current.x <= leftLimit) {
        this.current.x = leftLimit;
        this.current.dir = 1;
      } else if (this.current.x >= rightLimit) {
        this.current.x = rightLimit;
        this.current.dir = -1;
      }
    }

    // Lerped camera — never jumps, always settles.
    this.cameraY += (this.cameraTarget - this.cameraY) * Math.min(1, delta * 6);
    this.flash = Math.max(0, this.flash - delta * 3);
    this.shake = Math.max(0, this.shake - delta * 2.5);

    this.particles.forEach((particle) => {
      particle.vy += 900 * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta * 1.3;
    });
    this.particles = this.particles.filter((particle) => particle.life > 0);

    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };
}
