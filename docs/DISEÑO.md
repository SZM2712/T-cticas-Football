# Tactical Football — Documento de diseño técnico

> Versión 0.1 · Plan inicial previo a escribir código.
> Fuente: el documento de visión original (secciones 1–14). Aquí se convierte en arquitectura, modelo de datos, algoritmos y plan de fases.
> Decisiones de producto: §9. Alcance del mundo v1: §8.

---

## 1. Visión en una frase

Un mánager de fútbol donde los números importan pero las personas importan más: cada decisión (una suplencia, una frase en prensa, un fichaje con más salario que el líder) deja una huella que el mundo recuerda y a la que reacciona según la personalidad de cada actor.

Pilares que guían todas las decisiones técnicas:

1. **Memoria** — los actores recuerdan (memoria episódica con decaimiento por rasgos).
2. **Coherencia** — lo que dices se registra (declaraciones, `Commitment`s) y se contrasta con lo que haces.
3. **Incertidumbre honesta** — el potencial es un proceso estocástico, no un número escondido.
4. **Explicabilidad** — todo número importante tiene un desglose "¿por qué?".
5. **Determinismo** — reproducible con semilla para depurar y balancear.

---

## 2. Arquitectura

### 2.1 Capas

```
┌────────────────────────── apps/web (React + Vite, PWA) ──────────────────────────┐
│  pantallas · paneles · mapa del vestuario · bandeja · i18n · accesibilidad       │
│        │ Command (intención del usuario)          ▲ View (proyección solo lectura)│
└────────┼──────────────────────────────────────────┼──────────────────────────────┘
         ▼               postMessage (Comlink)       │
┌──────────────────────── Web Worker: GameHost ─────────────────────────────────────┐
│  packages/core  (TS puro, determinista)                                           │
│   commands → validate → systems(tick) → WorldEvent[] → reducer → World            │
│   views/  (selectores puros que construyen las proyecciones con "¿por qué?")      │
│   ports/  DialogueProvider · Clock · (nada de IO directo)                          │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                   ▼
          apps/web/persistence (Dexie)  ·  tools/sim (Node)  ·  tools/assets (Node)
```

- **World** es un objeto plano serializable. Nunca se muta desde fuera del reductor.
- **Systems** son funciones puras `(world, rng, ctx) => WorldEvent[]`. Se ejecutan en orden fijo dentro de un `tick` diario.
- **Reducer** aplica eventos al mundo. Los eventos también alimentan memoria episódica, narrativas y la bandeja de entrada → un solo camino para "consecuencias".
- **Event log**: los `WorldEvent` relevantes se conservan (con poda por antigüedad e importancia) para depuración, narrativas y prensa ("te recuerdo que en marzo dijiste…").

### 2.2 Nivel de detalle (LOD) — clave para el rendimiento

Simular el grafo social y la memoria completa de 3.000+ jugadores cada día no cabe en 200 ms en móvil. Por eso:

| LOD | A quién | Qué se simula |
|---|---|---|
| **Completo** | Club del usuario (+ rivales directos en semanas de partido) | Grafo social diario, memoria episódica completa, dinámicas de ego, conversaciones |
| **Medio** | Clubes de la misma liga | Moral/felicidad agregadas, grafo semanal simplificado, eventos de ego solo de alto impacto (que salen en prensa) |
| **Ligero** | Resto del mundo | Desarrollo mensual, moral escalar, partidos con motor rápido (modelo estadístico calibrado contra el motor completo) |

Un club sube de LOD cuando el usuario interactúa con él (ofertas, ojeo intenso, partido). Promover de ligero a completo **regenera de forma determinista** el detalle faltante a partir de los agregados (con su propio stream de RNG).

### 2.3 Estructura de carpetas

```
/
├── CLAUDE.md
├── docs/
│   ├── DISEÑO.md            (este archivo)
│   ├── CHANGELOG.md         (resumen al cerrar cada fase)
│   └── balance/             (informes de simulación exportados)
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── rng/          xoshiro128**, splitmix32, streams nombrados, distribuciones
│   │       ├── types/        tipos del dominio (ver §3)
│   │       ├── config/       diales de balance (constantes documentadas)
│   │       ├── time/         GameDay, calendario, temporadas, ventanas de fichajes
│   │       ├── world/        World, ids, reducer, eventos, serialización, hash
│   │       ├── gen/          generación de mundo (naciones, ligas, clubes, jugadores, staff)
│   │       ├── competition/  fixtures (Berger), tablas, ascensos, copas
│   │       ├── match/        motor de partido (Fase 2)
│   │       ├── development/  techo latente, crecimiento, entrenamiento, ojeo (Fase 3)
│   │       ├── psyche/       perfil, estado emocional, memoria episódica (Fase 4)
│   │       ├── social/       grafo, camarillas, jerarquía, dinámicas de ego (Fase 4)
│   │       ├── commitments/  promesas rastreables (Fase 4)
│   │       ├── media/        narrativas, periodistas, prensa, árbitros (Fase 5)
│   │       ├── economy/      finanzas, mercado, IA de clubes, directiva, afición (Fase 6)
│   │       ├── manager/      carrera del mánager (Fase 6–7)
│   │       ├── dialogue/     DialogueIntent, plantillas, gramática procedural (Fase 5/8)
│   │       ├── views/        proyecciones para UI con desgloses "¿por qué?"
│   │       ├── commands/     comandos del usuario y validación
│   │       └── engine/       GameHost: tick diario, orden de sistemas, LOD
│   ├── data/                 listas de nombres, ciudades, idiomas, plantillas de texto (ficticio)
│   └── ui-kit/               (Fase 7) componentes accesibles y tokens de diseño
├── apps/
│   └── web/                  React + Vite + PWA + Dexie + Worker
└── tools/
    ├── sim/                  CLI de simulación masiva y tests de balance
    ├── gen/                  CLI de generación de mundo (Fase 1)
    └── assets/               prompts de imagen, caché, retratos SVG de respaldo (Fase 8)
```

### 2.4 RNG

- `xoshiro128**` (estado 128 bits, rápido en JS con enteros de 32 bits) sembrado con `splitmix32`.
- **Streams por subsistema derivados por nombre**: `root.fork("gen/players")`, `root.fork("match/" + matchId)`, `root.fork("dev/" + season + "/" + month)`.
  La derivación hashea `(seedRaíz, ruta)` → añadir tiradas en un subsistema no desplaza las de otro, y un partido concreto se puede repetir aislado.
- Distribuciones en `rng/dist.ts`: uniforme, normal (Box-Muller con caché), truncada, beta, log-normal, poisson, elección ponderada, barajado Fisher-Yates, **normal multivariante (Cholesky)** para rasgos correlacionados.
- El estado de cada stream persistente se guarda en el save para reanudar exactamente.

### 2.5 Persistencia y guardados

- Save = `{ saveVersion, worldHash, world (comprimido), rngStates, eventLog }` en IndexedDB (Dexie).
- Serialización con MessagePack + compresión (fflate) → los rasgos ocultos no son legibles en texto plano (no es seguridad, es evitar la lectura trivial que pide §13).
- Migraciones `v(n) → v(n+1)` encadenadas, cada una con test que carga un save fixture de la versión anterior.
- Autoguardado rotativo (3 ranuras) + guardado manual.

---

## 3. Modelo de datos (tipos principales)

> Borrador para la Fase 1. Se refinará, pero la forma general es vinculante: datos planos, IDs como strings con tipo nominal, nada de referencias de objeto.

