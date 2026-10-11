# Vestuario — Documento de visión (original)

> Texto original del encargo, conservado como referencia. Las decisiones técnicas derivadas están en `docs/DISEÑO.md`.

## 1. Visión

Un juego de gestión de fútbol donde **los números importan, pero las personas importan más**. Football Manager es excelente en profundidad táctica y base de datos, pero su comunidad lleva años señalando las mismas debilidades. Este juego nace para resolverlas:

| Queja recurrente de la comunidad de FM | Cómo la resolvemos aquí |
|---|---|
| Ruedas de prensa repetitivas: las mismas ~10 preguntas cada semana, siempre las mismas 5 respuestas | Preguntas generadas por contexto real (rachas, polémicas, rumores, declaraciones previas). Ninguna pregunta se repite dentro de una temporada salvo que el contexto lo justifique (sección 6) |
| Se puede "spamear" la segunda respuesta positiva sin pensar | Las respuestas se evalúan contra la personalidad de cada jugador aludido, el estado del vestuario y lo que dijiste antes. La coherencia (o hipocresía) se recuerda |
| Prometes cosas en prensa y luego no existe forma de ejecutarlo | **Toda promesa crea una tarea rastreable** con fecha límite y consecuencias (sección 5.6) |
| No puedes quejarte del árbitro aunque te anulen 3 goles | Sistema de quejas arbitrales con riesgo/recompensa |
| El asistente en prensa dice cosas que no querías | Delegación con **directrices explícitas** y reporte de lo que dijo |
| El potencial se "lee" con herramientas externas y mata el misterio | El potencial **no es un número fijo**: es un rango probabilístico que evoluciona (sección 4) |
| Un jugador rinde distinto en club A que en club B, y eso se siente poco | Sistema de **encaje** (sección 5.4) |
| UI saturada, textos superpuestos, difícil de leer | UI densa pero legible, personalizable, con escala tipográfica real (sección 9) |
| Motor de partido con comportamientos ilógicos y exploits tácticos | Pruebas de balance automatizadas + detector de exploits (sección 11) |
| Caras de jugadores generados que no aparecen | Retratos generados para cada jugador (sección 10) |
| Pocas opciones de vida personal del mánager | Carrera del mánager con idiomas, licencias, especialización, reputación, vida personal (sección 7) |
| Interacción con afición y redes sociales superficial | Ecosistema de medios y redes con memoria, narrativas y facciones (sección 8) |

## 2. Stack técnico (propuesto)

- TypeScript estricto. Núcleo `/core` en TS puro, ejecutable en Web Worker y Node.
- UI React + Vite (o Svelte justificado), mobile-first, PWA.
- IndexedDB (Dexie) con guardados versionados y migraciones.
- RNG con semilla (`pcg32` o `xoshiro128**`), un stream por subsistema.
- Vitest + scripts de simulación masiva en Node.
- `DialogueProvider`: (a) plantillas + gramática procedural por defecto, (b) LLM opcional. El LLM nunca decide resultados.
- Build estático.

## 3. Modelo del jugador

### 3.1 Atributos visibles (1–20)
- **Técnicos:** primer toque, pase corto, pase largo, centros, regate, remate, cabeceo, tiro lejano, penaltis, faltas, entradas, marcaje, técnica.
- **Mentales:** anticipación, decisiones, visión, posicionamiento, desmarque, concentración, compostura, trabajo en equipo, valentía, liderazgo, agresividad, sacrificio, creatividad.
- **Físicos:** aceleración, velocidad, resistencia, fuerza, agilidad, equilibrio, salto, recuperación física.
- **Porteros:** reflejos, mano a mano, juego aéreo, blocaje, saque, juego con los pies, comunicación, colocación.

### 3.2 Atributos ocultos
Consistencia, partidos grandes, propensión a lesiones, versatilidad, deportividad, adaptabilidad, presión, profesionalismo, ambición, lealtad, temperamento, controversia.

### 3.3 Perfil psicológico (0–1, con correlaciones realistas)
Ego, necesidad de reconocimiento, inseguridad, competitividad, lealtad, ambición, profesionalismo, temperamento, sociabilidad, influencia, mentalidad de crecimiento, vida extradeportiva.
Arquetipos legibles derivados (no rígidos): Líder silencioso, Estrella mediática, Diva, Profesional modélico, Mercenario, Hijo del club, Talento problemático, Veterano mentor, Joven hambriento, Lobo solitario.

### 3.4 Estado emocional dinámico
Moral, confianza por zona, felicidad en el club, fatiga mental, sentido de estatus. Memoria episódica con intensidad y decaimiento dependiente de rasgos.

