import type { MatchChange, MatchEvent } from "@tf/core";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import type { WatchedMatch } from "../protocol";
import { LivePanel } from "./LivePanel";

const SPEEDS = [4, 8, 16, 32, 64];
const W = 105;
const H = 68;

/** Índice del último fotograma con tiempo ≤ t (búsqueda binaria). */
function frameAt(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function drawPitch(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = "#2f7d3b";
  ctx.fillRect(0, 0, W * s, H * s);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = Math.max(1, s * 0.15);
  ctx.strokeRect(0.5, 0.5, W * s - 1, H * s - 1);
  ctx.beginPath();
  ctx.moveTo((W / 2) * s, 0);
  ctx.lineTo((W / 2) * s, H * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc((W / 2) * s, (H / 2) * s, 9.15 * s, 0, Math.PI * 2);
  ctx.stroke();
  for (const x of [0, W - 16.5]) ctx.strokeRect(x * s, (H / 2 - 20.15) * s, 16.5 * s, 40.3 * s);
  for (const x of [0, W - 5.5]) ctx.strokeRect(x * s, (H / 2 - 9.15) * s, 5.5 * s, 18.3 * s);
}

/** Eventos en los que el directo se pausa solo: descanso y antes de la prórroga. */
const AUTO_PAUSE = new Set(["halfTime", "extraTime"]);

export function MatchViewer({
  m, onIntervene, onFinish,
}: {
  m: WatchedMatch;
  onIntervene?: (step: number, side: 0 | 1, change: MatchChange) => Promise<string | null>;
  onFinish?: () => void;
}) {
  const { t, team } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(16);
  const lastIdx = useRef(0);
  const f = m.report.frames;
  const end = f ? f.t[f.t.length - 1]! : 0;

  useEffect(() => {
    if (!playing || !f) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((x) => {
        const n = Math.min(end, x + dt * speed);
        if (n >= end) setPlaying(false);
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, f, end]);

  const idx = f ? frameAt(f.t, time) : 0;

  // En directo, el partido se para solo en el descanso (y antes de la prórroga) para hacer cambios.
  useEffect(() => {
    if (!f || !m.live) return;
    for (let i = lastIdx.current + 1; i <= idx; i++) {
      const e = f.event[i]!;
      if (e >= 0 && AUTO_PAUSE.has(m.report.events[e]!.type)) {
        lastIdx.current = i;
        setTime(f.t[i]!);
        setPlaying(false);
        return;
      }
    }
    lastIdx.current = idx;
  }, [idx, f, m.live, m.report.events]);
  const shown: MatchEvent[] = f ? m.report.events.slice(0, f.evCount[idx]) : m.report.events;
  const score = [0, 0];
  for (const e of shown) if (e.type === "goal" || e.type === "ownGoal") score[e.side]!++;

  /** Dorsal: orden en la convocatoria (1–11 titulares, 12+ suplentes). */
  const roster = (side: number) => f?.rosters.filter((r) => r.side === side && r.at <= idx).at(-1)?.ids ?? [];
  const shirt = (side: number, slot: number) => {
    const id = roster(side)[slot];
    const k = id ? m.squads[side]!.findIndex((p) => p.id === id) : -1;
    return k >= 0 ? k + 1 : slot + 1;
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c || !f) return;
    const ctx = c.getContext("2d")!;
    const s = c.width / W;
    drawPitch(ctx, s);
    const j = Math.min(idx + 1, f.t.length - 1);
    const span = f.t[j]! - f.t[idx]!;
    const a = span > 0 ? Math.min(1, (time - f.t[idx]!) / span) : 0;
    const lerp = (arr: number[], k: number) => {
      const v0 = arr[idx * (arr === f.ball ? 2 : 44) + k]!;
      const v1 = arr[j * (arr === f.ball ? 2 : 44) + k]!;
      return v0 < 0 || v1 < 0 ? v0 : v0 + (v1 - v0) * a;
    };
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 11; i++) {
        const x = lerp(f.pos, side * 22 + i * 2);
        const y = lerp(f.pos, side * 22 + i * 2 + 1);
        if (x < 0) continue;
        ctx.beginPath();
        ctx.fillStyle = i === 0 ? "#111" : m.colors[side]!;
        ctx.strokeStyle = "#fff";
        ctx.arc(x * W * s, y * H * s, 1.4 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.round(1.6 * s)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(shirt(side, i)), x * W * s, y * H * s);
      }
    }
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.arc(lerp(f.ball, 0) * W * s, lerp(f.ball, 1) * H * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [time, idx, f, m.colors, m.squads]);

  const clock = f ? f.clock[idx]! : 0;
  const label = (e: MatchEvent) => {
    const params = { player: e.player ? m.names[e.player] ?? "" : "", other: e.other ? m.names[e.other] ?? "" : "" };
    if (e.type === "tactical") {
      const who = team(e.side === 0 ? m.fixture.home : m.fixture.away);
      const d = e.detail ?? "style";
      return `${t("event.tactical", { team: who })}: ${["response", "instructions", "style"].includes(d) ? t(`tacticalDetail.${d}`) : d}`;
    }
    let text = t(`event.${e.type}`, params);
    if (e.type === "goal" && e.detail && e.detail !== "open") text += ` (${t(`goalKind.${e.detail}`)})`;
    return text;
  };
  const sides = [m.fixture.home, m.fixture.away];
  const st = m.report.stats;
  const finished = !f || time >= end;
  const pct = (a: number, b: number) => Math.round((100 * a) / Math.max(1, a + b));

  return (
    <div className="viewer">
      <div className="scoreboard">
        <span style={{ borderColor: m.colors[0] }}>{team(m.fixture.home)}</span>
        <strong>{score[0]} – {score[1]}</strong>
        <span style={{ borderColor: m.colors[1] }}>{team(m.fixture.away)}</span>
        {f && <em>{Math.floor(clock / 60)}'</em>}
        {finished && m.report.pens && <em>({m.report.pens[0]}–{m.report.pens[1]} p.)</em>}
      </div>
      {f ? (
        <>
          <canvas ref={canvas} width={840} height={544} />
          <div className="row">
            {m.live && <strong className="live-badge">● {t("match.live")}</strong>}
            {!finished && <button onClick={() => setPlaying(!playing)}>{playing ? t("match.pause") : t("match.play")}</button>}
            {!m.live && <button onClick={() => { setTime(0); setPlaying(true); lastIdx.current = 0; }}>{t("match.replay")}</button>}
            {/* En directo no se puede adelantar: solo se ve lo que ya se ha jugado. */}
            {!m.live && <input type="range" min={0} max={end} step={1} value={time} onChange={(e) => setTime(Number(e.target.value))} />}
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((x) => <option key={x} value={x}>{t("match.speed", { n: x })}</option>)}
            </select>
            {m.live && finished && onFinish && <button className="primary" onClick={onFinish}>{t("match.finish")}</button>}
          </div>
          {m.live && !playing && !finished && m.side !== null && onIntervene && (
            <LivePanel
              m={m}
              side={m.side}
              step={f.step[idx]!}
              onField={roster(m.side).filter((x) => x !== null).map(String)}
              used={new Set(f.rosters.filter((r) => r.side === m.side && r.at <= idx).flatMap((r) => r.ids.filter((x) => x !== null).map(String)))}
              subsMade={shown.filter((e) => e.type === "sub" && e.side === m.side).length}
              onIntervene={onIntervene}
            />
          )}
        </>
      ) : (
        <p className="hint">{t("match.engineQuick")}</p>
      )}
      <div className="viewer-bottom">
        <ol className="log">
          {shown
            .filter((e) => e.type !== "foul" && e.type !== "kickoff")
            .slice()
            .reverse()
            .map((e, k) => (
              <li key={k} className={`ev-${e.type} side-${e.side}`}>
                <span className="min">{e.added ? `${e.minute}+${e.added}'` : `${e.minute}'`}</span> {label(e)}
              </li>
            ))}
        </ol>
        {finished && m.engine === "full" && (
          <div>
            <table className="grid stats">
              <tbody>
                {([
                  ["match.possession", `${pct(st[0].possession, st[1].possession)}%`, `${pct(st[1].possession, st[0].possession)}%`],
                  ["match.shots", st[0].shots, st[1].shots],
                  ["match.onTarget", st[0].onTarget, st[1].onTarget],
                  ["match.xg", st[0].xg.toFixed(2), st[1].xg.toFixed(2)],
                  ["match.corners", st[0].corners, st[1].corners],
                  ["match.fouls", st[0].fouls, st[1].fouls],
                  ["match.cards", `${st[0].yellow}/${st[0].red}`, `${st[1].yellow}/${st[1].red}`],
                ] as const).map(([k, a, b]) => (
                  <tr key={k}>
                    <td>{a}</td>
                    <th>{t(k)}</th>
                    <td>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {m.report.instructions.length > 0 && (
              <>
                <h4>{t("match.instructions")}</h4>
                <ul className="instructions">
                  {m.report.instructions.map((o, k) => (
                    <li key={k} className={o.followed ? "ok" : "bad"}>
                      {team(sides[m.report.players.find((p) => p.id === o.player)?.side ?? 0]!)} · {m.names[o.player] ?? o.player} ·{" "}
                      {t(`instruction.${o.key}`)}: {t(o.followed ? "match.followed" : "match.ignored")}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