```ts
// ── Identificadores nominales ─────────────────────────────────────────────
type Brand<T, B extends string> = T & { readonly __brand: B };
export type PlayerId = Brand<string, "PlayerId">;
export type ClubId = Brand<string, "ClubId">;
export type StaffId = Brand<string, "StaffId">;
export type MatchId = Brand<string, "MatchId">;
export type MemoryId = Brand<string, "MemoryId">;
export type CommitmentId = Brand<string, "CommitmentId">;
export type NarrativeId = Brand<string, "NarrativeId">;
export type JournalistId = Brand<string, "JournalistId">;
export type ActorRef =
  | { kind: "player"; id: PlayerId }
  | { kind: "staff"; id: StaffId }
  | { kind: "manager" }
  | { kind: "club"; id: ClubId }
  | { kind: "journalist"; id: JournalistId }
  | { kind: "agent"; id: string }
  | { kind: "fans"; clubId: ClubId; segment: FanSegment };

export type GameDay = Brand<number, "GameDay">; // días desde el inicio del mundo
export type Unit = number;   // 0..1
export type Signed = number; // -1..1
export type Attr = number;   // 1..20 float

// ── Jugador ───────────────────────────────────────────────────────────────
export interface Player {
  id: PlayerId;
  identity: {
    firstName: string; lastName: string; knownAs?: string;
    birthDay: GameDay; nationality: NationId; secondNationality?: NationId;
    languages: { lang: LanguageId; fluency: Unit }[];
    hometown: CityId;
    appearance: AppearanceCanon;          // descripción canónica (retratos, §10)
    foot: { left: Attr; right: Attr };
    heightCm: number; weightKg: number;
  };
  positions: Partial<Record<Position, Unit>>;  // familiaridad por posición
  attributes: {
    technical: Record<TechnicalAttr, Attr>;
    mental: Record<MentalAttr, Attr>;
    physical: Record<PhysicalAttr, Attr>;
    goalkeeping: Record<GoalkeepingAttr, Attr>;
  };
  hidden: HiddenAttributes;               // nunca se muestran como número
  psych: PsychProfile;                    // cambia lento (meses/años)
  state: EmotionalState;                  // cambia rápido (días)
  development: DevelopmentState;          // techo latente y maduración (§4)
  contract: Contract | null;
  clubId: ClubId | null;
  agentId: string | null;
  condition: { fitness: Unit; sharpness: Unit; injury: Injury | null; injuryHistory: InjuryRecord[] };
  personalLife: PersonalLife;
  careerHistory: CareerSpell[];
  memoryIds: MemoryId[];                  // índice a su memoria episódica
}

export interface HiddenAttributes {
  consistency: Attr; bigMatches: Attr; injuryProneness: Attr; versatility: Attr;
  sportsmanship: Attr; adaptability: Attr; pressure: Attr; professionalism: Attr;
  ambition: Attr; loyalty: Attr; temperament: Attr; controversy: Attr;
}
// Nota: varios ocultos se DERIVAN de PsychProfile en la generación (correlación fuerte)
// y luego divergen poco a poco por experiencia. Ver §3.1.

// ── Perfil psicológico (0..1, generado con correlaciones) ─────────────────
export interface PsychProfile {
  ego: Unit;
  recognitionNeed: Unit;
  insecurity: Unit;
  competitiveness: Unit;
  loyalty: Unit;
  ambition: Unit;
  professionalism: Unit;
  temperament: Unit;        // alto = volátil
  sociability: Unit;
  influence: Unit;
  growthMindset: Unit;
  offPitchLife: Unit;       // riesgo de polémicas/distracciones/redes
  // derivados (no persistidos, calculados en views/psyche):
  // archetype: Archetype — etiqueta legible, nunca determina comportamiento
}

// ── Estado emocional dinámico ─────────────────────────────────────────────
export interface EmotionalState {
  morale: Signed;
  confidence: { attack: Signed; defence: Signed; passing: Signed; general: Signed };
  happiness: Signed;                // felicidad en el club
  mentalFatigue: Unit;
  statusGap: Signed;                // percibido − merecido (negativo = agraviado)
  perceivedStatus: SquadStatus;     // cómo cree que lo tratas
  expectedStatus: SquadStatus;      // cómo cree que debería tratarse
  tensions: Record<string, Unit>;   // acumuladores por dinámica de ego (§5.4)
  lastUpdated: GameDay;
}

// ── Memoria episódica ─────────────────────────────────────────────────────
export interface Memory {
  id: MemoryId;
  owner: ActorRef;                  // quién recuerda
  about: ActorRef[];                // de quién/qué trata
  kind: MemoryKind;                 // "publicPraise" | "publicCriticism" | "benched" | "subbedOff" |
                                    // "promiseKept" | "promiseBroken" | "salaryInsult" | "captaincyRemoved" |
                                    // "goalDedicated" | "trainingFight" | "witnessedBrokenPromise" | ...
  day: GameDay;
  valence: Signed;                  // positiva/negativa para el dueño
  intensity: Unit;                  // intensidad inicial
  publicness: "private" | "squad" | "public";
  halfLifeDays: number;             // calculado al crear con los rasgos del dueño
  sourceEventId: string;            // trazabilidad hacia el WorldEvent
  tags: string[];                   // para que prensa/narrativas lo encuentren
}
// salience(t) = intensity * 0.5^((t - day)/halfLifeDays)
// halfLife = base(kind) * f(ego, recognitionNeed, temperament, loyalty) * publicnessMult
// Ej.: humillación pública + ego 0.9 → semivida de años; elogio privado + ego bajo → semanas.
// Poda: memorias con salience < 0.02 se compactan en un "rastro" agregado por (owner, about, kind).

// ── Relación (arista del grafo social) ────────────────────────────────────
export interface Relationship {
  a: ActorRef; b: ActorRef;         // no dirigida entre jugadores; dirigida jugador→mánager
  affinity: Signed;                 // me cae bien
  respect: Unit;                    // valoro su nivel/profesionalidad
  rivalry: Unit;                    // compito con él (puede ser sana)
  envy: Unit;                       // resentimiento por estatus/salario
  trust: Signed;                    // solo jugador→mánager: ¿cumple su palabra?
  sinceDay: GameDay;
  lastInteractionDay: GameDay;
  keyMemoryIds: MemoryId[];         // las 5 memorias que más pesan en esta relación
}
// valencia mostrada = affinity*0.5 + respect*0.25 − envy*0.35 − max(0, rivalry − respect)*0.2 (clamp −1..1)

// ── Promesa rastreable (nombre `Commitment` porque `Promise` es global en JS) ─
export interface Commitment {
  id: CommitmentId;
  madeBy: { kind: "manager" } | { kind: "club"; id: ClubId };
  madeTo: ActorRef[];               // a quién se le prometió
  witnesses: "private" | "squad" | "public";  // quién se entera si se rompe
  origin: { kind: "press" | "conversation" | "contract" | "transferPitch"; refId: string; quote: string };
  type: CommitmentType;             // "playingTime" | "mentor" | "noSale" | "signPlayer" | "role" |
                                    // "captaincy" | "newContract" | "youthChances" | "trophyTarget" | ...
  params: Record<string, string | number>;    // p. ej. { minStartsPct: 0.5, mentorId, menteeId }
  deadline: GameDay;
  metric: CommitmentMetric;         // cómo se mide (consulta pura sobre el World)
  progress: Unit;                   // recalculado cada tick relevante
  status: "active" | "atRisk" | "kept" | "broken" | "renegotiated" | "void";
  createdDay: GameDay;
  linkedActions: string[];          // acciones habilitadas (p. ej. "assignMentor:pl_1:pl_2")
}

// ── Club ─────────────────────────────────────────────────────────────────
export interface Club {
  id: ClubId;
  name: string; shortName: string; founded: number;
  cityId: CityId; nationId: NationId; leagueId: LeagueId;
  colors: { primary: string; secondary: string; accent?: string };
  crest: CrestSpec;                 // parámetros para escudo SVG/IA
  reputation: { local: Unit; national: Unit; continental: Unit };
  identity: ClubIdentity;           // filosofía: cantera, estilo, "club vendedor", etc.
  culture: { languages: LanguageId[]; climate: Climate; cityAppeal: Unit };
  stadium: Stadium; facilities: { training: Unit; youth: Unit; medical: Unit };
  finances: Finances;
  board: BoardMember[];
  fanBase: Record<FanSegment, { size: number; mood: Signed; values: FanValues }>;
  squad: PlayerId[]; staff: StaffId[];
  youthIntakeDay: GameDay;
  lod: "full" | "medium" | "light";
}

// ── Partido ──────────────────────────────────────────────────────────────
export interface Match {
  id: MatchId;
  competitionId: CompetitionId; round: number; day: GameDay;
  home: ClubId; away: ClubId; venue: StadiumId;
  refereeId: StaffId;
  status: "scheduled" | "played" | "postponed";
  lineups?: { home: Lineup; away: Lineup };
  tactics?: { home: TacticSnapshot; away: TacticSnapshot };
  result?: { home: number; away: number; et?: [number, number]; pens?: [number, number] };
  events?: MatchEvent[];           // goles, tarjetas, cambios, lesiones, VAR, polémicas, gestos
  ratings?: Record<PlayerId, number>;
  controversies?: Controversy[];    // decisiones arbitrales discutibles (con evidencia del motor)
  seedPath: string;                // ruta del stream RNG → partido reproducible
}

// ── Narrativa (tablero vivo para prensa y redes) ──────────────────────────
export interface Narrative {
  id: NarrativeId;
  kind: NarrativeKind;              // "winningStreak" | "crisis" | "rumour" | "feud" | "exPlayerReturn" |
                                    // "record" | "refereeingRow" | "brokenPromise" | "redemption" | ...
  subjects: ActorRef[];
  heat: Unit;                       // relevancia actual (sube con eventos, decae con el tiempo)
  stance: Record<JournalistId, Signed>;  // cómo la cuenta cada medio
  facts: string[];                  // ids de WorldEvent que la sostienen
  openedDay: GameDay; lastFedDay: GameDay;
  questionsAsked: { day: GameDay; templateId: string; journalistId: JournalistId }[]; // anti-repetición
  resolution?: { day: GameDay; outcome: string };
}

// ── Mundo ────────────────────────────────────────────────────────────────
export interface World {
  meta: { saveVersion: number; seed: string; today: GameDay; season: number; createdWith: string };
  nations: Record<NationId, Nation>;
  leagues: Record<LeagueId, League>;
  competitions: Record<CompetitionId, Competition>;
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  staff: Record<StaffId, Staff>;
  matches: Record<MatchId, Match>;
  calendar: CalendarEntry[];        // ordenado por día
  relationships: RelationshipStore; // índice por par canónico "idA|idB"
  memories: Record<MemoryId, Memory>;
  commitments: Record<CommitmentId, Commitment>;
  narratives: Record<NarrativeId, Narrative>;
  manager: Manager;
  inbox: InboxItem[];
  idCounters: Record<string, number>;
}
```

### 3.1 Generación correlacionada de rasgos

Los 12 rasgos psicológicos se generan con una **normal multivariante** (matriz de correlación en `config/psych.ts`, descompuesta por Cholesky) y se pasan a 0..1 con la CDF normal (cópula gaussiana). Correlaciones de partida (a calibrar):

| | ego | recon. | inseg. | compet. | lealtad | ambición | prof. | temper. | sociab. | influ. | crecim. | extradep. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ego | 1 | .55 | −.10 | .40 | −.30 | .45 | −.05 | .30 | .00 | .20 | −.15 | .35 |
| profesionalismo | | | −.15 | .20 | .15 | .10 | 1 | −.30 | .00 | .15 | .50 | −.45 |
| sociabilidad | | | −.20 | | .15 | | | −.10 | 1 | .45 | | .25 |

Además se modulan por edad (jóvenes: más inseguridad, menos influencia) y por **arquetipo semilla** opcional (el 15 % de jugadores se genera "con intención" para garantizar Divas, Hijos del club, Veteranos mentores… en cada liga y que el vestuario tenga historias desde el día 1).

El **arquetipo mostrado** se calcula por distancia a prototipos en el espacio de rasgos (el más cercano, con "matices" si hay un segundo cercano). Es descriptivo; ningún sistema lee el arquetipo.

---

## 4. Techo latente y desarrollo

### 4.1 Modelo

Separamos tres cosas que en FM están fusionadas:

1. **Capacidad actual** `CA` — derivada de los atributos (media ponderada por posición natural, escala 1–20). No se guarda: se calcula.
2. **Techo latente real** `L(t)` — proceso estocástico oculto por jugador: `L(t) ~ deriva(entorno) + ruido(edad)`. **No existe un PA fijo**: el futuro de `L` depende de decisiones aún no tomadas y de tiradas aún no realizadas, así que ni leyendo el save se conoce el techo final.
3. **Estimaciones** — cada ojeador/entrenador mantiene su propia creencia `(μ̂, σ̂)` sobre `L`, que actualiza con observaciones ruidosas. Eso es lo que ve el usuario.

```ts
export interface DevelopmentState {
  latentCeiling: number;          // L(t), escala CA (1..20), oculto
  volatility: number;             // σ del proceso, decrece con la edad
  maturation: "early" | "standard" | "late";  // oculto; se intuye por historial
  maturationShift: number;        // años de desplazamiento de la curva (−2..+3)
  physicalPeakAge: number;        // ~N(27, 1.5)
  shape: AttributeShape;          // en qué atributos tiende a crecer (talento natural)
  recentFactors: DevFactor[];     // para el informe "¿por qué creció/estancó?"
  history: { day: GameDay; ca: number; L: number }[];  // muestreo mensual para gráficas (L solo para debug)
}
```

