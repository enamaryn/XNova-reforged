# FAQ del juego — XNova Reforged

> Versión `v0.2.0` (alfa privada). Esta FAQ describe lo que el juego hace **realmente** hoy, según el código y pruebas en un servidor de prueba; cuando algo que muestra la interfaz no hace lo que dice su texto, se indica claramente (⚠️). Idiomas: [Français](FAQ.md) · [English](FAQ_EN.md) · [Español](FAQ_ES.md) · [Deutsch](FAQ_DE.md) · [Italiano](FAQ_IT.md). Para el desarrollo de una partida, véase la [guía del jugador](PLAYER_GUIDE_ES.md).
>
> **Nombres en el juego.** Los nombres y descripciones de edificios, naves y tecnologías se muestran todavía **en francés** sea cual sea el idioma elegido. Esta FAQ da el significado en español seguido del nombre que verá en el juego, en *cursiva*.

**Índice**: [1. Lo básico](#1-lo-básico) · [2. Edificios](#2-edificios) · [3. Energía y satélites solares](#3-energía-y-satélites-solares) · [4. Investigación](#4-investigación) · [5. Naves](#5-naves) · [6. Flotas y misiones](#6-flotas-y-misiones) · [7. Combate](#7-combate) · [8. Defensa](#8-defensa) · [9. Poder, comandante y clasificación](#9-poder-comandante-y-clasificación) · [10. «¿Por qué no puedo…?»](#10-por-qué-no-puedo) · [11. Lo que aún no existe](#11-lo-que-aún-no-existe)

---

## 1. Lo básico

**¿Cuáles son los tres recursos?**
**Metal** (edificios, naves, defensas), **cristal** (laboratorio, investigaciones, naves, electrónica) y **deuterio** (combustible de las flotas, laboratorio, la mayoría de las investigaciones). Empieza con 500 de metal, 500 de cristal y 0 de deuterio: el sintetizador de deuterio es, por tanto, una prioridad.

**¿Por qué todo va tan rápido (o tan lento)?**
Los costes son los del juego original; lo que cambia las duraciones y la producción es la **velocidad del servidor**. El perfil de referencia es **×50**: la producción se multiplica por 50 y todas las duraciones (edificios, investigaciones, naves, vuelos) se dividen por 50. En un servidor ×1 todo es unas 50 veces más lento. Los costes no cambian.

**¿Cuánto tarda la primera nave a ×50?**
Unas 1 h 50 min para un jugador que solo gasta lo que produce (laboratorio ≈ 22 min, primera investigación ≈ 1 h, hangar ≈ 1 h 05).

**¿Mis recursos siguen creciendo sin conexión?**
Sí: la producción se calcula sobre el tiempo transcurrido, esté conectado o no. Se detiene cuando el almacén está lleno.

**¿Qué es el almacenamiento y qué pasa si se llena?**
La capacidad base es de **1 000 000 por recurso**; cada nivel de almacén la multiplica por 1,5 (nivel 1: 1 500 000; nivel 5: ≈ 7,6 millones). Una reserva puede superar la capacidad como máximo un 10 %; más allá, **la producción se pierde**. Gaste antes de llenarse.

**¿Hay ingresos sin minas?**
Sí, un pequeño ingreso base por planeta (20 de metal y 10 de cristal por hora antes de multiplicar por la velocidad). Ayuda al principio.

**¿En qué idiomas está el juego?**
Francés, inglés, español, alemán e italiano (selector de la cabecera). Límite conocido: los **nombres y descripciones** de edificios, naves y tecnologías, y algunos mensajes de error, siguen en francés.

---

## 2. Edificios

**¿Para qué sirve cada edificio?**

| Edificio (nombre en el juego) | Utilidad real hoy |
|---|---|
| **Mina de metal / de cristal** (*Mine de Métal / de Cristal*) | producen metal / cristal (consumen energía) |
| **Sintetizador de deuterio** (*Synthétiseur de Deutérium*) | produce deuterio (consume más energía) |
| **Planta de energía solar** (*Centrale Électrique Solaire*) | suministra energía a las minas |
| **Planta de fusión** (*Centrale Électrique de Fusion*) | suministra más energía quemando deuterio; exige sintetizador nivel 5 y *Tecnología de energía* nivel 3; su rendimiento sube con la tecnología de energía |
| **Fábrica de robots** (*Usine de Robots*) | divide la duración de las construcciones de edificios (duración ÷ (1 + nivel)) |
| **Fábrica de nanobots** (*Usine de Nanites*) | la divide de nuevo (÷ 2 por nivel); exige robots 10 y *Computación* 10; muy cara |
| **Hangar** (*Hangar*, el astillero) | permite construir naves y defensas y las acelera; su nivel condiciona casi todos los requisitos |
| **Almacén de metal / de cristal, depósito de deuterio** (*Hangar de Métal / de Cristal, Réservoir de Deutérium*) | aumentan la capacidad de almacenamiento |
| **Laboratorio de investigación** (*Laboratoire de Recherche*) | permite investigar y lo acelera |
| **Terraformador** (*Terraformeur*) | añade 5 campos por nivel y no ocupa ningún campo; exige *Tecnología de energía* 12 |

**¿Cuánto cuesta un edificio y cómo evoluciona el coste?**
El nivel siguiente cuesta `coste base × factor^nivel actual`. Ejemplo, la mina de metal (base 60 metal / 15 cristal, factor 1,5): nivel 1 → 60 / 15; nivel 10 → 2 306 / 576. El coste se **descuenta al iniciar**.

**¿Cuánto dura una construcción?**
`30 × (metal + cristal) / (75 × (1 + robots) × 2^nanobots)` segundos, divididos después por la velocidad del servidor. Los robots y los nanobots son, pues, la inversión que acelera todo lo demás.

**¿Cuántos edificios puedo construir a la vez?**
Uno por planeta al principio; **dos** tras la investigación *Gestion des chantiers* (gestión de obras); **tres** si además tiene un comandante de nivel 50.

**¿Puedo cancelar una construcción?**
Sí, desde la cola: el importe descontado se **reembolsa exactamente**. No existe la demolición de un nivel ya construido.

**¿Qué son los «campos» de un planeta?**
Cada planeta inicial tiene **163 campos**. Cada nivel construido de un edificio (salvo los almacenes y el terraformador) consume **uno**: no podrá subirlo todo al máximo. Elija sus niveles; el **terraformador** añade 5 campos por nivel.

**¿Qué diferencia hay entre «Hangar» y el astillero?**
Es el mismo edificio (id 21): el «Hangar» de las listas es el astillero donde se construyen naves y defensas. No lo confunda con los almacenes de **recursos**.

**¿Sirve de algo el terraformador?**
Sí: cada nivel añade **5 campos** al planeta y el terraformador **no ocupa ningún campo** (exige *Tecnología de energía* 12, lo que lo reserva para el final de la partida).

**¿Por qué no veo el depósito de la alianza, la falange ni el salto cuántico?**
El depósito de la alianza depende de mantener posición, que aún no existe; la falange de sensores y la puerta de salto aún no están entregadas: no se ofrecen ni se aceptan, para que nadie invierta en un edificio sin efecto.

**¿Cómo se obtiene una luna y para qué sirve?**
Un combate contra un *planeta* puede dejar una luna en las mismas coordenadas: la probabilidad es del 1 % por cada 100 000 unidades de escombros (metal + cristal) producidas, con un máximo del 20 %. La luna pertenece al dueño del planeta atacado; un combate contra una luna no crea otra. Aparece en la Galaxia (🌙) y en el selector de planeta. Una luna **no produce nada**, ni siquiera los ingresos básicos: hay que enviarle recursos por transporte. Nace con 1 casilla; la **Base lunar** (solo en una luna) añade 3 casillas por nivel y ocupa una. También se construyen allí la fábrica de robots y el astillero, para estacionar naves y defensas. Las flotas pueden salir de una luna y apuntar a una (casilla «Apuntar a la luna» de la página Flota, botones 🌙 de la Galaxia) para transportar, desplegar, espiar o atacar; los misiles solo apuntan a planetas.

---

## 3. Energía y satélites solares

**¿Cómo funciona la energía?**
Las minas consumen energía; las plantas la producen. Mientras la producción cubra el consumo, las minas funcionan al 100 %. Si no, **todas las minas se ralentizan proporcionalmente** (producción al 50 % de la energía necesaria = 50 % de metal, cristal y deuterio). El nivel de producción y el balance de energía se muestran en la vista general.

**¿Cuánta energía produce y consume cada edificio?**
Por nivel `n`: planta solar `20 × n × 1,1^n`; planta de fusión `30 × n × (1,05 + 0,01 × Energía)^n`; consumo de la mina de metal y de cristal `10 × n × 1,1^n`, del sintetizador de deuterio `20 × n × 1,1^n`. Ejemplos: planta solar nivel 10 → 518; fusión nivel 10 → 488 (Energía 0) o 647 (Energía 3); mina de metal nivel 10 → consume 260.

**¿Qué planta elegir?**
La planta solar: barata y sin requisitos. La **planta de fusión** exige sintetizador nivel 5 y *Tecnología de energía* 3 y **quema deuterio** (`10 × n × 1,1^n` por hora, multiplicado por la velocidad del servidor), pero produce más según sube la tecnología de energía: con *Energía* 3, una fusión nivel 10 da 647 de energía frente a 518 de una solar del mismo nivel, a costa de unos 259 de deuterio por hora; con *Energía* 0 solo da 488. Compensa cuando los campos escasean y la tecnología de energía está avanzada; la solar sigue siendo mejor al principio.

**¿Dan energía los satélites solares?**
**Sí.** En cuanto se construye, un satélite solar (212: 2 000 de cristal y 500 de deuterio, construible desde el hangar nivel 1) queda **directamente en órbita del planeta** y le suministra **50 de energía** de forma permanente, además de las plantas. La energía cuenta desde la entrega: la producción del tiempo ya transcurrido no cambia. Ejemplo: 3 satélites = 150 de energía. El valor es fijo (el juego no tiene temperatura de planeta).

**¿Cuándo elegir satélites en lugar de una planta?**
Un satélite no consume **ningún campo** y no tiene requisitos, pero al principio cuesta más que una planta solar (40 de cristal y 10 de deuterio por punto de energía, frente a unas pocas unidades de metal y cristal en los primeros niveles de planta). Las plantas son mejores al inicio; los satélites compensan cuando faltan campos o cuando los niveles de planta se encarecen.

**¿Se puede enviar un satélite a otro planeta?**
**No.** Permanece en órbita del planeta donde se construyó: no aparece en la página *Flota* y el juego rechaza cualquier misión que incluya uno. Tampoco puede trasladarse mediante despliegue.

**¿Puede destruirse un satélite?**
Sí. En un planeta atacado combate junto a la defensa (casco 2 000, escudo 1, arma 1) y absorbe disparos; **un satélite destruido no se reconstruye** (solo las defensas) y la energía baja desde ese momento. Protéjalo con defensa.

**¿Qué hago si mi energía es insuficiente?**
Suba una planta solar antes de la siguiente mina. Si el nivel de producción es del 80 %, sus minas producen un 20 % menos de lo previsto.

---

## 4. Investigación

**¿Cómo funciona la investigación?**
Una sola investigación a la vez por jugador, pagada al iniciar, que exige un nivel de laboratorio y a veces otras tecnologías (se muestran en la tarjeta). El coste crece con cada nivel. Una investigación en espera puede cancelarse.

**¿Qué investigaciones tienen un efecto directo?**

| Investigación (nombre en el juego) | Efecto real hoy |
|---|---|
| **Tecnología militar** (*Technologie Militaire*, 109) | +10 % de potencia de arma **por nivel** para todas sus naves y defensas |
| **Tecnología de defensa** (*Technologie Défense*, 110) | +10 % de casco por nivel |
| **Tecnología de escudo** (*Technologie Bouclier*, 111) | +10 % de escudo por nivel |
| **Motor de combustión** (*Réacteur à Combustion*, 115) | +10 % de velocidad por nivel para carguero pequeño, cazador ligero, sonda |
| **Motor de impulso** (*Réacteur à Impulsion*, 117) | +20 % de velocidad por nivel para carguero grande, cazador pesado, colonizador, reciclador, bombardero |
| **Propulsión hiperespacial** (*Propulsion Hyperespace*, 118) | +30 % de velocidad por nivel para crucero, nave de batalla, destructor, estrella de la muerte, acorazado; +5 %/nivel de capacidad de carga para el botín de un ataque |
| **Tecnología de espionaje** (*Technologie Espionnage*, 106) | determina el detalle de los informes de espionaje (comparada con la del objetivo, véase §5) |
| **Tecnología de energía** (*Technologie Énergie*, 113) | aumenta el rendimiento de las plantas de fusión (+0,01 sobre la base de 1,05 por nivel) |
| **Tecnología de computación** (*Technologie Ordinateur*, 108) | **1 flota en vuelo de base, +1 por nivel** (véase §6) |
| **Gestión de obras** (*Gestion des chantiers*, 125) | 2.ª construcción simultánea de edificios |
| **Producción paralela** (*Production parallèle*, 126) | líneas de producción adicionales en el astillero |

**¿Y las demás?**
Hiperespacio (114), Láser (120), Iones (121), Plasma (122) y Gravitón (199) son puros **requisitos** para desbloquear edificios, naves y defensas (sus descripciones dicen «sin efecto directo»). *Energía* también aumenta el rendimiento de la fusión (véase §3). La **red de investigación intergaláctica** y la **expedición** no se ofrecen mientras no existan sus funciones.

**¿Qué investigar primero?**
*Energía* (requisito de la fusión y de varias defensas), luego el motor de combustión para transportes más rápidos, después *Militar/Defensa/Escudo* según su plan de combate.

---

## 5. Naves

**¿Dónde y cómo se construyen las naves?**
En el **hangar** (página Astillero). El pedido se paga al instante y se construye por lotes; un pedido **en espera** puede retirarse (90 % reembolsado), un lote ya iniciado termina con normalidad. La duración depende del coste y del nivel de hangar: `(metal + cristal) / (2 500 × (1 + hangar) × 2^nanobots)` **horas** por unidad, divididas por la velocidad del servidor, con un **mínimo** de `(metal + cristal) / 660` segundos a ×50 (5 s para un cazador ligero, unas 3 h 47 para una Estrella de la Muerte): hangar y nanobots nunca bajan de ahí. A ×50, un cazador ligero tarda unos 48 s sin tecnología y 5 s con todo desarrollado.

**¿Qué naves existen y para qué sirven?**

| Nave (nombre en el juego) | Coste (metal / cristal / deuterio) | Carga | Velocidad base | Arma / escudo / casco | Uso |
|---|---|---:|---:|---|---|
| **Carguero pequeño** (*Petit Transporteur*, 202) | 2 000 / 2 000 / 0 | 6 000 | 5 000 | 5 / 10 / 4 000 | transporte inicial |
| **Carguero grande** (*Grand Transporteur*, 203) | 6 000 / 6 000 / 0 | 25 000 | 7 500 | 5 / 25 / 12 000 | grandes transportes |
| **Cazador ligero** (*Chasseur Léger*, 204) | 2 500 / 800 / 0 | 50 | 12 500 | 60 / 10 / 4 000 | combate masivo barato |
| **Cazador pesado** (*Chasseur Lourd*, 205) | 6 000 / 4 000 / 0 | 100 | 10 000 | 150 / 25 / 10 000 | combate polivalente |
| **Crucero** (*Croiseur*, 206) | 18 000 / 6 000 / 2 000 | 800 | 15 000 | 400 / 50 / 27 000 | combate rápido |
| **Nave de batalla** (*Vaisseau de Bataille*, 207) | 45 000 / 15 000 / 0 | 1 500 | 10 000 | 1 000 / 200 / 60 000 | núcleo de la flota |
| **Colonizador** (*Vaisseau de Colonisation*, 208) | 10 000 / 20 000 / 10 000 | 7 500 | 2 500 | 50 / 100 / 30 000 | fundar una colonia (se consume) |
| **Reciclador** (*Recycleur*, 209) | 10 000 / 6 000 / 2 000 | 20 000 | 2 000 | 1 / 10 / 16 000 | véase más abajo |
| **Sonda de espionaje** (*Sonde d'Espionnage*, 210) | 0 / 1 000 / 0 | 0 | 50 000 | 0 / 0 / 1 000 | espionaje |
| **Bombardero** (*Bombardier*, 211) | 50 000 / 25 000 / 15 000 | 500 | 4 000 | 1 000 / 500 / 75 000 | pensado contra defensas |
| **Satélite solar** (*Satellite Solaire*, 212) | 0 / 2 000 / 500 | 0 | 0 | 1 / 1 / 2 000 | energía, permanece en órbita (§3) |
| **Destructor** (*Destructeur*, 213) | 60 000 / 50 000 / 15 000 | 2 000 | 5 000 | 2 000 / 500 / 110 000 | combate pesado |
| **Acorazado** (*Traqueur*, 215) | 30 000 / 40 000 / 15 000 | 10 000 | 10 000 | 700 / 400 / 70 000 | combate rápido |
| **Estrella de la muerte** (*Étoile de la Mort*, 214) | 5 000 000 / 4 000 000 / 1 000 000 | 1 000 000 | 100 | 200 000 / 50 000 / 9 000 000 | definitiva; exige hangar 12 y *Gravitón* |

Los requisitos (nivel de hangar y tecnologías) se muestran en cada tarjeta.

**¿Qué nave elegir para transportar?**
El carguero pequeño al principio (barato, accesible pronto), luego el grande (4× la capacidad por 3× el precio, más rápido). La carga es la suma de todas las naves enviadas.

**¿Cómo se espía?**
Con **sondas de espionaje**: la misión de espionaje solo acepta sondas. Una sonda cuesta 1 000 de cristal y vuela muy rápido; las sondas **siempre regresan** (no se destruyen) y el objetivo **no es avisado**. El detalle del informe depende de una puntuación: `puntuación = (su Espionaje − el del objetivo) + (número de sondas − 1)`. Los **recursos** siempre se ven; desde **1** se añade la **flota**, desde **3** las **defensas y edificios**, desde **5** las **tecnologías**. Ejemplo: a igual nivel, 6 sondas bastan para verlo todo.

**¿Para qué sirve el reciclador?**
Recoge los **campos de escombros**. Tras cada combate, el 30 % del metal y cristal de las **naves** destruidas (de ambos bandos, no de las defensas) queda en órbita en las coordenadas del objetivo; se acumulan de un combate a otro y aparecen en la Galaxia (botón «Reciclar»). Envíe recicladores solos con la misión **Reciclaje**: al llegar recogen hasta 20 000 unidades cada uno (metal y cristal en proporción) y regresan con lo recogido. No se puede embarcar carga; lo que sobre permanece en el campo.

**¿Tienen las naves «fuego rápido»?**
Sí. Cuando una nave alcanza un objetivo de un tipo contra el que tiene fuego rápido de valor `n`, **dispara de nuevo con probabilidad (n − 1) / n**, y así sucesivamente: de media `n` disparos contra ese tipo. Los demás objetivos no dan disparos extra. Vale también para la flota estacionada que defiende.

| Nave | Fuego rápido contra (valor) |
|---|---|
| Cazador ligero | Sonda ×5, Lanzamisiles ×10 |
| Cazador pesado | Cazador ligero ×3, Sonda ×5, Lanzamisiles ×10 |
| Crucero | Cazador ligero ×6, Sonda ×5, Lanzamisiles ×10, Láser pequeño ×10 |
| Bombardero | Lanzamisiles ×20, Láser pequeño ×20, Láser grande ×10 |
| Acorazado | Crucero ×3 |

Las demás naves (incluida por ahora la Estrella de la muerte) no tienen fuego rápido.

**¿Cómo se coloniza?**
Misión *Colonización* con un colonizador hacia una **posición libre**: se funda la colonia y la nave se consume. Máximo **21 planetas** por jugador.

---

## 6. Flotas y misiones

**¿Qué misiones existen?**
**Transporte** (entrega la carga y la flota regresa), **Despliegue** (instala flota y carga en *otro planeta suyo*, sin regreso), **Ataque**, **Espionaje**, **Colonización**, **Reciclaje** (solo recicladores, hacia un campo de escombros). Expedición, ataque en grupo, mantener posición y destruir son rechazados por el juego sin descontar nada.

**¿Cómo se calculan la duración y el combustible de un vuelo?**
Distancia: `√(Δgalaxia² × 20 000 + Δsistema² × 95 + Δposición² × 5)`. Velocidad de la flota: la de su **nave más lenta** (con las bonificaciones de motores). Duración: `(35 000 / % de velocidad) × √(distancia × 10 / velocidad) + 10` segundos, divididos por la velocidad de flota del servidor. Combustible (deuterio, descontado a la **salida**): `Σ número × consumo × (distancia / 35 000) × (velocidad / 1 000 + 1)²`. Ejemplo con 10 cargueros pequeños: mismo sistema (4 posiciones) 0 de deuterio; 10 sistemas más allá 10; otra galaxia 14. Una velocidad menor alarga el vuelo (del 10 % al 100 %).

**¿Puedo enviar varias flotas a la vez?**
Dentro de sus plazas: **1 flota en vuelo de base, más 1 por nivel de la tecnología *Computación***. Las flotas que regresan siguen contando. El contador «Flotas en vuelo: x/y» aparece en la página *Flota*, y el juego rechaza el siguiente envío cuando todas las plazas están ocupadas.

**¿Cómo se retira una flota?**
Desde *Movimientos*, mientras está en el vuelo de ida y no ha llegado: da media vuelta y el regreso dura lo mismo que el trayecto ya recorrido. Una flota que ha llegado o ya regresa no puede retirarse.

**¿Dónde veo el resultado?**
En *Informes*.

**¿Qué lleva la misión de ataque?**
También puede llevar carga, pero el botín solo ocupa el **espacio libre** que queda en las naves supervivientes.

---

## 7. Combate

**¿Cómo transcurre un combate?**
Hasta **6 rondas**. En cada ronda, cada unidad atacante y luego cada unidad defensora dispara contra una unidad enemiga **elegida al azar** (y vuelve a disparar según su **fuego rápido**, véase §5). El daño quita primero el escudo y luego el casco; una unidad sin casco queda destruida. Al final de cada ronda, **los escudos se regeneran un 70 %** de su máximo. El combate acaba cuando un bando es destruido o tras 6 rondas (empate).

**¿Qué bonificaciones de tecnología se aplican?**
*Militar* (+10 % de arma por nivel), *Defensa* (+10 % de casco), *Escudo* (+10 % de escudo), aplicadas a todas sus unidades, naves **y** defensas. Cada bando usa sus propios niveles.

**¿Quién defiende un planeta atacado?**
Las **defensas** y la **flota estacionada** en el planeta combaten juntas (incluidos los satélites solares, muy frágiles).

**¿Qué se pierde y qué se recupera?**
- Las naves destruidas se pierden.
- Las **defensas** destruidas se reconstruyen con un **70 % de probabilidad** cada una tras el combate.
- Se crea un «campo de escombros» (30 % del coste en metal y cristal de las naves perdidas), que se muestra en el informe y en la Galaxia y que los recicladores pueden recoger (§5).
- **Botín** (si gana el atacante): hasta el **50 %** de cada recurso del objetivo, limitado a la capacidad libre de las naves supervivientes.

**¿Cómo gano un combate?**
Espíe primero para conocer flota y defensas, compruebe que su carga basta para el botín y envíe una flota claramente superior (el azar influye). El escudo de una unidad absorbe disparos hasta agotarse y luego se regenera un 70 % por ronda, así que las unidades con escudos grandes encajan muchos disparos de una ronda a otra.

**¿Puedo atacar mi propio planeta?**
No. El despliegue exige uno de **sus** planetas; el ataque excluye los suyos.

---

## 8. Defensa

**¿Qué defensas puedo construir?**

| Defensa (nombre en el juego) | Coste (metal / cristal / deuterio) | Arma / escudo / casco | Requisitos principales |
|---|---|---|---|
| **Lanzamisiles** (*Lanceur de Missiles*, 401) | 2 000 / 0 / 0 | 80 / 20 / 200 | hangar 1 |
| **Láser pequeño** (*Artillerie Laser Légère*, 402) | 1 500 / 500 / 0 | 100 / 25 / 2 000 | hangar 2, Energía 2, Láser 3 |
| **Láser grande** (*Artillerie Laser Lourde*, 403) | 6 000 / 2 000 / 0 | 250 / 100 / 8 000 | hangar 4, Energía 3, Láser 6 |
| **Cañón Gauss** (*Canon de Gauss*, 404) | 20 000 / 15 000 / 2 000 | 1 100 / 200 / 35 000 | hangar 6, Energía 6, Militar 3, Escudo 1 |
| **Cañón iónico** (*Artillerie à Ions*, 405) | 2 000 / 6 000 / 0 | 150 / 500 / 8 000 | hangar 4, Iones 4 |
| **Cañón de plasma** (*Canon à Plasma*, 406) | 50 000 / 50 000 / 30 000 | 3 000 / 300 / 100 000 | hangar 8, Plasma 7 |
| **Cúpula pequeña de protección** (*Petit Bouclier*, 407) | 10 000 / 10 000 / 0 | 1 / 2 000 / 20 000 | hangar 6, Escudo 2 |
| **Cúpula grande de protección** (*Grand Bouclier*, 408) | 50 000 / 50 000 / 0 | 1 / 10 000 / 100 000 | hangar 8, Escudo 6 |

**Misiles.** El silo de misiles (hangar 1) almacena 10 misiles por nivel. El *misil de intercepción* (silo 1) derriba un misil enemigo al llegar; el *misil interplanetario* (silo 4, Motor de impulso 1) se lanza desde la página Defensa contra un planeta de la misma galaxia, hasta 5 × nivel de impulso − 1 sistemas. Cada misil que pasa causa 12 000 de daño (+10 % por nivel de Armas) a las defensas del objetivo, primero la defensa elegida y luego lanzamisiles, láseres, Gauss, iones, plasma y escudos. Los misiles no afectan ni a la flota ni a los recursos, y el daño que no basta para destruir una unidad se pierde.

**¿Son especiales los escudos planetarios?**
Sí: **uno de cada por planeta** (pequeño, grande). Tienen un escudo enorme y un casco grueso para un arma casi nula: están para **absorber** disparos.

**¿Qué defensa es la más rentable?**
Por coste, el lanzamisiles y los láseres son los más eficaces al principio; las cúpulas absorben muchos disparos; el cañón de plasma es la defensa más potente pero muy cara. Combínelas: los disparos se reparten al azar entre **todas** las unidades, así que cúpulas y lanzamisiles baratos protegen sus defensas costosas.

**¿Vuelven las defensas destruidas?**
Cada defensa destruida se reconstruye con un **70 % de probabilidad** tras el combate, sin coste; las naves perdidas no vuelven.

**¿Mi defensa protege mis recursos?**
No directamente: si gana el atacante, puede saquear hasta el 50 % de su reserva. Una defensa fuerte dificulta su victoria; gastar sus recursos antes de desconectarse es la mejor protección.

**¿Participan mis naves en la defensa?**
Sí, las **estacionadas** en el planeta (no las que están en vuelo) combaten junto a la defensa.

**¿Mejora la tecnología mi defensa?**
Sí: *Defensa* (casco), *Escudo* y *Militar* (arma), de +10 % por nivel, se aplican también a las defensas.

---

## 9. Poder, comandante y clasificación

**¿Qué es el poder?**
Un número de puntos que mide su desarrollo: **edificios + investigaciones + naves + defensas + colonias**. En cada categoría se suman los costes invertidos (metal + cristal + deuterio) y se dividen entre 1 000. Cada colonia (más allá del primer planeta) vale 1 000 puntos. **Las reservas de recursos no cuentan.**

**¿Qué es el nivel de comandante?**
Un nivel de 1 a 100 calculado **solo** a partir de los puntos de edificios e investigaciones (no de naves). El umbral del nivel `n` es `10 × (n − 1)³`: nivel 2 a 10 puntos, nivel 10 a 7 290, nivel 50 a 1 176 490. En el nivel 50 obtiene la 3.ª construcción simultánea (con *Gestion des chantiers*) y la 3.ª línea de producción (con *Production parallèle*).

**¿Cómo funciona la clasificación?**
Se basa en el **poder**; su rango aparece en la cabecera y en la vista general. Perder naves reduce su poder; construir defensas lo aumenta.

---

## 10. «¿Por qué no puedo…?»

| Mensaje (en francés en el juego) | Causa y solución |
|---|---|
| «Ressources insuffisantes» | Falta metal, cristal o deuterio (el combustible se suma a la carga de deuterio en un vuelo). |
| «Prérequis manquants : …» | El detalle enumera los niveles de edificio o tecnología que hay que alcanzar. |
| «Capacité de construction atteinte» | La cola del planeta está llena: espere o desbloquee *Gestion des chantiers* (2 colas). |
| «Nombre maximal de flottes en vol atteint» | Todas sus plazas de flota están ocupadas: espere el regreso de una flota o suba la tecnología *Computación* (§6). |
| «Plus de champs disponibles» | El planeta no tiene más campos (163): dedique los últimos a edificios útiles o colonice. |
| «Aucune planète à cette position» | Ataque y espionaje solo apuntan a un planeta existente; para colonizar, la posición debe estar **libre**. |
| «Une mission d'espionnage n'accepte que des sondes d'espionnage» | Envíe solo sondas (210). |
| «Capacité de cargaison insuffisante» | Añada cargueros o reduzca la carga. |
| «Un bouclier planétaire ne se construit qu'en un seul exemplaire» | Una sola cúpula pequeña y una grande por planeta. |
| «La flotte est déjà arrivée» | El retiro solo es posible en el vuelo de ida. |
| «Mission non disponible» | La misión aún no existe (§6). |

---

## 11. Lo que aún no existe

Oficiales, mercado, eventos, expediciones, ataques en grupo, mantener posición. Los edificios y tecnologías que dependen de ello (depósito de la alianza, falange, puerta de salto, red de investigación, expedición) no se ofrecen. La hoja de ruta del proyecto ([ROADMAP_MVP.md](../ROADMAP_MVP.md)) sigue estas discrepancias.

*Esta FAQ se ha comprobado con el código (`packages/game-config`, `packages/game-engine`, API) y, para los satélites solares, con una prueba de integración automatizada (`solar-satellites.integration.spec.ts`).*
