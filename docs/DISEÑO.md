# Vestuario — Documento de diseño técnico

> Versión 0.1 · Plan inicial previo a escribir código.
> Fuente: el documento de visión original (secciones 1–14). Aquí se convierte en arquitectura, modelo de datos, algoritmos y plan de fases.
> Las decisiones marcadas **[PENDIENTE]** dependen de las dudas de la §9.

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
- Test de balance (Fase 3): en 20 temporadas, el percentil 99, 95 y 50 de CA de todo el mundo y el nº de jugadores con CA ≥ 16 deben quedar dentro de ±8 % del año 1.
- La deriva del techo es de media cero en un entorno "promedio" (env = 0.5); solo entornos por encima/debajo de la media lo desplazan.

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
| **1. Núcleo** | Monorepo, RNG, tipos, tiempo/calendario, generación de mundo, fixtures, serialización, CLI `gen` | Mismo seed → mismo hash del mundo (en Node y en navegador); seeds distintos → mundos distintos; ≥ 90 % cobertura en `rng`, `gen`, `competition`; generación de mundo de referencia < 3 s en escritorio; distribuciones de rasgos/atributos dentro de rangos objetivo |
| **2. Motor de partido** | Motor por eventos, tácticas básicas, cambios, tarjetas, lesiones, modelo rápido, CLI `sim` | 20 temporadas: goles/partido 2,5–2,9; local 42–47 %; empates 24–28 %; rojas 0,1–0,2; goleadores con cola larga; partido reproducible por `seedPath`; motor rápido dentro de ±3 % del completo en esas métricas |
| **3. Desarrollo** | Techo latente, crecimiento, entrenamiento, mentoría (atributos), ojeadores | 20 temporadas sin inflación (±8 % en P50/P95/P99 y nº de élite); dos ojeadores discrepan en ≥ 30 % de jóvenes; informe "por qué" presente en todo cambio de CA ≥ 0.3 |
| **4. Vestuario y ego** | Grafo, camarillas, jerarquía, estado emocional, memoria episódica, 3 dinámicas, `Commitment`s, encaje, conversaciones | Escenarios guionizados dentro de rango en ≥ 200 semillas; cada promesa de prensa/conversación crea `Commitment` con acción enlazada; avance de día < 200 ms (perfil móvil simulado con CPU ×4 throttling) |
| **5. Medios** | Narrativas, periodistas, prensa contextual, quejas arbitrales, delegación con directrices | 0 preguntas repetidas en una temporada sin hecho nuevo (test automático en 20 temporadas); el asistente nunca viola una directriz |
| **6. Mundo** | Economía, mercado, IA de clubes, directiva, afición, redes | Sin traspasos absurdos (detector: precio vs. valor, encaje con necesidad, presupuesto) en 20 temporadas; FFP respetado por la IA |
| **7. UI completa** | Todas las pantallas, mapa del vestuario, paneles, accesibilidad | Tests visuales Playwright sin solapamientos en 360/768/1440 px; axe sin violaciones AA; navegación completa por teclado |
| **8. Assets e IA** | Prompts de imagen, caché, retratos SVG, `LlmProvider` | Todo jugador tiene cara; juego 100 % offline sin proveedor |
| **9. Pulido** | Tutoriales, logros, editor de BD, balance final | 3 temporadas jugadas sin bugs bloqueantes |

> Propuesta: adelantar a la Fase 2 una **UI mínima de depuración** (lista de jugadores, tabla, resultados) para poder ver el mundo desde el principio. No sustituye a la Fase 7.

---

## 8. Plan detallado de la Fase 1

### Tareas

1. **Andamiaje**
   - npm workspaces, `tsconfig.base.json` estricto, ESLint (regla que prohíbe `Math.random`/`Date` en `packages/core`), Prettier, Vitest con cobertura, scripts raíz (`test`, `typecheck`, `lint`, `gen`).
   - CI de GitHub Actions: typecheck + lint + test + test de determinismo.
2. **RNG** (`core/rng`)
   - `splitmix32`, `xoshiro128**`, `fork(path)` por hash FNV-1a/murmur del path, serializar/restaurar estado.
   - Distribuciones (§2.4) incluida normal multivariante por Cholesky.
   - Tests: vectores conocidos, independencia de streams (añadir tiradas en A no altera B), propiedades estadísticas básicas (media/varianza en 1e6 muestras).
3. **Tipos del dominio** (`core/types`) según §3, con los campos de fases futuras como opcionales o stubs mínimos para no migrar pronto.
4. **Tiempo** (`core/time`)
   - `GameDay`, conversión a fecha de calendario ficticia (año/mes/día, semanas con jornadas en fin de semana y entre semana), definición de temporada, ventanas de fichajes, parón de selecciones.