### 4.2 Pseudocódigo (tick mensual, en el stream `dev/<season>/<month>`)

```
para cada jugador p (LOD ligero: igual, pero agregado; es barato):
  edad ← edad(p, hoy)
  env  ← entornoDeDesarrollo(p)            # 0..1 por factor, con desglose
         = { minutos:     minutosCompetitivosPonderados(p, últimos 90 días, nivelLiga vs CA),
             entrenamiento: calidadEntrenadores(club, foco) * instalaciones.training,
             individual:  ajusteEntrenamientoIndividual(p),
             mentor:      efectoMentor(p),          # §4.4, puede ser negativo
             encaje:      encajeGlobal(p),           # §5.5
             estabilidad: 1 − estrésPersonal(p),
             lesión:      penalizaciónLesiónGrave(p) }
  ventana ← (16 ≤ edad ≤ 21) ? config.criticalWindowMult (≈1.8) : 1

  # 1) El techo latente se mueve (sube o baja)
  deriva ← config.ceilingDrift * ventana * (Σ w_i * (env_i − 0.5)) * (0.5 + p.psych.growthMindset)
  ruido  ← normal(0, volatility(edad))       # σ grande a los 16, casi 0 a los 26+
  L ← clamp(L + deriva + ruido + shocks(p), CA, config.maxL)
      # shocks: rotura de ligamento → L −= 0.5..1.5 y −aceleración permanente
      # L nunca baja de la CA actual (un techo por debajo de lo ya alcanzado no tiene sentido)

  # 2) Crecimiento de la capacidad actual
  brecha    ← max(0, L − CA)
  velocidad ← curvaEdad(edad − maturationShift) * (brecha / (brecha + config.gapHalf))
              * (0.3 + 0.7 * env.minutos) * (0.6 + 0.4 * env.entrenamiento)
              * (0.7 + 0.6 * p.psych.professionalism) * encajeMult
  puntos    ← velocidad * config.monthlyGrowthScale * lognormal(0, 0.25)   # meses buenos y malos

  # 3) Reparto de puntos entre atributos
  para cada atributo a:
    peso[a] ← shape[a] * focoEntrenamiento[a] * curvaTipo(tipo(a), edad) * margen(a)
              # curvaTipo: físicos maduran antes (pico 24–28); técnicos estables a media carrera;
              #            mentales crecen hasta 30+.  margen(a) = espacio hasta 20 (rendimientos decrecientes)
  repartir(puntos, peso)  # con un mínimo de dispersión para evitar picos irreales

  # 4) Declive
  si edad > physicalPeakAge: físicos −= declive(edad − peak) * (1.2 − profesionalismo) * propensiónLesión
  si edad > 31: técnicos −= declive suave; mentales casi estables
  si meses sin minutos ≥ 6 y edad ≥ 22: −afilado y −confianza (no atributos salvo prolongado)

  # 5) Registrar factores dominantes → informe del entrenador
  p.development.recentFactors ← top3(contribuciones con signo)
```

Valores iniciales en generación: `L₀ = CA₀ + |normal(μ_gap(edad, reputaciónCantera), σ)|`, con `volatility₀ ≈ 1.5` a los 16 → `0.1` a los 26.

### 4.3 Anti-inflación de talento

- La **oferta de talento** entra por las canteras: cada club genera su promoción anual con una distribución de `L₀` determinada por instalaciones juveniles y reputación, **normalizada a nivel mundial** para que el número esperado de jugadores con `L₀ ≥ 16` por año sea constante (`config.eliteInflowPerYear`).
- Test de balance (Fase 3): en 20 temporadas, el percentil 99, 95 y 50 de CA de todo el mundo deben quedar dentro de ±8 % del año 1, y el nº de jugadores con CA ≥ 16 dentro de ±12 % (decisión del usuario en la revisión: es un recuento de ~50 jugadores y ±8 % quedaba por debajo de su ruido natural).
- La deriva del techo es de media cero en un entorno "promedio" (env = 0.5); solo entornos por encima/debajo de la media lo desplazan.

### 4.3.1 Encaje, prodigios y florecimiento tardío (decisión del usuario en la revisión de la Fase 4)

"Debería ser más realista: depende de cómo entrenan y de si la táctica y el mánager les funcionan; incluso un veterano puede mejorar con la táctica y el mánager adecuados."

- **El encaje entra en el desarrollo.** El encaje del jugador en su club (§5.5) suma al entorno que mueve el techo y multiplica el ritmo de crecimiento, siempre **respecto a la media del mundo** (no infla el talento). En el desarrollo pesan sobre todo la táctica (jugar en su sitio) y el mánager (que confíe en él): `config/development.ts → DEV_FIT_WEIGHTS`. El informe «¿por qué?» lo explica («Encaja en la táctica y con el técnico» / «No encaja…»).
- **Prodigios: el techo es una promesa, no un destino.** Un buen entorno la sostiene, pero no la agranda. Uno malo (pocos minutos reales, mal encaje, poca profesionalidad) la erosiona `PRODIGY_DRIFT_MULT` veces más deprisa que a un canterano normal, hasta los 23 años. Para un prodigio cuentan sus minutos reales: el suelo de minutos de filial no le basta. Antes, 23 de 25 llegaban a la élite; ahora depende de dónde caigan y de cómo se les trate.
- **Florecimiento tardío.** Entre los 22 y los 32 años, un jugador que aún no es de élite, juega casi siempre y encaja claramente mejor que la media (sobre todo por la táctica y la confianza del mánager) puede subir su techo, solo hacia arriba y como mucho `LATE_BLOOM_HEADROOM` sobre su nivel. También crece aunque la edad ya no ayude. Los cracks no florecen más: así la élite no se infla.

### 4.4 Mentoría

`efectoMentor(p) = compatibilidad(m, p) * (rasgosMentor − rasgosAprendiz)` por rasgo transferible (profesionalismo, compostura, determinación/competitividad, temperamento).
`compatibilidad` = idioma común + misma línea de posición + afinidad del grafo − choque de egos (ambos ego > 0.7 → negativa). Los rasgos del aprendiz se desplazan hasta un 10–15 % por temporada; **los malos hábitos también se transfieren**. Una mentoría con compatibilidad negativa genera memoria negativa y tensión.

### 4.5 Ojeadores con incertidumbre

Cada ojeador `s` tiene `judgingPotential`, `judgingAbility`, `bias` (p. ej. sobrevalora físicos o su propia nacionalidad) y `knowledge[nación]`.
Cada observación: `obs = L + bias_s(p) + normal(0, σ_obs)` con `σ_obs` decreciente con su juicio, su conocimiento de la región y los minutos vistos. La creencia se actualiza como un filtro de Kalman 1D (con deriva de proceso, porque `L` se mueve):

```
σ̂² ← σ̂² + volatility²(edad) * Δt          # la incertidumbre crece si no observas
K   ← σ̂² / (σ̂² + σ_obs²)
μ̂  ← μ̂ + K (obs − μ̂);   σ̂² ← (1 − K) σ̂²
```

Informe: estrellas = mapear `μ̂ ± 1.28σ̂` (80 %) a 0.5–5 ★; confianza = baja/media/alta según `σ̂`. Dos ojeadores con sesgos distintos discrepan de forma natural y explicable ("Ruiz lo ve más alto: valora mucho su físico").

---

## 5. Grafo social y dinámicas de ego

### 5.1 Grafo

- Nodos: jugadores del club + mánager (+ staff clave más adelante).
- Aristas jugador–jugador: `Relationship` (§3). Arista jugador→mánager: incluye `trust`, que es la "reputación de palabra".
- **Inicialización** al formar plantilla o al llegar un jugador: baseline por idioma común (+0.15), misma nacionalidad (+0.10), edad cercana (+0.05), compañeros previos (memoria compartida), rivalidad base por posición compartida (`competitiveness` de ambos).

### 5.2 Actualización semanal (LOD completo; diaria solo para eventos)

```
para cada par (i, j) en la plantilla:
  # deriva estructural
  Δaffinity  = k1*idiomaComún + k2*sociabilidad_i*sociabilidad_j + k3*tiempoJuntos
               + k4*interaccionesEnCampo(asistencias mutuas, paredes)  − k5*incidentes
  Δrivalry   = k6*solapamientoRol(i,j)*competitiveness_i*competitiveness_j
  Δenvy_i→j  = k7*ego_i*max(0, salario_j/salario_i − 1)*max(0, rendimiento_i − rendimiento_j)
               + k8*ego_i*max(0, estatus_j − estatus_i)
  Δrespect   = k9*(rendimiento_j − media) + k10*professionalism_j
  # decaimiento hacia la línea base
  rel ← rel + Δ − λ*(rel − baseline)
# los eventos (pelea en entrenamiento, gol dedicado, filtración) aplican impulsos inmediatos + crean Memory
```

- **Camarillas**: algoritmo de Louvain sobre aristas con valencia > 0.15 (pesos = valencia), con orden de nodos fijo y desempates por id → determinista. Se nombran por su rasgo dominante ("el grupo lusófono", "los veteranos", "los canteranos") a partir de atributos compartidos.
- **Jerarquía**: `influenciaReal = 0.35*psych.influence + 0.25*PageRank(aristas de respeto) + 0.15*antigüedad + 0.15*estatus en plantilla + 0.10*reputación`.
  Niveles por umbrales y percentiles: líderes (≤3), influyentes, núcleo, periferia, marginados (valencia media < −0.2 o sin aristas positivas).
- **Contagio emocional**: cada semana `moral_i += α * Σ_j influencia_j * afinidad_ij * (moral_j − moral_i)`, normalizado. Un líder descontento arrastra a su camarilla; uno feliz amortigua.

### 5.3 Motor genérico de dinámicas de ego

Cada dinámica es un módulo con la misma forma, para que añadir las otras 8+ de la §5.2 del documento de visión sea rutinario:

```ts
interface EgoDynamic {
  id: string;
  detect(world: World, clubId: ClubId): Trigger[];            // ¿quién está afectado y cuánto? (puro)
  accumulate(trigger: Trigger, actor: Player): number;          // Δ tensión diaria (por rasgos y contexto)
  ladder: EscalationStep[];                                     // umbrales de tensión → acción
  chooseChannel(actor: Player, rel: Relationship, rng: Rng): Channel;  // privado/agente/prensa/redes/campo
  resolutions: Resolution[];                                    // qué la desactiva (y qué deja en memoria)
}
```

