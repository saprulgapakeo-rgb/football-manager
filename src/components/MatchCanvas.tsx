import { useEffect, useRef, type MutableRefObject } from 'react';
import type { MatchSim, SimPlayer } from '@/game/matchEngine';
import { getSpriteFrame, visibleAnim } from '@/game/animation';

export type MatchQuality = 'low' | 'medium' | 'high';

// World mapping matches the old SVG viewBox: sx = x * 1.05, sy = y * 0.68 (105 x 68 pitch).
const PW = 105, PH = 68;

interface SubAnim {
  key: string;
  team: 0 | 1;
  outNum: number; outX: number; outY: number;
  inNum: number; inId: string;
  exitY: number; // touchline the players use (sim coords)
  born: number; // performance.now() when first seen
}

interface Props {
  getSim: () => MatchSim | null;
  selectedId: string | null;
  onSelect: (team: 0 | 1, id: string) => void;
  quality: MatchQuality;
  userSecondary: string;
  drawHandle: MutableRefObject<(() => void) | null>;
}

export function MatchCanvas({ getSim, selectedId, onSelect, quality, userSecondary, drawHandle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const qRef = useRef(quality); qRef.current = quality;
  const secRef = useRef(userSecondary); secRef.current = userSecondary;
  const getSimRef = useRef(getSim); getSimRef.current = getSim;
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const pitchCache = useRef<HTMLCanvasElement | null>(null);
  const pitchKey = useRef('');
  const subs = useRef(new Map<string, SubAnim>());
  const trail = useRef<{ x: number; y: number }[]>([]);
  const lastSim = useRef<MatchSim | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, dpr = 1;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const q = qRef.current;
      dpr = q === 'low' ? 1 : q === 'medium' ? Math.min(1.5, window.devicePixelRatio || 1) : Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(50, Math.round(r.width * dpr));
      H = Math.max(30, Math.round(r.height * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const X = (x: number) => (x * 1.05 / PW) * W;
    const Y = (y: number) => (y * 0.68 / PH) * H;
    const S = () => W / PW; // px per pitch-unit

    const paintPitch = () => {
      const q = qRef.current;
      const key = `${W}x${H}:${q}`;
      if (pitchCache.current && pitchKey.current === key) return pitchCache.current;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = '#14532d';
      g.fillRect(0, 0, W, H);
      const u = W / PW, v = H / PH;
      if (q !== 'low') {
        for (let i = 0; i < 10; i++) {
          g.fillStyle = i % 2 ? '#1a6b35' : '#1f7a3d';
          g.fillRect(i * 10.5 * u, 0, 10.5 * u + 1, H);
        }
      }
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = Math.max(1, 0.3 * u);
      const R = (x: number, y: number, w: number, h: number) => g.strokeRect(x * u, y * v, w * u, h * v);
      R(0, 0, PW, PH);
      g.beginPath(); g.moveTo(52.5 * u, 0); g.lineTo(52.5 * u, H); g.stroke();
      g.beginPath(); g.arc(52.5 * u, 34 * v, 9.15 * u, 0, Math.PI * 2); g.stroke();
      R(0, 13.84, 16.5, 40.32); R(88.5, 13.84, 16.5, 40.32);
      R(0, 24.84, 5.5, 18.32); R(99.5, 24.84, 5.5, 18.32);
      g.beginPath(); g.arc(11 * u, 34 * v, 9.15 * u, -0.926, 0.926); g.stroke();
      g.beginPath(); g.arc(94 * u, 34 * v, 9.15 * u, Math.PI - 0.926, Math.PI + 0.926); g.stroke();
      for (const [cx, cy, r] of [[52.5, 34, 0.4], [11, 34, 0.35], [94, 34, 0.35]] as const) {
        g.beginPath(); g.arc(cx * u, cy * v, r * u, 0, Math.PI * 2); g.fill();
      }
      // goals at the edges
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(0, 30.34 * v, 1.2 * u, 7.32 * v);
      g.fillRect(W - 1.2 * u, 30.34 * v, 1.2 * u, 7.32 * v);
      pitchCache.current = c;
      pitchKey.current = key;
      return c;
    };

    const drawPlayer = (p: SimPlayer, kit: string, kitText: string, ti: 0 | 1, sim: MatchSim, now: number, q: MatchQuality, proxy?: { x: number; y: number; alpha: number }) => {
      const s = S();
      const px = proxy ? X(proxy.x) : X(p.x);
      const py = proxy ? Y(proxy.y) : Y(p.y);
      const alpha = proxy ? proxy.alpha : 1;
      const anim = visibleAnim(p.anim, sim.minute);
      const celebrating = anim === 'celebrate';
      const diving = anim === 'diving';
      const injured = p.injured;
      const r = 1.75 * s * (celebrating ? 1 + 0.12 * Math.sin(now / 90) : 1);
      const isCarrier = sim.ball.state === 'owned' && sim.possession === ti && sim.teams[ti].onPitch[sim.carrier]?.id === p.id && !proxy;
      const isSel = selRef.current === p.id && !proxy;

      ctx.save();
      ctx.globalAlpha = alpha;
      // shadow
      if (q !== 'low') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(px + r * 0.25, py + r * 0.35, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // selection / carrier rings
      if (isSel) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(1.5, 0.4 * s);
        ctx.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(now / 180));
        ctx.beginPath(); ctx.arc(px, py, r * 1.6, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      if (isCarrier) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 0.22 * s);
        ctx.setLineDash([0.6 * s, 0.4 * s]);
        ctx.beginPath(); ctx.arc(px, py, r * 1.35, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      // sprite-sheet path (no bundled assets yet -> procedural fallback below)
      const sheetKey = p.role === 'GK' ? `gk${ti}` : `team${ti}`;
      const spr = getSpriteFrame(sheetKey, anim, p.facing, now / 1000);
      if (spr) {
        const dw = r * 2.6;
        ctx.drawImage(spr.img, spr.frame.sx, spr.frame.sy, spr.frame.sw, spr.frame.sh, px - dw / 2, py - dw / 2, dw, dw);
      } else if (diving && p.role === 'GK') {
        // goalkeeper dive: stretched body toward the shot
        ctx.translate(px, py);
        ctx.rotate(p.diveDir >= 0 ? 0.5 : -0.5);
        ctx.fillStyle = kit;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(1, 0.35 * s);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.rotate(p.diveDir >= 0 ? -0.5 : 0.5);
        ctx.translate(-px, -py);
      } else {
        // direction wedge (clear facing) behind the body
        const fx = Math.cos(p.facing), fy = Math.sin(p.facing);
        const wedge = isCarrier ? 1.95 : 1.6;
        ctx.fillStyle = isCarrier ? '#ffffff' : kit;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = Math.max(0.8, 0.18 * s);
        ctx.beginPath();
        ctx.moveTo(px + fx * r * wedge, py + fy * r * wedge);
        ctx.lineTo(px + Math.cos(p.facing + 2.35) * r * 0.95, py + Math.sin(p.facing + 2.35) * r * 0.95);
        ctx.lineTo(px + Math.cos(p.facing - 2.35) * r * 0.95, py + Math.sin(p.facing - 2.35) * r * 0.95);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // body
        ctx.fillStyle = kit;
        ctx.strokeStyle = p.role === 'GK' ? '#facc15' : ti === 0 ? secRef.current : '#0b1220';
        ctx.lineWidth = Math.max(1, 0.35 * s);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (q === 'high') {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.35, r * 0.55, 0, Math.PI * 2); ctx.fill();
        }
        // kick motion for pass/shoot one-shots
        if (anim === 'pass' || anim === 'longpass' || anim === 'shoot') {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = Math.max(1, 0.2 * s);
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(p.facing) * r * 1.2, py + Math.sin(p.facing) * r * 1.2);
          ctx.lineTo(px + Math.cos(p.facing) * r * 2.1, py + Math.sin(p.facing) * r * 2.1);
          ctx.stroke();
        }
        // number
        ctx.fillStyle = kitText;
        ctx.font = `900 ${Math.max(7, 1.5 * s)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.num), px, py + r * 0.08);
      }
      // name label (all players on medium/high, user team on low) + fitness bar for the user's team
      if (!proxy && (q !== 'low' || ti === 0)) {
        const ln = p.name.split(' ').slice(-1)[0];
        const fs = Math.max(7, 1.35 * s);
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = Math.max(1.5, 0.4 * s);
        ctx.strokeText(ln, px, py + r * 1.25);
        ctx.fillStyle = ti === 0 ? '#ffffff' : 'rgba(255,255,255,0.82)';
        ctx.fillText(ln, px, py + r * 1.25);
        if (ti === 0) {
          const bw = 5.2 * s, bh = Math.max(1.5, 0.55 * s), bx = px - bw / 2, by = py + r * 1.25 + fs + 0.3 * s;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = p.fitness >= 70 ? '#22c55e' : p.fitness >= 55 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, p.fitness / 100)), bh);
        }
      }
      // markers
      if (!proxy) {
        if (ti === 0 && p.fitness < 55) {
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath(); ctx.arc(px + r * 0.85, py - r * 0.85, Math.max(1.5, 0.55 * s), 0, Math.PI * 2); ctx.fill();
        }
        if (p.yellow > 0) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(px + r * 0.6, py + r * 0.35, Math.max(2, 0.8 * s), Math.max(3, 1.1 * s));
        }
        if (injured) {
          ctx.fillStyle = '#ef4444';
          ctx.font = `900 ${Math.max(8, 1.7 * s)}px system-ui, sans-serif`;
          ctx.fillText('✚', px - r * 1.5, py - r * 0.7);
        }
      }
      ctx.restore();
    };

    const draw = () => {
      const now = performance.now();
      resize();
      const sim = getSimRef.current();
      if (sim !== lastSim.current) { lastSim.current = sim; subs.current.clear(); trail.current = []; } // new match: drop stale walk-ons
      const q = qRef.current;
      const s = S();
      ctx.drawImage(paintPitch(), 0, 0, W, H);
      if (!sim) return false;

      // Consume the substitution fx queue EXACTLY ONCE: each entry is spliced out of
      // sim.subFx as it starts, so an animation can never restart/loop and the
      // incoming player always ends up visible on the pitch.
      for (let i = sim.subFx.length - 1; i >= 0; i--) {
        const fx = sim.subFx[i];
        const key = `${fx.team}:${fx.inId}:${fx.startMin.toFixed(2)}`;
        if (!subs.current.has(key)) {
          subs.current.set(key, {
            key, team: fx.team, outNum: fx.outNum, outX: fx.outX, outY: fx.outY,
            inNum: fx.inNum, inId: fx.inId,
            exitY: fx.outY > 50 ? 104 : -4, born: now,
          });
        }
        sim.subFx.splice(i, 1);
      }
      const hidden = new Set<string>();
      const DUR = 1600; // walk-on duration (real ms) — snappy, not a long delay
      for (const [key, a] of [...subs.current]) {
        const t = (now - a.born) / DUR;
        if (t >= 1) { subs.current.delete(key); continue; } // proxy arrived -> real player takes over immediately
        hidden.add(a.inId);
      }

      // players (skip incoming players while their walk-on proxy plays)
      for (let ti = 0; ti < 2; ti++) {
        const t = sim.teams[ti as 0 | 1];
        for (const p of t.onPitch) {
          if (hidden.has(p.id)) continue;
          drawPlayer(p, t.kit, t.kitText, ti as 0 | 1, sim, now, q);
        }
      }

      // substitution proxies + board
      for (const [, a] of subs.current) {
        const t = (now - a.born) / DUR;
        if (t < 0 || t > 1.25) continue;
        const team = sim.teams[a.team];
        const live = team.onPitch.find((p) => p.id === a.inId);
        // outgoing: walk to the touchline and fade
        const ot = Math.min(1, t / 0.5);
        const oe = 1 - (1 - ot) * (1 - ot);
        const ox = a.outX + (50 - a.outX) * 0.15 * oe;
        const oy = a.outY + (a.exitY - a.outY) * oe;
        const oAlpha = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.2);
        if (oAlpha > 0) {
          const ghost = { ...team.onPitch[0], num: a.outNum, facing: a.exitY > 50 ? Math.PI / 2 : -Math.PI / 2 } as SimPlayer;
          drawPlayer(ghost, team.kit, team.kitText, a.team, sim, now, q, { x: ox, y: oy, alpha: oAlpha });
        }
        // incoming: enter from the nearest touchline point, converge to the live position
        if (live && t > 0.18) {
          const it = Math.min(1, (t - 0.18) / 0.82);
          const ie = 1 - (1 - it) * (1 - it);
          const sx = live.x, sy = a.exitY > 50 ? 101 : -1;
          const ix = sx + (live.x - sx) * ie;
          const iy = sy + (live.y - sy) * ie;
          const iAlpha = it >= 1 ? 0 : 1;
          if (iAlpha > 0) {
            const ghost = { ...live, num: a.inNum, facing: Math.atan2(live.y - iy || 0.01, live.x - ix || 0.01) } as SimPlayer;
            drawPlayer(ghost, team.kit, team.kitText, a.team, sim, now, q, { x: ix, y: iy, alpha: 1 });
          }
        }
        // substitution board near the touchline
        if (t < 0.62) {
          const bx = X(50), by = Y(a.exitY > 50 ? 97 : 3);
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          const bw = 13 * s, bh = 5 * s;
          ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1, 0.25 * s);
          ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
          ctx.font = `900 ${Math.max(7, 2.2 * s)}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f87171';
          ctx.fillText(String(a.outNum), bx - bw * 0.22, by);
          ctx.fillStyle = '#4ade80';
          ctx.fillText(String(a.inNum), bx + bw * 0.22, by);
          ctx.restore();
        }
      }

      // ball trail (high quality)
      const b = sim.ball;
      const bSpd = Math.hypot(b.vx, b.vy);
      if (q === 'high' && (b.state === 'flight' || bSpd > 30)) {
        trail.current.push({ x: b.x, y: b.y });
        if (trail.current.length > 9) trail.current.shift();
      } else if (trail.current.length) trail.current.shift();
      for (let i = 0; i < trail.current.length; i++) {
        const tp = trail.current[i];
        ctx.fillStyle = `rgba(255,255,255,${(i / trail.current.length) * 0.25})`;
        ctx.beginPath(); ctx.arc(X(tp.x), Y(tp.y), 0.7 * s * (i / trail.current.length), 0, Math.PI * 2); ctx.fill();
      }

      // ball shadow + ball (height shown as shadow separation)
      const hOff = b.h * s * 0.55;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(X(b.x) + 0.3 * s, Y(b.y) + 0.4 * s, 0.7 * s, 0.35 * s, 0, 0, Math.PI * 2); ctx.fill();
      const br = (0.75 + Math.min(0.35, b.h * 0.05)) * s;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = Math.max(0.75, 0.15 * s);
      ctx.beginPath(); ctx.arc(X(b.x) - hOff * 0.5, Y(b.y) - hOff * 0.5, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f2937';
      ctx.beginPath(); ctx.arc(X(b.x) - hOff * 0.5, Y(b.y) - hOff * 0.5, br * 0.35, 0, Math.PI * 2); ctx.fill();

      // celebration banner (scorer + countdown)
      if (sim.celebration) {
        const c = sim.celebration;
        const team = sim.teams[c.team];
        const bw = 34 * s, bh = 5.5 * s, bx = X(50) - bw / 2, by = Y(3);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = team.kit;
        ctx.fillRect(bx, by, 1.2 * s, bh);
        ctx.font = `900 ${Math.max(9, 2.6 * s)}px system-ui, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`⚽ ${c.scorerName.toUpperCase()}`, bx + 2.2 * s, by + bh / 2);
        ctx.font = `700 ${Math.max(8, 1.8 * s)}px system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(`${team.short} · selebrasi ${Math.max(0, Math.ceil(Math.min(10, c.dur) - c.t))}s`, bx + bw - 1.5 * s, by + bh / 2);
        ctx.restore();
      }
    };

    drawHandle.current = draw;

    const pick = (clientX: number, clientY: number) => {
      const sim = getSimRef.current();
      if (!sim) return;
      const r = canvas.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * 100;
      const y = ((clientY - r.top) / r.height) * 100;
      let bestTeam: 0 | 1 = 0, bestId = '', bestD = 5;
      for (let ti = 0; ti < 2; ti++) {
        const t = sim.teams[ti as 0 | 1];
        for (const p of t.onPitch) {
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) { bestTeam = ti as 0 | 1; bestId = p.id; bestD = d; }
        }
      }
      if (bestId) onSelectRef.current(bestTeam, bestId);
    };
    const onClick = (e: MouseEvent) => pick(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 1) { pick(e.touches[0].clientX, e.touches[0].clientY); }
    };
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: true });

    // initial paint (covers paused state)
    draw();

    return () => {
      ro.disconnect();
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouch);
      drawHandle.current = null;
      subs.current.clear();
      trail.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // repaint on quality change while paused
  useEffect(() => { drawHandle.current?.(); }, [quality, drawHandle]);

  return (
    <div ref={wrapRef} className="relative block w-full select-none" style={{ aspectRatio: '105 / 68' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-pointer" />
    </div>
  );
}
