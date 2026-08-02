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
const GROUND_H = 26; // strip under the tower holding the ground rule
const TOP_HEADROOM = BLOCK_H * 2; // air kept above the moving block's row
const MAX_VISIBLE_ROWS = 9; // rows kept on screen before the camera pans
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
  /** Whether a frame is currently scheduled. See ensureLoop / tick. */
  private looping = false;
  private restartTimer: number | undefined;
  private lastTime = 0;
  /** Forces one paint of an otherwise-static scene (resize, reset, overlay). */
  private needsRedraw = true;

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

    this.resizeObserver = new ResizeObserver((entries) => this.measure(entries[0]));
    this.resizeObserver.observe(canvas);

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    canvas.addEventListener("pointerdown", this.onPointerDown, { passive: false });

    this.ensureLoop();
  }

  /**
   * Schedule a frame if one is not already coming.
   *
   * The loop parks itself whenever the scene is static (see tick), so every
   * path that can make it move again has to come back through here: input,
   * a resize, and the game-over restart timer. That is the complete list —
   * nothing else in this engine changes what is on screen.
   */
  private ensureLoop(): void {
    if (this.looping) return;
    this.looping = true;
    // Reset the clock rather than carrying the parked interval into the first
    // delta, which would teleport the block by however long the player stared
    // at the start screen. (tick clamps it too; this keeps the two honest.)
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Cancels the loop, drops listeners and timers, releases canvas refs. */
  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.looping = false;
    window.clearTimeout(this.restartTimer);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.blocks = [];
    this.particles = [];
  }

  /* --------------------------------- setup -------------------------------- */

  /**
   * Re-fit the backing store to the box, but only when that actually changes
   * anything.
   *
   * Both guards below matter on a phone and neither did anything on a desktop,
   * which is why this looked fine in development. The game box is sized in
   * `dvh`, and `dvh` is exactly the unit that tracks the mobile URL bar — so
   * one flick of the address bar walks the height through dozens of
   * intermediate values, and this observer fires for every one of them.
   *
   *  - Reading the size from the observer's own entry instead of
   *    getBoundingClientRect() removes a forced synchronous layout from inside
   *    a layout callback, measured at one per event.
   *  - Bailing when the device-pixel size is unchanged removes the rest.
   *    Assigning canvas.width reallocates and zeroes the whole backing store —
   *    at 2x DPR on a 360x300 box that is ~1.7MB, and the storm measured 90 of
   *    them in 1.5s. That allocation churn is the freeze: sub-pixel jitter and
   *    repeats now cost nothing, and a real resize still does the full job.
   */
  private measure = (entry?: ResizeObserverEntry): void => {
    // contentRect is the layout box, so unlike getBoundingClientRect it is not
    // perturbed by an ancestor's page-transition transform mid-animation.
    const rect = entry?.contentRect ?? this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    if (
      pixelWidth === this.canvas.width &&
      pixelHeight === this.canvas.height &&
      dpr === this.dpr
    ) {
      return;
    }

    this.dpr = dpr;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    // Keep the base block proportional when the viewport changes.
    if (this.blocks.length === 1 && this.phase === "idle") this.reset();

    // Re-aim the camera for the new height, so a rotation or resize mid-game
    // brings a tower that no longer fits back into view.
    this.cameraTarget = Math.max(0, (this.blocks.length - this.visibleRows()) * BLOCK_H);
    this.needsRedraw = true;
    // Resizing wipes the backing store, so a parked loop has to come back and
    // repaint or the canvas stays blank until the player touches it.
    this.ensureLoop();
  };

  /**
   * How many placed rows fit on screen before the camera pans.
   *
   * Derived from the measured height instead of a fixed 9: nine rows need
   * ~312px of canvas, but the responsive box clamps as low as 180px on short
   * phones — there the camera panned far too late and the moving block rode
   * above the top edge, partially hidden. Capped at MAX_VISIBLE_ROWS so tall
   * canvases behave exactly as before.
   */
  private visibleRows(): number {
    return Math.max(
      2,
      Math.min(
        MAX_VISIBLE_ROWS,
        Math.floor((this.height - GROUND_H - TOP_HEADROOM) / BLOCK_H),
      ),
    );
  }

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
    this.needsRedraw = true;
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
    // The listener is on window so the game can be played without focusing the
    // canvas, which also means it sees keys meant for whatever the player has
    // focused. Space and Enter are how a keyboard user presses a button, so
    // swallowing them here left "Cancel search" — the only other control on
    // this screen — silently dead under the keyboard.
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, a, input, textarea, select, [contenteditable], [role='button']")
    ) {
      return;
    }
    event.preventDefault();
    this.act();
  };

  private onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.act();
  };

  private act(): void {
    // Input is one of the three things that can restart a parked loop.
    this.ensureLoop();
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
        // The card sits still for two seconds, so by now the loop has parked.
        this.ensureLoop();
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

    this.cameraTarget = Math.max(0, (this.blocks.length - this.visibleRows()) * BLOCK_H);
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

    // The tower is never trimmed — speed and colour are both derived from
    // blocks.length, so dropping a row would change the game — which meant a
    // long run walked the whole array every frame just to skip the rows the
    // camera left below the floor. Rows are stacked in index order, so the
    // visible window is one contiguous slice: start at the lowest row that can
    // still be on screen and stop at the first one above it. The per-row
    // guards stay, so the arithmetic below only has to be a bound, not exact.
    const firstVisible = Math.max(
      0,
      Math.floor((this.cameraY - GROUND_H - BLOCK_H) / BLOCK_H) - 1,
    );
    for (let index = firstVisible; index < this.blocks.length; index += 1) {
      const y = this.blockScreenY(index);
      if (y > this.height + BLOCK_H) continue; // below the floor
      if (y < -BLOCK_H * 2) break; // above the ceiling, and so is everything after
      const block = this.blocks[index];
      const lift = index === this.blocks.length - 1 ? this.flash * 3 : 0;
      this.drawBlock(block.x, y, block.w, block.tone, lift);
    }

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

    // Integrated and compacted in one in-place pass. The forEach + filter pair
    // this replaces allocated a fresh array on every single frame, for a list
    // that is empty most of the time — pure garbage for the collector to come
    // back for, which on a low-end phone it does mid-animation.
    let alive = 0;
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      particle.vy += 900 * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta * 1.3;
      if (particle.life > 0) this.particles[alive++] = particle;
    }
    this.particles.length = alive;

    // Repaint only when something can have moved. The idle "press to start"
    // screen and the settled game-over card are static — redrawing them every
    // frame was pure battery burn on phones. (Sub-half-pixel camera drift is
    // invisible, so it does not count as motion.)
    const animating =
      this.phase === "running" ||
      this.particles.length > 0 ||
      this.flash > 0 ||
      this.shake > 0 ||
      Math.abs(this.cameraTarget - this.cameraY) > 0.5;

    if (animating || this.needsRedraw) {
      this.draw();
      this.needsRedraw = false;
    }

    if (animating) {
      this.frame = requestAnimationFrame(this.tick);
      return;
    }

    // Nothing on screen can move until the player, a resize or the restart
    // timer says so, and each of those calls ensureLoop(). Skipping the draw
    // was never enough on its own: the callback itself still woke the main
    // thread 60 times a second behind a start screen that never changes, on a
    // page where the search animations already want those frames.
    this.looping = false;
    this.frame = 0;
  };
}