**Escalera común** (los umbrales por dinámica viven en config):

| Tensión | Acción posible | Canal elegido por rasgos |
|---|---|---|
| 0.25 | Señales sutiles (lenguaje corporal, entrenamientos algo peores) — la UI lo muestra como "parece molesto" | — |
| 0.45 | Pide hablar contigo / lo comenta con su camarilla | sociabilidad alta → camarilla; ego alto → contigo |
| 0.65 | Su agente llama / declaración ambigua / indirecta en redes | `offPitchLife`, `controversy`, agente |
| 0.80 | Queja pública, filtración, rendimiento cae (−consistencia efectiva) | `temperament`, relación con mánager |
| 0.95 | Petición de traspaso / huelga de brazos caídos | `loyalty` baja, `ambition` alta |

Cada paso crea `Memory` (para el jugador, testigos y, si es público, narrativa de prensa) y un `InboxItem` accionable. Cada resolución la registra también.

### 5.4 Las tres primeras dinámicas (Fase 4)

**1) Celos salariales** — es también el escenario de aceptación de la Fase 4.
- *Detecta*: jugador `i` con `ego > 0.55` y compañero `j` que gana ≥ 15 % más, con `rendimiento_i ≥ rendimiento_j` (media 10 partidos) o `estatus_i ≥ estatus_j`. Se activa sobre todo al llegar un fichaje o al renovar a otro.
- *Acumula*: `Δ = ego * (ratioSalarial − 1) * (0.5 + recognitionNeed) * (1 − 0.5*lealtad)` por día, mayor si `i` es líder (siente que "le toca").
- *Resoluciones*: renovación con subida (exige ≥ 90 % del salario de `j`), conversación de "rol y planes" exitosa (baja tensión, crea `Commitment` de renovación con plazo), venta de `j`, el tiempo (decaimiento lento si `i` rinde peor que `j`).
- *Efecto colateral*: `envy_i→j` sube → afinidad entre ambos cae → posible tensión en camarillas.

**2) Estatus prometido vs. real**
- *Detecta*: `expectedStatus` (fijado al fichar/renovar o por promesa) > `perceivedStatus` (calculado por titularidades, minutos, capitanía, lanzamientos asignados en los últimos N partidos).
- *Acumula*: proporcional a la brecha, `ego`, `insecurity` (inseguridad la hace más rápida pero también más fácil de calmar), y **se multiplica si hay un `Commitment` activo de minutos** que va "en riesgo".
- *Integración con promesas*: si el `Commitment` vence incumplido → evento `promiseBroken` → memoria fuerte para el afectado y `witnessedBrokenPromise` para los testigos (según `witnesses`) → baja `trust` del vestuario hacia el mánager.
- *Resoluciones*: darle minutos, pactar un nuevo rol (renegociar el `Commitment` cuesta algo de `trust` pero menos que romperlo), cesión, venta.

**3) Dos gallos en el mismo corral**
- *Detecta*: par `(i, j)` con ambos `ego > 0.65` y solapamiento de **rol simbólico**: misma posición/rol ofensivo, lanzador de faltas/penaltis, referente (máximo goleador), brazalete.
- *Acumula* (tensión del **par**, no del individuo): `ego_i*ego_j * solapamiento * (1 − afinidad_ij)`, aumentada por eventos: uno quita un balón parado al otro, la prensa compara a ambos (narrativa `feud`), uno se queja de la asistencia que no recibió.
- *Resoluciones*: **roles pactados** (asignar explícitamente penaltis a uno y faltas al otro → crea `Commitment` doble), separar en campo con táctica, dar la capitanía a uno (riesgo: el otro), vender a uno. Si estalla: discusión en entrenamiento/partido (evento visible), división de la plantilla según camarillas (cada miembro elige bando por afinidad).

Escenarios guionizados de test (Fase 4): para cada dinámica, ≥ 3 escenarios con semillas fijas y rangos esperados (p. ej. "fichar a estrella con salario 1.5× el del líder ego 0.85 → en ≤ 30 días: tensión ≥ 0.45 en ≥ 80 % de 200 semillas; con lealtad 0.9 del líder: ≤ 40 %").

### 5.5 Encaje (resumen; se implementa en Fase 4)

`encaje = 0.35 táctico + 0.25 cultural + 0.25 social + 0.15 con el mánager`, cada uno con desglose explicable. Modifica rendimiento (±5 % efectivo en partido), velocidad de desarrollo y felicidad.

---

## 6. Otros sistemas (resumen para planificar; diseño detallado al llegar a su fase)

- **Motor de partido (Fase 2)**: simulación por eventos sobre una rejilla de zonas (6×5) con cadenas de posesión; cada acción (pase, conducción, regate, centro, tiro, presión, entrada) se resuelve con atributos de los implicados, táctica, fatiga, moral/confianza y encaje. Sustituciones, tarjetas, lesiones, VAR y **controversias registradas con evidencia** (para quejas arbitrales). Un modelo rápido estadístico calibrado contra el completo para partidos LOD ligero.
- **Medios (Fase 5)**: preguntas generadas desde `Narrative`s activas ordenadas por `heat`; plantillas con precondiciones; registro `questionsAsked` impide repetir plantilla+sujeto en la temporada salvo que la narrativa reciba hechos nuevos. Respuestas = intención + tono → evaluadas contra perfiles de los aludidos, declaraciones previas (contradicción → narrativa `hypocrisy`) y generan `Commitment`s cuando procede.
- **Mundo (Fase 6)**: economía, mercado con IA de clubes por necesidades (huecos de plantilla, presupuesto, filosofía), directiva, afición segmentada, redes.
- **Diálogo**: `DialogueIntent` (estructura con hablante, intención, tono, hechos referenciados) → `TemplateProvider` (gramática procedural con variación y memoria anti-repetición) o `LlmProvider` (reescritura; si falla o tarda > N ms, cae a plantilla).

---

## 7. Roadmap y criterios de aceptación

| Fase | Contenido | Criterios de aceptación (verificables) |
|---|---|---|
| **1. Núcleo** | Monorepo, RNG, tipos, tiempo/calendario, datos de ~100 naciones, i18n, generación de mundo, motor de formatos de competición (ligas, copas, continentales, selecciones), serialización, CLI `gen` | Mismo seed → mismo hash; seeds distintos → mundos distintos; calendario de 4 temporadas sin choques; generación < 5 s; distribuciones en rango (§10) |
| **2. Motor de partido** | Motor por eventos, tácticas básicas, cambios, tarjetas, lesiones, modelo rápido, CLI `sim` | 20 temporadas: goles/partido 2,5–2,9; local 42–47 %; empates 24–28 %; rojas 0,1–0,2; goleadores con cola larga; partido reproducible por `seedPath`; motor rápido dentro de ±3 % del completo en esas métricas |
| **3. Desarrollo** | Techo latente, crecimiento, entrenamiento, mentoría (atributos), ojeadores | 20 temporadas sin inflación (±8 % en P50/P95/P99; ±12 % en nº de élite); dos ojeadores discrepan en ≥ 30 % de jóvenes; informe "por qué" presente en todo cambio de CA ≥ 0.3 |
| **4. Vestuario y ego** | Grafo, camarillas, jerarquía, estado emocional, memoria episódica, 3 dinámicas, `Commitment`s, encaje, conversaciones. Preparación multijugador (§11.3): autor en cada `Command`, varios mánagers humanos, sal de turno en la semilla | Escenarios guionizados dentro de rango en ≥ 200 semillas; cada promesa de prensa/conversación crea `Commitment` con acción enlazada; avance de día < 200 ms (perfil móvil simulado con CPU ×4 throttling) |
| **5. Medios, redes y disciplina** | Narrativas, periodistas, prensa contextual, redes sociales ficticias, decisiones arbitrales dudosas con evidencia, colectivo arbitral, comité de disciplina con expedientes, alegaciones y recursos, delegación con directrices (§11.4) | 0 preguntas repetidas en una temporada sin hecho nuevo (test automático en 20 temporadas); el asistente nunca viola una directriz; toda sanción tiene expediente con hechos enlazados; ninguna publicación expone números ocultos |
| **6. Mundo** | Economía, mercado, IA de clubes, directiva, afición, redes | Sin traspasos absurdos (detector: precio vs. valor, encaje con necesidad, presupuesto) en 20 temporadas; FFP respetado por la IA |
| **7. UI completa** | Todas las pantallas, mapa del vestuario, paneles, accesibilidad | Tests visuales Playwright sin solapamientos en 360/768/1440 px; axe sin violaciones AA; navegación completa por teclado |
| **8. Multijugador asíncrono** | Servidor autoritativo (nube o mini PC), salas de 2–10 humanos, órdenes por partido, avance por días con espera solo a quien juega, plazos, notificaciones, repeticiones, anti-repetición (§11.3) | Un partido simulado nunca cambia; con el mundo y las órdenes, nadie puede predecir el resultado antes del cierre; el resultado de cualquier día se reproduce desde el registro; un humano que juega el domingo puede cerrar antes que el del viernes sin bloquearlo |
| **9. Assets e IA** | Prompts de imagen, caché, retratos SVG, `LlmProvider` | Todo jugador tiene cara; juego 100 % offline sin proveedor |
| **10. Pulido** | Tutoriales, logros, editor de BD, balance final | 3 temporadas jugadas sin bugs bloqueantes |
| **11. Director deportivo y presidente** | Modos jugables de los otros cargos (§11.2) | Cada cargo tiene su propio ciclo de decisiones y sus formas de acceso y salida |

> Propuesta: adelantar a la Fase 2 una **UI mínima de depuración** (lista de jugadores, tabla, resultados) para poder ver el mundo desde el principio. No sustituye a la Fase 7.

---

## 8. Alcance del mundo v1

### 8.1 Naciones, ligas y clubes
- **Países e idiomas reales**; **clubes, jugadores, entrenadores, árbitros y periodistas ficticios**.
- **Ligas jugables (5 naciones × 2 divisiones = 198 clubes)**, con tamaños reales:

| Nación | 1.ª división | 2.ª división | Copa nacional |
|---|---|---|---|
| Inglaterra | 20 | 24 | sí |
| España | 20 | 22 | sí |
| Italia | 20 | 20 | sí |
| Alemania | 18 | 18 | sí |
| Francia | 18 | 18 | sí |