## 4. Crecimiento y potencial
- Sin PA fijo: techo latente como distribución que se estrecha y desplaza; puede subir o bajar según entorno.
- Ojeadores reportan rangos con confianza y pueden discrepar.
- Fuentes de mejora: minutos (la mayor), entrenamiento, individual, mentoría, cesiones. La brecha determina velocidad, no la garantiza. Curvas por tipo de atributo. Ventanas críticas 16–21. Perfiles de maduración precoz/tardío/constante. Regresión por edad, lesiones, falta de minutos, mala vida. Reconversión de posición con resistencia según ego.
- Mentoría que transfiere rasgos y hábitos (también malos), dependiente de compatibilidad.
- Gráficas de evolución y del rango estimado; informe del entrenador que explique el porqué.

## 5. Ego, vestuario y comportamiento
- **5.1** Grafo social (−1 a +1 con historia: afinidad, rivalidad, respeto, envidia), camarillas emergentes por clustering, jerarquía semanal.
- **5.2** Dinámicas: dos gallos en el mismo corral; celos salariales; estatus prometido vs. real; reacción a sustituciones; penal de la discordia; filtraciones; contagio emocional; celebraciones y desplantes; huelga de brazos caídos; redención; el agente como actor; vida personal (tono respetuoso).
- **5.3** Capitán formal vs. líder real; quitar la capitanía es evento mayor.
- **5.4** Encaje táctico, cultural, social y con el mánager, visible con explicación; modifica rendimiento, desarrollo y felicidad.
- **5.5** Conversaciones por intención + tono + contexto; respuesta según rasgos, estado, memoria y relación; pueden escalar.
- **5.6** Promesas rastreables obligatorias: quién, qué, plazo, métrica; panel con semáforo; romperlas daña la confianza de todo el vestuario.

## 6. Medios, prensa y árbitros
Preguntas desde un tablero de narrativas vivo; periodistas con personalidad y agenda; memoria de declaraciones; juego mental con rivales; quejas arbitrales con consecuencias; delegación con directrices; ruedas de prensa cortas por defecto (2–4 preguntas), largas en partidos grandes o crisis.

## 7. Carrera del mánager
Trasfondo inicial; atributos que crecen; idiomas; licencias; inicio flexible (juveniles, segunda, club grande); rol según el club (mánager total vs. entrenador con director deportivo); vida personal ligera, ofertas que manejar con discreción.

## 8. Mundo vivo
Directiva con facciones; afición segmentada (ultras, socios veteranos, casual, internacional); redes sociales con indirectas, tendencias y memes; economía realista (taquilla, TV, patrocinios, traspasos, FFP, pagos aplazados, cláusulas, bonus); mercado con IA de clubes creíble; ligas reales en tamaño, ascensos, copas, continentales, selecciones; base de datos ficticia con editor e importación comunitaria.

## 9. UI / UX
Interfaz excelente; sin solapamientos en 360/768/1440 px; escala tipográfica real (modo TV); paneles personalizables; bandeja inteligente accionable; "¿Por qué?" en todo número importante; mapa del vestuario; modo rápido y profundo; contraste AA, teclado, modo daltónico.

## 10. Arte y assets con IA
Módulo `/tools/assets` que genera prompts (modelo elegido consultando la API del proveedor, no de memoria) con caché local. Reglas: lenguaje natural en oraciones completas, específico, sujeto nombrado directamente, texto entre comillas dobles, descripción canónica reutilizada literalmente para consistencia y envejecimiento, iterar, respetar la relación de aspecto. Plantillas de retrato, envejecimiento, escudo (idealmente SVG) y estadio. Respaldo procedural en SVG para que ningún jugador quede sin cara.

## 11. Calidad, balance y anti-exploits
`npm run sim -- --seasons=20 --seed=123`. Rangos: goles/partido 2,5–2,9; victorias locales 42–47 %; empates 24–28 %; goleadores con cola larga; 0,1–0,2 rojas/partido; lesiones creíbles. Detector de exploits con tácticas extremas. Sin inflación de talento en 20 temporadas. Escenarios de comportamiento guionizados. Rendimiento: día < 200 ms en móvil medio; temporada < 60 s en escritorio. Guardados versionados sin romper partidas.

## 12. Roadmap
1 Núcleo · 2 Motor de partido · 3 Desarrollo · 4 Vestuario y ego · 5 Medios · 6 Mundo · 7 UI completa · 8 Assets e IA · 9 Pulido (criterios en `docs/DISEÑO.md` §7).

## 13. Lo que NO se quiere
Clones de pantallas de FM; rasgos ocultos legibles trivialmente; diálogos de plantilla repetida; un LLM que decida resultados; nombres, escudos o imágenes reales en la base por defecto.