5. **Datos ficticios** (`packages/data`)
   - Naciones e idiomas **[PENDIENTE: reales o ficticias]**, generadores de nombres por cultura (sílabas + listas), ciudades ficticias, climas, plantillas de nombres de club ("Atlético {Ciudad}", "{Ciudad} FC", "Real Unión {Ciudad}"...).
6. **Generación de mundo** (`core/gen`)
   - Naciones → pirámides de ligas (tamaños reales: 18–20 equipos por división) → clubes (reputación con distribución de cola larga, colores, identidad, finanzas iniciales, instalaciones, estadio) → plantillas (25–30 por club, por necesidades posicionales) → staff (entrenadores, ojeadores, árbitros).
   - Jugador: posición → plantilla de atributos por rol + ruido + `shape`; edad por distribución realista por división; `PsychProfile` correlacionado (§3.1); ocultos derivados; `DevelopmentState` inicial (§4.2); idiomas; contrato; apariencia canónica (para §10).
   - Arquetipos semilla garantizados por club/liga.
7. **Competiciones** (`core/competition`)
   - Fixtures liga ida/vuelta (método de Berger, equilibrio local/visitante), copa nacional por eliminatorias con sorteo, tabla y desempates, reglas de ascenso/descenso (aplicación al final de temporada; sin partidos aún).
8. **Mundo y serialización** (`core/world`)
   - IDs deterministas, `World`, `WorldEvent` base + reductor, serialización estable (claves ordenadas) + **hash** (xxhash/FNV-64) del mundo.
9. **Motor de ticks mínimo** (`core/engine`)
   - Avanzar día: procesar calendario (marcar partidos como "pendientes de motor" en Fase 1), cumpleaños, fin de temporada (ascensos, rollover, nuevo calendario). Permite avanzar temporadas vacías → base para la Fase 2.
10. **Views mínimas** (`core/views`) — arquetipo legible, edad, CA derivada, resumen de club: valida que la separación núcleo/UI funciona.
11. **CLI** (`tools/gen`): `npm run gen -- --seed=123 [--out=world.json] [--stats]` imprime hash y estadísticas (distribución de CA, edades, arquetipos, reputaciones).
12. **Tests de aceptación de la Fase 1**
    - Determinismo: 2 ejecuciones del mismo seed → hash idéntico; snapshot del hash de `seed=123`; mismo hash en Node y en un test de navegador (Vitest browser mode o Playwright).
    - Sensibilidad: 100 seeds → 100 hashes distintos.
    - Distribuciones: edad media por división, % de cada arquetipo, correlaciones empíricas de rasgos dentro de ±0.05 de la matriz objetivo.
    - Calendario: cada equipo juega 2× contra cada rival, ningún equipo juega 2 veces el mismo día, alternancia local/visitante equilibrada.
    - Rendimiento: generar mundo de referencia < 3 s.
13. **Cierre**: `docs/CHANGELOG.md` con resumen de la fase e informe de estadísticas en `docs/balance/fase1.md`.

### Mundo de referencia propuesto para v1 **[PENDIENTE]**
4 naciones jugables × 2 divisiones (≈ 150 clubes, ≈ 4.200 jugadores) + copa nacional en cada una. Las competiciones continentales y selecciones llegan en la Fase 6.

---

## 9. Dudas abiertas

1. **Naciones**: ¿países e idiomas reales (con clubes, ciudades y jugadores ficticios) o mundo totalmente ficticio? *Recomendación*: reales. El sistema de idiomas/cultura/saudade gana mucho con referencias reconocibles y no hay problema de licencias con nombres de países.
2. **Tamaño del mundo de la v1**: ¿4 naciones × 2 divisiones te parece bien como base, o quieres empezar más pequeño (1 nación, 3 divisiones, inicio en juveniles incluido)?
3. **UI**: React + Vite confirmado salvo que prefieras Svelte. *Recomendación*: React (ecosistema de accesibilidad, gráficas y testing más maduro).
4. **Motor de partido**: ¿basta con simulación por zonas + texto/estadísticas + una vista 2D esquemática simple, o quieres desde el principio un visor 2D con jugadores moviéndose? Lo segundo multiplica el coste de la Fase 2.
5. **Idioma**: código en inglés, comentarios y docs en español, UI en español con i18n preparado. ¿De acuerdo? ¿Qué otros idiomas de UI te interesan?
6. **Plataforma**: ¿solo PWA (navegador/móvil) o también empaquetado de escritorio (Tauri) más adelante?
7. **Nombre**: el repo se llama `T-cticas-Football`; ¿mantenemos "Vestuario" como nombre de trabajo en código y UI?
8. **Rasgos ocultos en el save**: propongo MessagePack + compresión (no legible a simple vista, pero no cifrado). ¿Suficiente, o quieres ofuscación más fuerte?
9. **Ritmo de entrega**: ¿cierro cada fase con un PR para que lo revises, o trabajo en una rama larga y te aviso al cerrar cada fase?