- **Resto del mundo (~100 naciones) como "reserva en sombra"**: cada nación no jugable tiene unos pocos clubes "en sombra" (con reputación, finanzas y plantilla, pero sin calendario propio; LOD ligero). Sirven para tres cosas: convocatorias de las selecciones, mercado de fichajes y clubes de otras ligas en las competiciones continentales. Una nación en sombra puede pasar a jugable en futuras versiones sin cambiar el modelo.
- **Nombres de club genéricos al estilo de FM sin licencias**: ciudades reales + patrones culturales ("Atlético {ciudad}", "{ciudad} United", "Sportverein {ciudad} 1904", "AS {ciudad}") + **lista de bloqueo** de nombres reales de clubes, que se comprueba en los tests. Escudos y uniformes procedurales.
- **Nombres de competiciones genéricos** ("Primera División de Inglaterra", "Copa de Campeones de Europa", "Campeonato Mundial de Selecciones"), traducibles y editables. Nada de marcas registradas.
- Mundo esperado: ≈ 200 clubes jugables + ≈ 300 en sombra, ≈ 12.000 jugadores. El LOD (§2.2) hace viable este tamaño.

### 8.2 Competiciones
| Tipo | Competiciones (nombres ficticios) | Formato |
|---|---|---|
| Ligas | 10 ligas, con ascensos y descensos entre las dos divisiones (incluidos *playoffs* donde existan en la realidad) | Liga a doble vuelta (Berger) |
| Copas nacionales | 5 | Eliminatorias, a partido único o con ida y vuelta según la ronda |
| Continentales de clubes (Europa) | 1.ª, 2.ª y 3.ª competición europea | Fase de liga de 36 equipos con sorteo por bombos (8 partidos), *playoff* y eliminatorias |
| Mundial de selecciones | Cada 4 años, 48 selecciones | 12 grupos de 4 + dieciseisavos |
| Torneos continentales de selecciones | Europa (24), América del Sur (16), África (24), Asia (24), Norte/Centroamérica (16) | Grupos + eliminatorias |
| Ligas de Naciones | Europa (Ligas A–D, con ascensos y descensos y *final four*) y Norte/Centroamérica | Grupos a doble vuelta + finales |
| Clasificatorias | Mundial y torneos continentales, por confederación | Grupos a doble vuelta (+ repesca) |
| Amistosos | En las ventanas internacionales que queden libres | — |

- El **ciclo internacional de 4 años** vive en configuración: qué competición ocupa cada ventana FIFA (septiembre, octubre, noviembre, marzo, junio) y cada verano.
- Las clasificaciones se resuelven con resultados reales. Si aún no hay resultados (la temporada 1 de la Fase 1), se usa un **ranking de selecciones tipo Elo**, inicializado desde la fuerza de cada nación.
- Las competiciones continentales de clubes de otras confederaciones quedan fuera de la v1. Se pueden añadir con el mismo motor de formatos.

### 8.3 Motor de partido y visor 2D (decisión para la Fase 2)
Simulación **por zonas** (rejilla 6×5, cadenas de posesión). El motor emite además **fotogramas clave posicionales**: posición de cada jugador derivada de la forma táctica, la zona del balón y el rol en la acción. El **visor 2D** de la UI los interpola. Así el visor no decide nada: dibuja lo que el motor ya resolvió, y el mismo `seedPath` reproduce el mismo partido animado.

### 8.4 Idiomas
- Código en inglés; comentarios y documentación en español.
- **UI en español (por defecto), inglés, francés, alemán y chino simplificado** desde el principio. Paquete `packages/i18n` con catálogos ICU MessageFormat y prueba de que no falta ninguna clave en ningún idioma.
- Nombres de países localizados con `Intl.DisplayNames`, más excepciones propias (Inglaterra, Escocia, Gales e Irlanda del Norte no son países ISO).
- El núcleo nunca guarda texto traducido: guarda claves y códigos.
- Los nombres de personas no se traducen. En chino se muestran en su forma original, con transliteración opcional en una fase posterior.

### 8.5 Plataformas
PWA (navegador y móvil) y **aplicación de escritorio con Tauri** (Fase 7). El núcleo no cambia: Tauri solo empaqueta la misma web y puede guardar en disco además de en IndexedDB.

---

## 9. Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| 1 | Naciones y datos reales | Mundo ficticio **por defecto** (listas de bloqueo). **Paquete opcional `real`**: clubes reales (2025/26) con su fuerza, ~1.800 jugadores reales (primera división de las 5 ligas + internacionales de otras ligas) y selecciones reales; importable/exportable en CSV. Para publicar el juego con jugadores reales haría falta licencia (FIFPro); para uso personal no |
| 2 | Tamaño | 5 grandes ligas + sus segundas, Mundial, Ligas de Naciones, torneos continentales y clasificatorias (§8) |
| 3 | UI | React + Vite |
| 4 | Partido | Simulación por zonas + visor 2D con jugadores, alimentado por fotogramas del motor (§8.3) |
| 5 | Idiomas | Código en inglés, documentación en español; UI en es/en/fr/de/zh |
| 6 | Plataformas | PWA + escritorio (Tauri) |
| 7 | Nombre | **Tactical Football** |
| 8 | Ocultos en el guardado | MessagePack + compresión + **suma de integridad**. No se cifra: la clave viviría en el cliente y sería teatro. La protección real del misterio es de diseño: el techo latente es un proceso estocástico (§4), así que leer el guardado no revela el futuro. Un guardado editado se marca como "modificado" (sin logros) en lugar de rechazarse |
| 9 | Entrega | **Un PR por fase**, revisado antes de empezar la siguiente |

---

## 10. Plan detallado de la Fase 1

### Tareas
1. **Andamiaje**
   - npm workspaces, `tsconfig.base.json` estricto, ESLint (con una regla que prohíbe `Math.random` y `Date` en `packages/core`), Prettier, Vitest con cobertura y scripts raíz (`test`, `typecheck`, `lint`, `gen`).
   - CI en GitHub Actions: typecheck, lint, tests y test de determinismo.
2. **RNG** (`core/rng`)
   - `splitmix32`, `xoshiro128**` y `fork(path)` derivado por hash de la ruta; serialización y restauración del estado.
   - Distribuciones (§2.4), incluida la normal multivariante por Cholesky.
   - Tests: independencia de *streams*, reproducibilidad y propiedades estadísticas básicas.
3. **Tipos del dominio** (`core/types`) según §3. Los campos de fases futuras quedan como opcionales o *stubs* mínimos.
4. **Tiempo** (`core/time`)
   - `GameDay` ↔ fecha civil con aritmética entera (sin `Date`), días de la semana, temporadas que empiezan el 1 de julio.
   - Ventanas FIFA, ventanas de fichajes, parón invernal (Alemania) y verano internacional.
5. **Datos** (`packages/data`)
   - ~100 naciones: código, confederación, idiomas, cultura de nombres, fuerza futbolística, tamaño de la cantera y clima.
   - Nombres y apellidos por cultura, ciudades reales de las 5 naciones jugables y patrones de nombre de club por cultura.
   - Lista de bloqueo de nombres reales de clubes.
6. **i18n** (`packages/i18n`): catálogos es/en/fr/de/zh para posiciones, atributos, arquetipos, competiciones y naciones con excepciones.
7. **Generación del mundo** (`core/gen`)
   - Naciones → ligas → clubes jugables y en sombra (reputación de cola larga, colores, identidad, finanzas, instalaciones, estadio) → plantillas (25–30 por club, según necesidades posicionales) → staff (entrenadores, ojeadores, árbitros).
   - Cada jugador: posición → plantilla de atributos por rol con ruido y `shape`; edad según la división; `PsychProfile` correlacionado (§3.1); ocultos derivados; `DevelopmentState` inicial; idiomas; contrato; apariencia canónica.
   - Arquetipos semilla garantizados.
   - Selecciones nacionales: convocatoria inicial de los mejores elegibles y ranking Elo inicial.
8. **Competiciones** (`core/competition`)
   - Motor de formatos genérico: liga (Berger), grupos, eliminatorias (partido único o ida y vuelta), fase de liga con sorteo por bombos y restricciones, y Liga de Naciones (divisiones con ascenso y descenso).
   - Tablas con desempates; reglas de ascenso y descenso y de clasificación; rondas cuyos emparejamientos dependen de resultados ("pendiente de sorteo").
   - Planificador que coloca cada jornada en el calendario sin choques: ningún equipo juega dos veces con menos de 2 días de descanso y las ligas respetan las ventanas FIFA.
9. **Mundo y serialización** (`core/world`): IDs deterministas, `World`, `WorldEvent` base con reductor, serialización estable y **hash** del mundo.
10. **Motor de ticks mínimo** (`core/engine`)
    - Avance de días: procesa el calendario. En la Fase 1 los partidos quedan "pendientes de motor".
    - Cumpleaños y fin de temporada: ascensos, renovación de temporada y nuevo calendario, con un ciclo internacional que avanza.
    - Permite avanzar 4+ temporadas vacías.
11. **Vistas mínimas** (`core/views`): arquetipo legible, edad, CA derivada y resumen de club.
12. **CLI** (`tools/gen`): `npm run gen -- --seed=123 [--out=world.json] [--stats] [--seasons=4]`.
13. **Tests de aceptación**
    - Determinismo: mismo seed → mismo hash, con *snapshot* del hash de `seed=123`.
    - Sensibilidad: 6 seeds → 6 hashes distintos (cada mundo tarda ~1,6 s).
    - Distribuciones: edades, arquetipos y correlaciones de rasgos (±0,05 de la matriz objetivo).
    - Calendario: doble vuelta completa, sin choques y con descanso mínimo; las ventanas FIFA quedan libres de partidos de liga.
    - Ningún club con nombre de la lista de bloqueo; i18n sin claves faltantes.
    - Rendimiento: generar el mundo de referencia en < 5 s en escritorio (medido: ~1,6 s).
    - Determinismo en navegador: se comprueba en la Fase 2, al existir `apps/web`.
14. **Cierre**: `docs/CHANGELOG.md` e informe de estadísticas en `docs/balance/fase1.md`.


---

## 10b. Fase 2 — motor de partido (implementado)

