// Redes y prensa escrita (DISEÑO §11.4): quién publica, sobre qué, con qué tono y cuánto se
// difunde lo decide el motor según el perfil y la memoria de cada uno; la UI solo redacta.
// Nada de lo publicado lleva rasgos ocultos: solo nombres, claves y recuentos visibles.

import { ARTICLE_GAP, ARTICLE_MIN_HEAT, FAN_MOOD, POSITIVE_NARRATIVES } from "../config/media";
import { managerOf } from "../social/store";
import type { Match, World } from "../types/domain";
import type { ClubId, GameDay, PlayerId } from "../types/ids";
import type { Controversy, Post } from "../types/media";
import { clamp, round } from "../util/math";
import { worldRng } from "../world/rng";
import { journalistsOf } from "./journalists";
import { activeNarratives } from "./narratives";
import { refereeMemory } from "./referees";
import { publish, reachOf, relationOf } from "./state";

/** Artículo diario sobre la narrativa más caliente de cada club dirigido por un humano. */
export function dailyArticles(world: World, day: GameDay): void {
  for (const club of Object.keys(world.dressing).sort() as ClubId[]) {
    const mgr = managerOf(world, club);
    const top = activeNarratives(world, club).find((n) => n.heat >= ARTICLE_MIN_HEAT);
    if (!top || !mgr) continue;
    const recent = world.media.posts.some((p) => p.key.startsWith("post.article.") && p.params.narrative === top.id && day - p.day < ARTICLE_GAP);
    if (recent) continue;
    const journalists = journalistsOf(world, world.clubs[club]!.nation);
    if (!journalists.length) continue;
    const rng = worldRng(world).fork(`media/article/${club}/${day}`);
    const j = rng.pick(journalists);
    // El tono: la noticia en sí, la afinidad del medio con el club y su relación con el mánager.
    let sentiment: -1 | 0 | 1 = POSITIVE_NARRATIVES.includes(top.kind) ? 1 : -1;
    if (sentiment < 0 && j.favours === club) sentiment = 0;
    else if (sentiment > 0 && relationOf(world, j.id, mgr.id) < -0.3) sentiment = 0;
    const score = j.reach * 0.5 + top.heat * 0.35 + j.sensationalism * 0.25;
    publish(world, {
      day, platform: j.outlet === "forum" ? "fanForum" : j.outlet === "newspaper" ? "newspaper" : "radioTv",
      author: { kind: "journalist", id: j.id }, key: `post.article.${top.kind}`,
      params: { narrative: top.id, ...(top.count !== undefined ? { n: top.count } : {}) }, subjects: [top.subject], sentiment,
      reach: reachOf(score), club,
    });
  }
}

const SEGMENTS = ["ultras", "members", "casual", "international"] as const;

/**
 * La afición reacciona al partido: cambia su ánimo por segmentos (los ultras viven el resultado
 * y el arbitraje con más intensidad) y lo cuenta en el foro y en redes.
 */
export function fansAfterMatch(world: World, m: Match, club: ClubId, controversies: Controversy[], day: GameDay): void {
  const c = world.clubs[club];
  if (!c || !m.result) return;
  const home = m.home === club;
  const side = home ? 0 : 1;
  const [gf, ga] = home ? [m.result.home, m.result.away] : [m.result.away, m.result.home];
  const res = gf > ga ? "win" : gf < ga ? "loss" : "draw";
  // Robo: una decisión que nos perjudicó y que las imágenes no respaldan (o era muy ajustada).
  const robbed = res !== "win" && controversies.some((x) => x.harmed === side && (!x.correct || x.clarity === "marginal"));
  for (const seg of SEGMENTS) {
    const k = seg === "ultras" ? 1.5 : seg === "international" ? 0.5 : 1;
    const delta = (FAN_MOOD[res] + (robbed ? FAN_MOOD.robbed : 0)) * k;
    c.fanBase[seg].mood = round(clamp(c.fanBase[seg].mood + delta, -1, 1), 3);
  }
  const segment = robbed || res === "loss" ? "ultras" : res === "win" ? "members" : "casual";
  const referee = m.referee;
  // Un árbitro que ya les perjudicó antes multiplica el enfado.
  const history = referee ? refereeMemory(world, referee, club).harmed : 0;
  const score = 0.3 + (robbed ? 0.3 : 0) + Math.min(0.3, 0.1 * history) + (res === "loss" ? 0.1 : 0);
  const post: Omit<Post, "id"> = {
    day, platform: robbed ? "shortMessages" : "fanForum", author: { kind: "fans", club, segment },
    key: `post.fans.${robbed ? "robbed" : res}`, params: {},
    subjects: robbed && referee ? [{ kind: "referee", id: referee }, { kind: "match", id: m.id }] : [{ kind: "match", id: m.id }],
    sentiment: res === "win" && !robbed ? 1 : res === "draw" && !robbed ? 0 : -1, reach: reachOf(score), club,
  };
  publish(world, post);
}

/** Publicaciones de jugadores que el ego lleva a las redes o a la prensa (indirectas y entrevistas). */
export function playerPostsFromEvents(world: World, from: number, to: number): void {
  for (let i = from; i < to; i++) {
    const e = world.events[i]!;
    if (e.type !== "player.egoStep") continue;
    const channel = e.data.channel;
    if (channel !== "social" && channel !== "public") continue;
    const p = world.players[e.data.player as string];
    const club = p?.clubId;
    if (!p || !club || !world.dressing[club]) continue;
    const mgr = managerOf(world, club);
    publish(world, {
      day: e.day, platform: channel === "social" ? "shortMessages" : "newspaper", author: { kind: "player", id: p.id as PlayerId },
      key: `post.player.${channel === "social" ? "indirect" : "interview"}.${String(e.data.dynamic)}`, params: {},
      subjects: mgr ? [{ kind: "manager", id: mgr.id }] : [{ kind: "club", id: club }], sentiment: -1,
      reach: reachOf(0.25 + p.reputation * 0.5 + (channel === "public" ? 0.2 : 0)), club,
    });
  }
}