### Motor por zonas (`core/match/engine.ts`)
- **Entrada**: `MatchInput` es una instantánea completa: once, banquillo, habilidades combinadas (1–20), forma física, ocultos relevantes, táctica, rigor del árbitro e importancia. Con la misma entrada y el mismo `seedPath` (`match/<id>`), el partido es idéntico.
- **Cadenas de posesión**: el poseedor elige entre pase de seguridad, pase hacia delante, balón largo, pase al hueco, regate, centro o tiro. Pesa la zona (campo continuo 0..1, rejilla 6×5 a efectos de diales), su puesto, sus atributos, la táctica y sus instrucciones.
- **Duelos logísticos** contra el defensor más cercano según la forma táctica del rival. Modificadores: calidad × forma del día × condición × encaje en el puesto × moral, campo, inferioridad numérica, presión alta, último tercio y mentalidad.
- **Tiros con xG** por tipo de ocasión (área, área cercana, banda, lejano, cabezazo, mano a mano, penalti, falta directa, cabezazo de córner, rechace) y calidad de rematador y portero. Pueden ir bloqueados, parados (córner o rechace), fuera o al palo.
- **Faltas y tarjetas**: el árbitro tiene rigor propio. Hay faltas tácticas para cortar contras, el amonestado se cuida y hay amarillas por protestas según el temperamento.
- **Lesiones** por minuto (propensión × cansancio) y por faltas.
- **Cansancio** minuto a minuto. Cambios de la IA en 3 ventanas (cansados, amonestados en riesgo, atacante si pierde, defensa si gana por la mínima al final).
- **Gestión del marcador**: quien gana se repliega y quien pierde arriesga, más cuanto más tarde.
- **Prórroga y penaltis** en partidos decisivos, teniendo en cuenta la ida.
- **Fotogramas para el visor 2D**: posición de los 22 puestos y del balón en cada acción, derivada de la forma táctica. Se calculan sin tocar el RNG, así que pedirlos no cambia el partido.
- **LOD**: modo `auto` usa el motor completo salvo entre dos clubes en sombra, que usan el modelo rápido (`quick.ts`) calibrado contra el completo.
- **Rendimiento**: ~2,5 ms por partido (~25 s por temporada mundial completa en escritorio, < 100 ms por día de juego).

### Tácticas (`types/tactics.ts`, `match/tactics.ts`)
- **Sistema y estilo**:
  - Formaciones: 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2 y 4-1-4-1.
  - Mentalidad, presión, ritmo, amplitud y juego directo.
  - La IA tiene un estilo estable por club (hash del id) y ajusta la mentalidad según el rival y el campo.
- **Balón parado**:

| Situación | Opciones | Efecto en el motor |
|---|---|---|
| Córner | primer palo, segundo palo, en corto, al borde del área | Probabilidad y calidad del remate; en corto se conserva el balón; al borde busca al mejor tirador lejano |
| Suben al córner | pocos, los centrales, todos | Más remate a cambio de más contras rivales tras el despeje |
| Falta en zona de disparo | tirar, centrar, en corto | Probabilidad de tiro directo, centro o conservar |
| Saque de banda | corto o largo | El largo en campo rival es un centro al área del lanzador |
| Saque inicial (inicio y descanso) | elaborar o balón largo | Primera acción de la jugada |
| Lanzadores | penaltis (orden), faltas, córners y saques largos | Si el designado no está en el campo, tira el mejor disponible |

- **Instrucciones individuales**: tirar más/menos, regatear más/menos, centrar más, pase corto/largo, incorporarse, quedarse atrás, presionar más/menos, entrar fuerte, no ir al suelo. Cada una modifica pesos de acción, posición, cansancio o faltas.
- **Aceptación (ego y carácter)**:
  - Antes de cada partido, cada jugador decide si cumple cada instrucción.
  - La probabilidad sube con su profesionalidad y con la autoridad del técnico sobre él (reputación relativa y mano con la gente). Baja con su ego y con el choque entre la orden y su forma de ser: un goleador con ego no quiere tirar menos; un jugador temperamental no sabe no ir al suelo.
  - Ignorar una instrucción deja un `WorldEvent` `player.ignoredInstruction`. En la Fase 4 alimentará la relación técnico–jugador y las dinámicas de ego.
  - La UI solo muestra si la cumplió, nunca la probabilidad (regla 6).
- **Plan del usuario**: `World.tactics[teamId]` (`TacticsPlan`) se fija con el comando `setTactics` validado; lo que no fija lo decide la IA. Admite once propio por puestos.

### Partido en directo (`startMatch`, `simulateWithInterventions`, `liveIntervene`)
- **Unidades de simulación**: el motor avanza por unidades (un saque inicial, una acción, un final de parte, la tanda de penaltis). Entre dos unidades se puede pausar.
- **Intervenciones** (`Intervention`): cada una tiene la unidad (`step`), el equipo y el cambio.
  - Cambio de jugador: en el descanso no gasta ventana; varios cambios en la misma pausa cuentan como una sola ventana.
  - Sistema: los jugadores en el campo se recolocan en los puestos nuevos.
  - Mentalidad, presión, ritmo, amplitud, juego directo y balón parado.
  - Instrucciones individuales: cada orden nueva se decide en ese momento según la disposición del jugador y queda registrada con su minuto.
- **Determinismo**:
  - Con la misma entrada, semilla e intervenciones, el partido es idéntico. Lo jugado antes de una intervención no cambia, porque el azar se consume en el mismo orden.
  - Por eso el directo se resuelve volviendo a simular el partido desde el principio con las intervenciones acumuladas (~3 ms).
  - Nunca se puede intervenir antes de la última intervención (`error.pastStep`).
- **IA**:
  - Cuando el humano toma el mando táctico, su equipo deja de tener gestión automática del marcador; el asistente sigue haciendo los cambios por cansancio o lesión.
  - La IA rival responde a cambios claros de mentalidad: se protege si el otro se lanza y da un paso adelante si el otro se encierra.
- **Mundo**: `advanceDay(game, { live: matchId })` reserva el partido. `finishLive` lo cierra, guarda las intervenciones en `Match.interventions` para repetirlo o auditarlo, y hace avanzar la competición. Si se avanza otro día con un directo abierto, se cierra solo con lo que tenga.
- **UI**: «Ver en directo» abre el partido sin poder adelantar. Pausa manual y automática en el descanso y antes de la prórroga. Panel de cambios, sistema y estilo, e instrucciones. Al final, «Terminar partido».

### Consecuencias en el mundo (`match/apply.ts`)
- Resultado con goleadores, asistentes, tarjetas, estadísticas y mejor jugador.
- Estadísticas por competición (`World.stats`): al cerrar temporada pasan a la trayectoria del jugador (`Player.career`) y al máximo goleador del historial.
- Forma física con recuperación perezosa por días (`fitness` + `fitnessDay`).
- Lesiones con fecha de alta.
- Sanciones por competición: roja directa 2 partidos, doble amarilla 1, cada 5 amarillas 1.
- Internacionalidades y goles con la selección.
- Eventos `match.redCard`, `player.injured` (≥ 21 días) y `player.ignoredInstruction`.

### Estado v2
`SAVE_VERSION = 2`, con migración v1→v2 (`world/migrations.ts`) y su test.

### UI de depuración (`apps/web`)
- React + Vite. El juego vive en un Web Worker y la UI solo envía `Command`s y pide vistas (`core/views/game.ts`).
- Pestañas: clasificación, resultados, plantilla, goleadores, táctica y partido en directo con visor 2D (canvas que interpola los fotogramas), registro de eventos, estadísticas e instrucciones cumplidas o ignoradas.
- El paquete de datos reales se carga solo si se marca (import dinámico).

## 10c. Fase 3 — desarrollo (implementado)

### Desarrollo mensual (`core/development/tick.ts`)
- **Tick mensual** el día 1 de cada mes, con un stream por jugador (`dev/<año>/<mes>/<id>`).
- **Techo latente**:
  - Deriva según el entorno: minutos, calidad de entrenamiento (instalaciones y técnicos), plan cumplido y mentor. Se mide **respecto a la media mundial del mes** y pesa casi solo en la etapa formativa (16–21 años).
  - Ruido según la volatilidad de la edad.
  - Sin suelo en la CA: un techo por debajo de la CA es un jugador que ya tocó su máximo. Con suelo, el ruido tendría efecto trinquete.
- **Crecimiento** de la CA hacia el techo: curva de edad desplazada por la maduración, margen techo − CA, minutos (los jóvenes tienen un mínimo «de filial»), entrenamiento, profesionalidad, intensidad del plan y suerte del mes.
- **Reparto por atributos**: talento natural (`shape`), foco del plan, edad (lo físico madura antes, lo mental después) y margen hasta 20. Siempre se reparte de forma que la CA crezca exactamente lo calculado.
- **Declive**: el físico cae pasado su pico (lo frenan la profesionalidad y el plan); la técnica cae desde los 31; la experiencia suma en los mentales entre 22 y 32 años.
- **Lesión larga** (60 días o más): secuelas en el techo y en la explosividad, atenuadas por la calidad médica.
- **Informe «¿por qué?»**: los cuatro factores con más peso cada mes (edad, minutos, entrenamiento, actitud, partes del plan, mentor, declive, lesión). La UI solo muestra su sentido.

### Plan individual con staff (`development/plan.ts`)
- **Contenido del plan** (`World.plans`):
  - foco de entrenamiento (10 opciones) e intensidad (suave, normal, alta);
  - dieta del nutricionista (estándar, masa muscular, perder peso, recuperación);
  - rutina del preparador físico (fuerza, velocidad, resistencia, movilidad);
  - sueño (libre o rutina supervisada);
  - mentor.
- **Adherencia mensual** por parte (la cumple, a medias o no):
  - suman su profesionalidad, su mentalidad de crecimiento, la autoridad del técnico y la calidad del staff;
  - resta su vida fuera del campo, sobre todo en sueño y dieta;
  - resta el ego cuando el plan es exigente.
  - Ignorar el plan deja el evento `player.planIgnored`.
- **Efectos del plan**, según lo cumplido y la calidad del staff: crecimiento, foco, atributos concretos, peso, recuperación entre partidos, riesgo de lesión (la intensidad alta con rutina extra sobrecarga) y freno del declive.
- **Mentoría**: el aprendiz acerca su profesionalidad, temperamento, competitividad y mentalidad de crecimiento a las del mentor, también los malos hábitos. Si ambos tienen mucho ego, chocan (`player.mentorClash`).
- **Staff nuevo** por club jugable: nutricionista y preparador físico.

### Ojeadores (`development/scouting.ts`)
- **Creencia por ojeador y jugador**: filtro de Kalman 1D sobre el techo, con deriva de proceso y un sesgo propio (físico o técnico, y su nacionalidad).
- **Observaciones**: cada mes ven su plantilla de cerca y unos cuantos jugadores de su liga.
- **Informe**: estrellas del nivel actual, horquilla de potencial al 80 % y confianza. Dos ojeadores discrepan de forma explicable.

### Relevo generacional (`development/season.ts`)
- **Retiradas**: al cierre de temporada, por edad (pesan no tener club o haberse quedado atrás).
- **Cantera**: los canteranos (18–20 años) cubren los huecos por puesto, más uno extra por club jugable.
- **Plantilla larga**: los más flojos ya formados quedan libres.
- **Anti-inflación (§4.3)**, ajustada en la Fase 4 para cumplir ±12 % en el nº de élite:
  - cupo mundial de canteranos con techo de élite por promoción;
  - **«generación que viene»** (jóvenes por debajo de la élite con techo de élite). Se dimensiona para que dentro de unos años haya `ELITE_TARGET_SHARE` de cracks: objetivo − élite actual + salidas previstas por edad de los cracks (`ELITE_EXIT_BY_AGE`), corrigiendo el 70 % de la diferencia cada temporada. Anticiparse a las olas de edad evita el retraso de 3–5 años de la cantera, que hacía oscilar la élite ±30 %;
  - si sobran, se recorta el techo de los de techo más bajo; si faltan, reciben techo de élite los jóvenes (≤ 28 años) que por nivel y edad llegarían antes;
  - **ajuste de cierre**: solo fuera de ±6 % del objetivo, y solo sobre unos pocos jugadores a menos de 0,8 del umbral. Si sobran, a los veteranos de élite (≥ 27) les pasa factura la edad (`player.agingToll`); si faltan, un joven a las puertas tiene una temporada de explosión (`player.breakthrough`). Son eventos que la prensa podrá contar en la Fase 5;
  - la experiencia ya no lleva a nadie por encima de su techo.
- **Niños prodigio (wonderkids)** (petición del usuario):
  - cada temporada sale un canterano de 16–17 años con nivel 12,5–14,5 y un techo de 15,5–19,5 (no todos triunfan), más probable en las mejores canteras (evento `player.prodigy`);
  - el mundo inicial trae 5;
  - el cupo de élite no les recorta el techo (marca oculta `development.prodigy`);
  - los ojeadores los ven con su incertidumbre habitual.

### Retiradas anticipadas (`development/retirement.ts`)
- **Cuándo se lo plantea un jugador**: una lesión de 4 meses o más (a partir de los 27 años, más probable si reincide), motivos personales (raro; pesan su inseguridad y su vida fuera del campo) o la edad sin minutos (33 años o más).
- **Qué puede hacer el técnico**: hablar con él **una vez** (`persuadeRetirement`) con un enfoque:
  - lo que significa para el club (funciona con los leales);
  - un papel importante (con los ambiciosos y competitivos);
  - apoyo médico y personal (con lesiones y problemas personales);
  - aceptar su decisión.
- **Él decide**, según su carácter, el motivo, el enfoque y la autoridad del técnico. Si se retira, se va al final de la temporada; por motivos personales, al momento.
- Todo queda registrado en eventos.

### Estado v3
`SAVE_VERSION = 3`, con migración v2→v3 y su test.

## 10d. Fase 4 — vestuario y ego (implementado)

### Mánagers humanos y estado v4
- **Mánagers**:
  - `World.managers`: uno por humano.
  - Un humano toma el mando de un club con el comando `takeCharge`; entonces nace su vestuario (`World.dressing`).
  - Cada `Command` admite autor (`by`). Con varios humanos, cada uno solo actúa sobre su club (error `notYourPlayer`/`notYourTeam`).
- **Sal de turno** (`World.salts`, §11.3): entra en la ruta del stream de cada partido (`matchSeedPath`). Vacía en un jugador: no cambia nada.
- **Estado v4**: relaciones, confianza, recuerdos, promesas, buzón y vestuario. Todo vacío al generar; migración v3→v4 con test.

### Grafo social (`social/graph.ts`, §5.1–5.2)
- **Relación de partida**: idioma común, compatriota, edad cercana, química al azar y rivalidad por compartir línea.
- **Deriva semanal**:
  - afinidad hacia su base, más idioma y sociabilidad;
  - rivalidad;
  - envidia por salario frente a rendimiento, y por titularidad;
  - respeto por rendimiento y profesionalidad.
- **Impulsos**: goles con asistencia entre compañeros.
- **Jerarquía**: influencia real = rasgo, PageRank del respeto, antigüedad, participación y reputación. Hasta 3 líderes, influyentes, núcleo y periferia; marginados por valencia.
- **Camarillas**: Louvain determinista sobre las aristas por encima del percentil 88 del propio vestuario. Se nombran por lo que comparten: idioma, nación, veteranos, jóvenes, canteranos, los de casa o grupo mixto.
- **Estatus**:
  - esperado: el papel que le daría la IA al tomar el mando (un escalón más con mucho ego y un contrato que le promete más);
  - percibido: su participación en los últimos 8 partidos oficiales;
  - un veterano que no juega se siente reserva, no promesa.
- **Felicidad y moral**: confianza en el mánager, agravio de estatus, cómo le ven sus compañeros, recuerdos sobre el mánager y tensión. Contagio de moral de los influyentes a quienes les aprecian.

### Memoria episódica (`social/store.ts`)
- **Semivida** según el tipo de recuerdo, los rasgos del dueño (lo negativo dura más con ego, necesidad de reconocimiento y temperamento volátil) y lo público que fue.
- **Poda**: mensual, y como máximo 40 recuerdos vivos por jugador.
- **Recuerdos que se crean**:
  - quedarse fuera esperando ser titular, o un cambio pronto;
  - promesas hechas, cumplidas, rotas o renegociadas;
  - capitanía dada o quitada, y papeles dados o quitados;
  - charlas buenas y malas, y escalones de ego.

### Dinámicas de ego (`social/ego.ts`, §5.3–5.4)
- **Motor genérico**: detectar → acumular → escalera común (0,25 / 0,45 / 0,65 / 0,8 / 0,95).
- **Canal según rasgos**: en privado, la camarilla, el agente, las redes o en público.
- **Escalones**:
  - cada uno deja aviso en el buzón y evento;
  - desde el segundo, también recuerdo;
  - en el cuarto: queja pública, baja de moral y, entre gallos, bronca con el vestuario tomando partido;
  - el quinto es la petición de salida (`transferRequest`, para el mercado de la Fase 6).
- **Habituación** (`HABITUATION`): con el disparador activo, dT = Δ − H·T. Un agravio que persiste se estabiliza en Δ/H; solo los caracteres extremos o los líderes llegan a los últimos escalones.
- **Celos salariales**:
  - solo de quien juega con regularidad;
  - la lealtad amortigua (1 − 0,8·lealtad) y la necesidad de reconocimiento pesa 0,7 + 0,6·rec (calibrado con los escenarios);
  - la diferencia salarial cuenta como mucho +60 %;
  - se desactiva al renovar al 90 % del mejor pagado, o con una charla de rol que acaba en promesa de renovación.
- **Estatus**: brecha esperado–percibido. Más rápida con inseguridad y con una promesa de minutos en riesgo; no cuenta mientras está lesionado.
- **Dos gallos**:
  - mismo puesto ofensivo exacto y los dos juegan;
  - o uno tira los penaltis o las faltas y el otro también sabría;
  - o uno es capitán y el otro, líder.
  - Los roles pactados (`agreeRoles`) los separan.

### Promesas (`social/commitments.ts`)
- **Origen**: toda promesa de una conversación crea un `Commitment` con su acción enlazada (minutos, papel, capitanía, renovación, mentor).
- **Seguimiento semanal**: medición; aviso de riesgo; las de acción puntual se cumplen al hacerla y las de minutos se juzgan al vencer.
- **Romperla**: recuerdo fuerte y −0,35 de confianza. Si había testigos, ellos también lo recuerdan y confían menos.
- **Renegociarla**: cuesta menos que romperla.

### Conversaciones y decisiones
- **Conversación** (`talk`, una por semana con cada jugador): elogiar, exigir, explicar su papel, prometer minutos, papel o renovación, o pactar roles entre dos gallos.
- **Quién decide**: el jugador, según la autoridad del mánager (reputación relativa y confianza), su ego y su inseguridad. La UI solo muestra si parece receptivo.
- **Decisiones**: capitán, lanzador de penaltis o faltas (también fija el plan táctico) y renovación.
- **Añadido en la revisión** (petición del usuario: «presentarme al equipo, decirles mi plan, escuchar si están de acuerdo; pedirles que me apoyen con la táctica y mediar los minutos»):
  - **Reunión con la plantilla** (`teamMeeting`; la primera es la presentación; después, como mucho una cada 28 días). El mánager anuncia:
    - un estilo (posesión, contragolpe, presión, directo, defensivo);
    - un objetivo (liga, Europa, mitad alta, salvarse, cantera);
    - una forma de llevar el grupo (disciplina, libertad, meritocracia, jerarquía).

    Cada jugador reacciona de acuerdo, con dudas o en contra según:
    - si el estilo le va a sus habilidades;
    - si el objetivo está a la altura del club (el ambicioso quiere apuntar alto; nadie se cree uno desmesurado);
    - su carácter frente a la forma de gestionar;
    - la confianza y la autoridad.

    Los líderes arrastran a su camarilla y el más influyente habla por el grupo. Deja confianza, moral y un recuerdo (`teamMeeting`). La UI explica qué pesó más en cada uno, sin números.
  - **Pedir apoyo a la táctica** (tema `askSupport`): lo concede más quien juega en su sitio, juega a menudo y salió convencido de la reunión. Si dice que sí, durante 90 días cumple mejor las instrucciones (+ autoridad) y queda el recuerdo `backsTactic`. Si es líder, sus compañeros de grupo confían algo más en el mánager.
  - **Negociar minutos**: el jugador pide una cuota de titularidades según el estatus que cree merecer y su ego (la UI la muestra: es lo que dice él, no un rasgo oculto).
    - Si la oferta llega, hay promesa.
    - Si se queda algo corta, contraoferta con el punto medio (no gasta la conversación de la semana).
    - Si es muy corta, se siente menospreciado: pierde confianza y queda el recuerdo `lowballed`.
  - Estado: `DressingRoom.meetings` y `DressingRoom.buyIn` (SAVE_VERSION 5, migración v4 → v5).

### Encaje (`social/fit.ts`, §5.5)
- **Componentes**: táctico (familiaridad con el dibujo), cultural (idioma, compatriota, adaptabilidad), social (cómo le ven) y con el mánager (confianza).
- **Efecto**: ±5 % de rendimiento en partido y más felicidad. Solo en clubes con vestuario: el resto del mundo no cambia.

### Rendimiento (§2.2)
- El desarrollo mensual se reparte por días del mes (`devDayOf`).
- La caché de capacidad se invalida por jugador.
- Con humanos en la partida, el motor completo se reserva a sus partidos y a las selecciones con jugadores suyos.
- Medidas en `docs/balance/fase4.md`.

### UI de depuración
- **Vestuario**: tomar el mando, camarillas, jerarquía, ánimo, confianza, encaje, papel, preocupaciones y promesas.
- **Buzón**.
- **Ficha del jugador**: relaciones, recuerdos, encaje, conversación y decisiones.

## 11. Ideas incorporadas (pendientes de su fase)

### 11.1 Contratos avanzados (Fase 6 — economía y mercado)
Todo contrato y traspaso es un objeto con cláusulas que el motor ejecuta y recuerda (igual que los `Commitment`):

| Cláusula | Qué hace el motor |
|---|---|
| **Recompra por años** (*buy-back*) | Precio distinto por temporada (p. ej. 20 M el 1.er año, 25 M el 2.º, expira el 3.º). El club vendedor puede ejecutarla en cualquier ventana; el comprador no puede negarse |
| **Pagos a plazos** | Calendario de pagos con fechas e importes; afecta a la caja de ambos clubes. Impago → deuda, sanción federativa, conflicto con la directiva |
| Porcentaje de futura venta | Se liquida automáticamente en el siguiente traspaso |
| Cláusula de rescisión | General o solo para clubes extranjeros / de liga superior |
| Bonus por objetivos | Partidos, goles, títulos, clasificación europea, internacionalidad |
| Cesión con opción u obligación de compra | Obligación condicionada (p. ej. si juega el 50 % de los partidos o si el club se salva) |
| Subidas salariales anuales y por ascenso, rebaja por descenso | Se aplican al cambiar de temporada |
| Cláusula de salida en descenso | El jugador puede marcharse por un precio fijo si su club baja |

Las cláusulas también alimentan el ego (§5): un jugador sabe cuánto vale su cláusula comparada con la del compañero.

- **Valor frente a precio** (petición del usuario, Fase 4):
  - el valor estimado (`marketValue`, visible desde la Fase 4) es solo una referencia;
  - lo que pide el club vendedor y lo que acaba pagando el comprador va casi siempre por encima: necesidad, rivalidad entre compradores, años de contrato, «impuesto» a los clubes ricos y a los compradores humanos;
  - la negociación partirá del valor, pero el precio de cierre lo deciden las partes.
- **Salario aceptado**: quien firma o renueva acepta su salario. No se queja de él en un año, salvo que después llegue o renueve un compañero que cobre más (implementado en la Fase 4, `SALARY_CONTENT_DAYS`).

### 11.2 Roles jugables: entrenador, director deportivo y presidente
Los cargos del club son puestos que ocupa **un actor** (el jugador humano o una IA con personalidad y memoria):

| Rol | Foco de su semana | Decide |
|---|---|---|
| **Entrenador** (actual) | Entrenamiento, alineaciones, vestuario, prensa | Táctica, minutos, conversaciones, peticiones de fichajes |
| **Director deportivo** | Mercado, ojeadores, renovaciones, cantera, relación con el entrenador | Fichajes y ventas dentro del presupuesto, cláusulas, contratar/despedir al entrenador (si el presidente le da poder) |
| **Presidente** | Finanzas, patrocinios, estadio, socios y afición, directiva | Presupuestos, nombrar director deportivo y entrenador, inversiones, deuda, venta del club |

- **Procesos de acceso**:
  - Entrenador → ofertas de director deportivo según reputación y conocimiento del club.
  - En clubes de socios (modelo Real Madrid o Barcelona), el presidente se elige: campaña, avales, promesas electorales (que se convierten en `Commitment`s), votación de los socios por segmentos (§8).
  - En clubes de propietario, el presidente llega por compra o nombramiento.
  - Se puede perder el cargo: moción de censura, elecciones, despido o venta del club.
- **El resto de cargos los ocupa la IA** y reacciona según su personalidad y memoria. Un presidente impaciente despide al entrenador; si tú eres el presidente y despides a un entrenador querido, el vestuario y la afición lo recuerdan.
- **Arquitectura (decisión temprana para no rehacer)**: cada `Command` del usuario se valida contra los **permisos del cargo** que ocupa en su club (matriz de autoridad). Pertenece a la Fase 4 (comandos) y la Fase 6 (directiva). Los modos de director deportivo y presidente jugables completos llegan como **Fase 11** tras el juego base. *(Orden confirmado por el usuario al empezar la Fase 2.)*

### 11.3 Multijugador asíncrono (Fase 8; preparación en la Fase 4)
Decisiones del usuario: **2–10 humanos** por partida, **servidor propio** (en la nube o en un mini PC) y avance **hasta el próximo partido de cualquier humano**, sin que un partido posterior bloquee a uno anterior.

- **Un mundo, un servidor autoritativo.**
  - El servidor ejecuta el mismo `packages/core` y guarda un **registro de comandos de solo añadir** más instantáneas periódicas del mundo.
  - Los clientes (PWA o Tauri) piden vistas y envían comandos; nunca tienen la copia oficial.
  - Cada humano dirige un club. Cada `Command` lleva su autor y se valida contra su cargo (§11.2).
- **Órdenes por partido.**
  - Cada humano entrega sus órdenes para su próximo partido cuando quiera: once, táctica, balón parado, instrucciones y planes condicionales («si a los 70' perdemos…»).
  - Las órdenes se pueden editar hasta que se simula el día de ese partido.
  - Lo que no fija lo completa su asistente con sus directrices (Fase 5). Si un lesionado del viernes estaba en el once del domingo, lo cubre el asistente según el plan.
- **Avance por días con espera selectiva.**
  - El servidor avanza día a día. Para simular el día D solo espera a los humanos que **juegan el día D**.
  - Quien juega el domingo puede dejar listo su partido antes que quien juega el viernes, y el viernes no espera por él.
  - Los días sin partidos humanos se simulan solos hasta el siguiente.
  - Los comandos que no son de partido (fichajes, charlas, prensa) se aplican en el día del mundo en que se envían, y los conflictos (dos ofertas por el mismo jugador) se resuelven en el tick diario con orden determinista.
- **Plazos y avisos.**
  - Cada partido humano tiene un plazo configurable por la sala (p. ej. 24–48 h desde que pasa a ser el siguiente). Al vencer, juega el asistente con las directrices guardadas.
  - Notificaciones por web push, correo o bot de Telegram/Discord: «Stefan ya dejó listo su partido del domingo», «Faltáis tú y Ana para el viernes», «Ya se jugó la jornada».
- **Anti-repetición («no salvarse el pellejo»).**
  - Cada partido se simula **una vez** en el servidor y su resultado es definitivo. Ver el partido es reproducir los fotogramas ya calculados.
  - **El azar se fija después del cierre.** La semilla de cada día es `hash(semilla del mundo, sal del día, id del partido)`. La sal es un secreto que el servidor genera al cerrar el día y publica después. Sin ella nadie puede simular en casa su partido con distintas tácticas antes de decidir (ataque de oráculo). En un jugador, la sal está vacía y nada cambia.
  - Las órdenes cerradas quedan selladas con hora y forman parte del registro.
  - **Auditoría**: con la semilla, las sales publicadas y el registro de comandos, cualquiera puede reproducir el mundo y comprobar que nadie hizo trampa.
  - Variante para un jugador: **modo a hierro**. Autoguardado al cerrar las órdenes; recargar no cambia el resultado.
- **Despliegue.**
  - Una imagen Docker con servidor Node + SQLite (Postgres opcional).
  - Corre igual en la nube o en un mini PC de casa, expuesto con un túnel (Cloudflare Tunnel o Tailscale).
  - Copias de seguridad del registro.
- **Preparación en la Fase 4** (barato ahora, caro después):
  - autor en cada `Command`;
  - `World.managers` (varios humanos, cada uno con su club y cargo);
  - la sal de turno en la derivación de semillas de partido (vacía por defecto, sin cambiar el hash de un jugador).

### 11.4 Redes sociales, polémica y disciplina (Fase 5)
- **Plataformas ficticias** con nombres genéricos (sin marcas): una red de mensajes cortos, una de fotos, periódicos deportivos, tertulias de radio y TV y foros de aficionados. Con un paquete real se pueden renombrar.
- **Quién publica**, siempre según su perfil y su memoria:
  - jugadores: el suplente con ego publica un indirecto, el polémico da «me gusta» a una crítica contra su técnico o a un rival que lo pretende;
  - aficionados por segmentos, con tendencias y etiquetas;
  - periodistas con línea editorial, fuentes y memoria;
  - técnicos y directivos rivales;
  - **el propio usuario**: lo que publica es una declaración, con compromisos, contradicciones y narrativas (§6).
- **Origen de la polémica**:
  - El motor de partido registra **decisiones dudosas con evidencia**: penalti no pitado, roja al límite, fuera de juego ajustado. Cada una lleva su grado de claridad, y la opinión de cada actor depende de la evidencia y de sus colores. Se puede adelantar al motor en cuanto convenga, porque no cambia resultados.
  - La viralidad depende del jugo del tema, de quién lo dice, de la rivalidad y de la memoria (un árbitro que ya «te perjudicó» antes).
- **Árbitros y comités**:
  - El colectivo arbitral recuerda las críticas: comunicados, tensión con el árbitro aludido y actas más duras. **Nunca arbitraje sesgado a propósito**: el árbitro no pita en tu contra por venganza.
  - El **comité de disciplina** sigue un proceso: acta → expediente → alegaciones del usuario → sanción → recurso. Sanciones posibles: multas, partidos sin banquillo, sanciones a jugadores por publicaciones y cierre parcial del estadio.
  - Toda sanción enlaza los hechos que la causaron.
- **Consecuencias por cargo**:
  - Entrenador: autoridad en el vestuario (afecta a la aceptación de instrucciones), confianza de la directiva y relación con prensa y árbitros.
  - Director deportivo: juicio público de fichajes, filtraciones y presión de representantes.
  - Presidente: ánimo de los socios, patrocinadores, mociones de censura y elecciones.
  - Jugadores: moral, valor de mercado y relaciones.
- **Reglas que se mantienen**:
  - El motor decide quién publica, sobre qué, con qué tono y cuánto se difunde; las plantillas o el LLM opcional solo redactan (regla 4).
  - Todo deja huella (regla 5).
  - Nunca números ocultos en pantalla: «la afición está dividida», no un porcentaje (regla 6).

