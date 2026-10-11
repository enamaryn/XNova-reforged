# FAQ del gioco — XNova Reforged

> Versione `v0.2.0` (alpha privata). Questa FAQ descrive ciò che il gioco fa **realmente** oggi, in base al codice e a prove su un server di test; quando qualcosa che l'interfaccia mostra non fa ciò che dice il suo testo, lo si dichiara chiaramente (⚠️). Lingue: [Français](FAQ.md) · [English](FAQ_EN.md) · [Español](FAQ_ES.md) · [Deutsch](FAQ_DE.md) · [Italiano](FAQ_IT.md). Per lo svolgimento di una partita, vedi la [guida del giocatore](PLAYER_GUIDE_IT.md).
>
> **Nomi nel gioco.** I nomi e le descrizioni di edifici, navi e tecnologie sono ancora mostrati **in francese**, qualunque lingua si scelga. Questa FAQ indica il significato in italiano seguito dal nome che vedrai nel gioco, in *corsivo*.

**Indice**: [1. Le basi](#1-le-basi) · [2. Edifici](#2-edifici) · [3. Energia e satelliti solari](#3-energia-e-satelliti-solari) · [4. Ricerca](#4-ricerca) · [5. Navi](#5-navi) · [6. Flotte e missioni](#6-flotte-e-missioni) · [7. Combattimento](#7-combattimento) · [8. Difesa](#8-difesa) · [9. Potenza, comandante e classifica](#9-potenza-comandante-e-classifica) · [10. «Perché non posso…?»](#10-perché-non-posso) · [11. Ciò che non esiste ancora](#11-ciò-che-non-esiste-ancora)

---

## 1. Le basi

**Quali sono le tre risorse?**
**Metallo** (edifici, navi, difese), **cristallo** (laboratorio, ricerche, navi, elettronica) e **deuterio** (carburante delle flotte, laboratorio, la maggior parte delle ricerche). Si parte con 500 di metallo, 500 di cristallo e 0 di deuterio: il sintetizzatore di deuterio è quindi una priorità.

**Perché tutto va così veloce (o così piano)?**
I costi sono quelli del gioco originale; è la **velocità del server** a cambiare durate e produzione. Il profilo di riferimento è **×50**: la produzione è moltiplicata per 50 e tutte le durate (edifici, ricerche, navi, voli) sono divise per 50. Su un server ×1 tutto è circa 50 volte più lento. I costi non cambiano mai.

**Quanto ci vuole per la prima nave a ×50?**
Circa 1 h 50 min per un giocatore che spende solo ciò che produce (laboratorio ≈ 22 min, prima ricerca ≈ 1 h, hangar ≈ 1 h 05).

**Le mie risorse continuano a crescere offline?**
Sì: la produzione è calcolata sul tempo trascorso, sia che tu sia connesso o no. Si ferma quando il deposito è pieno.

**Cos'è lo stoccaggio e cosa succede quando è pieno?**
La capacità di base è di **1 000 000 per risorsa**; ogni livello di deposito la moltiplica per 1,5 (livello 1: 1 500 000; livello 5: ≈ 7,6 milioni). Una scorta può superare la capacità al massimo del 10 %; oltre, **la produzione va persa**. Spendi prima di riempirti.

**C'è un reddito senza miniere?**
Sì, un piccolo reddito di base per pianeta (20 di metallo e 10 di cristallo all'ora prima della moltiplicazione per la velocità). Aiuta all'inizio.

**In quali lingue è il gioco?**
Francese, inglese, spagnolo, tedesco, italiano (selettore nell'intestazione). Limite noto: i **nomi e le descrizioni** di edifici, navi e tecnologie, e alcuni messaggi di errore, restano in francese.

---

## 2. Edifici

**A cosa serve ogni edificio?**

| Edificio (nome nel gioco) | Utilità reale oggi |
|---|---|
| **Miniera di metallo / di cristallo** (*Mine de Métal / de Cristal*) | producono metallo / cristallo (consumano energia) |
| **Sintetizzatore di deuterio** (*Synthétiseur de Deutérium*) | produce deuterio (consuma più energia) |
| **Centrale solare** (*Centrale Électrique Solaire*) | fornisce energia alle miniere |
| **Centrale a fusione** (*Centrale Électrique de Fusion*) | fornisce più energia; richiede sintetizzatore livello 5 e *Tecnologia energetica* livello 3 |
| **Fabbrica di robot** (*Usine de Robots*) | divide la durata delle costruzioni di edifici (durata ÷ (1 + livello)) |
| **Fabbrica di naniti** (*Usine de Nanites*) | la divide ancora (÷ 2 per livello); richiede robot 10 e *Informatica* 10; molto costosa |
| **Hangar** (*Hangar*, il cantiere) | permette di costruire navi e difese e le accelera; il suo livello condiziona quasi tutti i prerequisiti |
| **Deposito di metallo / di cristallo, serbatoio di deuterio** (*Hangar de Métal / de Cristal, Réservoir de Deutérium*) | aumentano la capacità di stoccaggio |
| **Laboratorio di ricerca** (*Laboratoire de Recherche*) | permette le ricerche e le accelera |

**Quanto costa un edificio e come cresce il costo?**
Il livello successivo costa `costo base × fattore^livello attuale`. Esempio, la miniera di metallo (base 60 metallo / 15 cristallo, fattore 1,5): livello 1 → 60 / 15; livello 10 → 2 306 / 576. Il costo è **addebitato all'avvio**.

**Quanto dura una costruzione?**
`30 × (metallo + cristallo) / (75 × (1 + robot) × 2^naniti)` secondi, poi divisi per la velocità del server. Robot e naniti sono quindi l'investimento che rende tutto il resto più veloce.

**Quanti edifici posso costruire contemporaneamente?**
Uno per pianeta all'inizio; **due** dopo la ricerca *Gestion des chantiers* (gestione dei cantieri); **tre** se in più hai un comandante di livello 50.

**Posso annullare una costruzione?**
Sì, dalla coda: l'importo addebitato viene **rimborsato esattamente**. Non esiste la demolizione di un livello già costruito.

**Cosa sono i «campi» di un pianeta?**
Ogni pianeta iniziale ha **163 campi**. Ogni livello costruito di un edificio (esclusi i depositi) ne consuma **uno**: non potrai portare tutto al massimo. Scegli i tuoi livelli.

**Che differenza c'è tra «Hangar» e cantiere?**
È lo stesso edificio (id 21): l'«Hangar» degli elenchi è il cantiere dove si costruiscono navi e difese. Non confonderlo con gli hangar di **stoccaggio**.

**⚠️ Alcuni edifici si costruiscono ma oggi non hanno effetto.**
Il **terraformatore** (richiede *Tecnologia energetica* 12) non aumenta il numero di campi; il **deposito dell'alleanza**, il **silo missilistico** (nessun missile è disponibile) e gli edifici **lunari** (base lunare, falange, portale di salto: il gioco non crea lune) per ora non cambiano nulla nel gioco. Non investirci.

---

## 3. Energia e satelliti solari

**Come funziona l'energia?**
Le miniere consumano energia; le centrali la producono. Finché la produzione copre il consumo, le miniere lavorano al 100 %. Altrimenti **tutte le miniere rallentano proporzionalmente** (produzione al 50 % dell'energia necessaria = 50 % di metallo, cristallo e deuterio). Il livello di produzione e il bilancio energetico sono mostrati nella panoramica.

**Quanta energia produce e consuma ogni edificio?**
Per livello `n`: centrale solare `20 × n × 1,1^n`; centrale a fusione `30 × n × 1,05^n`; consumo della miniera di metallo e di cristallo `10 × n × 1,1^n`, del sintetizzatore di deuterio `20 × n × 1,1^n`. Esempi: centrale solare livello 10 → 518; fusione livello 10 → 488; miniera di metallo livello 10 → consuma 260.

**Quale centrale scegliere?**
La centrale solare: economica e senza prerequisiti. A parità di livello la fusione produce **meno** di una solare nel motore attuale (livello 10: 488 contro 518) e ha prerequisiti costosi: oggi non conviene. ⚠️ La fusione **non consuma deuterio** (nonostante la descrizione) e la *Tecnologia energetica* non ne aumenta la produzione: è un prerequisito, non un bonus.

**⚠️ I satelliti solari danno energia?**
**No, non oggi.** Il satellite solare (212: 2 000 di cristallo e 500 di deuterio, costruibile dall'hangar livello 1) esiste, si costruisce e resta stazionato sul pianeta, e la sua descrizione dice «fornisce energia gratis» — ma il calcolo della produzione **non lo considera**. Verificato su un server di test: 10 satelliti costruiti, bilancio energetico invariato (79 disponibili prima e dopo). **Non costruirli per l'energia**: perderesti cristallo e deuterio. Usa le centrali. Il comportamento atteso (50 di energia per satellite secondo le costanti del codice) è uno scarto noto, segnalato nel registro del progetto.

**Un satellite può essere attaccato o inviato in missione?**
Non ha velocità: non può viaggiare. Se è stazionato su un pianeta attaccato, conta tra le unità che difendono (scafo 2 000, scudo 1, arma 1): assorbe colpi, nient'altro.

**Cosa faccio se l'energia è insufficiente?**
Aumenta una centrale solare prima della miniera successiva. Se il livello di produzione è all'80 %, le tue miniere producono il 20 % in meno del previsto.

---

## 4. Ricerca

**Come funziona la ricerca?**
Una sola ricerca alla volta per giocatore, pagata all'avvio, che richiede un livello di laboratorio e talvolta altre tecnologie (mostrate sulla scheda). Il costo cresce a ogni livello. Una ricerca in attesa può essere annullata.

**Quali ricerche hanno un effetto diretto?**

| Ricerca (nome nel gioco) | Effetto reale oggi |
|---|---|
| **Tecnologia militare** (*Technologie Militaire*, 109) | +10 % di potenza d'arma **per livello** per tutte le tue navi e difese |
| **Tecnologia della difesa** (*Technologie Défense*, 110) | +10 % di scafo per livello |
| **Tecnologia degli scudi** (*Technologie Bouclier*, 111) | +10 % di scudo per livello |
| **Propulsore a combustione** (*Réacteur à Combustion*, 115) | +10 % di velocità per livello per cargo piccolo, caccia leggero, sonda |
| **Propulsore a impulso** (*Réacteur à Impulsion*, 117) | +20 % di velocità per livello per cargo grande, caccia pesante, colonizzatrice, riciclatrice, bombardiere |
| **Propulsione iperspaziale** (*Propulsion Hyperespace*, 118) | +30 % di velocità per livello per incrociatore, nave da battaglia, corazzata, morte nera, incrociatore da battaglia; +5 %/livello di capacità di carico per il bottino di un attacco |
| **Tecnologia dello spionaggio** (*Technologie Espionnage*, 106) | determina il dettaglio dei rapporti di spionaggio (confrontata con quella del bersaglio, vedi §5) |
| **Gestione dei cantieri** (*Gestion des chantiers*, 125) | 2ª costruzione simultanea di edifici |
| **Produzione parallela** (*Production parallèle*, 126) | linee di produzione aggiuntive al cantiere |

**E le altre?**
Energia (113), Informatica (108), Iperspazio (114), Laser (120), Ioni (121), Plasma (122), Rete di ricerca intergalattica (123), Spedizione (124), Gravitone (199) servono soprattutto da **prerequisiti** per sbloccare edifici, navi e difese. ⚠️ Nonostante le descrizioni, *Informatica* non limita il numero di flotte (non c'è limite), *Laser/Ioni/Plasma* non migliorano le armi e la *Spedizione* non ha una missione associata. La scheda di ogni elemento mostra i prerequisiti esatti.

**Quale ricerca per prima?**
*Energia* (prerequisito della fusione e di varie difese), poi il propulsore a combustione per trasporti più veloci, quindi *Militare/Difesa/Scudi* secondo il tuo piano di combattimento.

---

## 5. Navi

**Dove e come si costruiscono le navi?**
All'**hangar** (pagina Cantiere). L'ordine è pagato subito e costruito per lotti; un ordine **in attesa** può essere ritirato (90 % rimborsato), un lotto già avviato termina normalmente. La durata dipende dal costo e dal livello di hangar: `(metallo + cristallo) / (2 500 × (1 + hangar) × 2^naniti)` secondi per unità, poi divisi per la velocità del server.

**Quali navi esistono e a cosa servono?**

| Nave (nome nel gioco) | Costo (metallo / cristallo / deuterio) | Carico | Velocità base | Arma / scudo / scafo | Uso |
|---|---|---:|---:|---|---|
| **Cargo piccolo** (*Petit Transporteur*, 202) | 2 000 / 2 000 / 0 | 6 000 | 5 000 | 5 / 10 / 4 000 | trasporto iniziale |
| **Cargo grande** (*Grand Transporteur*, 203) | 6 000 / 6 000 / 0 | 25 000 | 7 500 | 5 / 25 / 12 000 | grandi trasporti |
| **Caccia leggero** (*Chasseur Léger*, 204) | 2 500 / 800 / 0 | 50 | 12 500 | 60 / 10 / 4 000 | combattimento di massa economico |
| **Caccia pesante** (*Chasseur Lourd*, 205) | 6 000 / 4 000 / 0 | 100 | 10 000 | 150 / 25 / 10 000 | combattimento polivalente |
| **Incrociatore** (*Croiseur*, 206) | 18 000 / 6 000 / 2 000 | 800 | 15 000 | 400 / 50 / 27 000 | combattimento veloce |
| **Nave da battaglia** (*Vaisseau de Bataille*, 207) | 45 000 / 15 000 / 0 | 1 500 | 10 000 | 1 000 / 200 / 60 000 | nucleo della flotta |
| **Colonizzatrice** (*Vaisseau de Colonisation*, 208) | 10 000 / 20 000 / 10 000 | 7 500 | 2 500 | 50 / 100 / 30 000 | fondare una colonia (consumata) |
| **Riciclatrice** (*Recycleur*, 209) | 10 000 / 6 000 / 2 000 | 20 000 | 2 000 | 1 / 10 / 16 000 | ⚠️ vedi sotto |
| **Sonda spia** (*Sonde d'Espionnage*, 210) | 0 / 1 000 / 0 | 0 | 50 000 | 0 / 0 / 1 000 | spionaggio |
| **Bombardiere** (*Bombardier*, 211) | 50 000 / 25 000 / 15 000 | 500 | 4 000 | 1 000 / 500 / 75 000 | pensato contro le difese |
| **Satellite solare** (*Satellite Solaire*, 212) | 0 / 2 000 / 500 | 0 | 0 | 1 / 1 / 2 000 | ⚠️ nessun effetto energetico (§3) |
| **Corazzata** (*Destructeur*, 213) | 60 000 / 50 000 / 15 000 | 2 000 | 5 000 | 2 000 / 500 / 110 000 | combattimento pesante |
| **Incrociatore da battaglia** (*Traqueur*, 215) | 30 000 / 40 000 / 15 000 | 10 000 | 10 000 | 700 / 400 / 70 000 | combattimento veloce |
| **Morte nera** (*Étoile de la Mort*, 214) | 5 000 000 / 4 000 000 / 1 000 000 | 1 000 000 | 100 | 200 000 / 50 000 / 9 000 000 | definitiva; richiede hangar 12 e *Gravitone* |

I prerequisiti (livello di hangar e tecnologie) sono mostrati su ogni scheda.

**Quale nave per trasportare?**
Il cargo piccolo all'inizio (economico, disponibile presto), poi il grande (4× la capacità per 3× il prezzo, più veloce). Il carico è la somma di tutte le navi inviate.

**Come si spia?**
Con le **sonde spia**: la missione di spionaggio accetta solo sonde. Una sonda costa 1 000 di cristallo e vola molto veloce; le sonde **tornano sempre** (non vengono distrutte) e il bersaglio **non viene avvisato**. Il dettaglio del rapporto dipende da un punteggio: `punteggio = (il tuo Spionaggio − quello del bersaglio) + (numero di sonde − 1)`. Le **risorse** sono sempre visibili; da **1** si aggiunge la **flotta**, da **3** le **difese e gli edifici**, da **5** le **tecnologie**. Esempio: a parità di livello bastano 6 sonde per vedere tutto.

**⚠️ A cosa serve la riciclatrice?**
Oggi a niente: il combattimento calcola dei detriti (30 % del metallo e del cristallo delle **navi** distrutte), ma non esistono né campo di detriti né missione di riciclaggio. Per ora non costruire riciclatrici.

**Le navi hanno il «fuoco rapido»?**
⚠️ I valori di fuoco rapido esistono nella configurazione, ma il motore di combattimento **non li applica** ancora: ogni nave spara una volta per round su un bersaglio scelto a caso.

**Come si colonizza?**
Missione *Colonizzazione* con una colonizzatrice verso una **posizione libera**: la colonia viene fondata e la nave consumata. Massimo **21 pianeti** per giocatore.

---

## 6. Flotte e missioni

**Quali missioni esistono?**
**Trasporto** (consegna il carico, poi la flotta rientra), **Schieramento** (installa flotta e carico su *un tuo altro* pianeta, senza ritorno), **Attacco**, **Spionaggio**, **Colonizzazione**. Riciclaggio, spedizione, attacco di gruppo, mantenimento della posizione e distruzione sono rifiutati dal gioco senza addebitare nulla.

**Come si calcolano durata e carburante di un volo?**
Distanza: `√(Δgalassia² × 20 000 + Δsistema² × 95 + Δposizione² × 5)`. Velocità della flotta: quella della sua **nave più lenta** (con i bonus dei propulsori). Durata: `(35 000 / % di velocità) × √(distanza × 10 / velocità) + 10` secondi, divisi per la velocità di flotta del server. Carburante (deuterio, addebitato alla **partenza**): `Σ numero × consumo × (distanza / 35 000) × (velocità / 1 000 + 1)²`. Esempio con 10 cargo piccoli: stesso sistema (4 posizioni) 0 di deuterio; 10 sistemi più in là 10; altra galassia 14. Una velocità più bassa allunga il volo (dal 10 % al 100 %).

**Posso inviare più flotte contemporaneamente?**
Sì, oggi senza limite di numero (la tecnologia *Informatica* non lo limita).

**Come richiamo una flotta?**
Da *Movimenti*, finché è nel volo di andata e non è arrivata: inverte la rotta e il ritorno dura quanto il tragitto già percorso. Una flotta arrivata o già in rientro non può essere richiamata.

**Dove vedo il risultato?**
Nei *Rapporti*.

**Cosa trasporta la missione di attacco?**
Può portare anche del carico, ma il bottino occupa solo lo **spazio libero** rimasto nelle navi sopravvissute.

---

## 7. Combattimento

**Come si svolge un combattimento?**
Fino a **6 round**. A ogni round, ogni unità dell'attaccante e poi ogni unità del difensore spara una volta su un'unità avversaria **scelta a caso**. Il danno toglie prima lo scudo, poi lo scafo; un'unità senza scafo è distrutta. Alla fine di ogni round **gli scudi si rigenerano del 70 %** del loro massimo. Il combattimento termina quando uno schieramento è distrutto o dopo 6 round (pareggio).

**Quali bonus tecnologici si applicano?**
*Militare* (+10 % d'arma per livello), *Difesa* (+10 % di scafo), *Scudi* (+10 % di scudo), applicati a tutte le tue unità, navi **e** difese. Ogni schieramento usa i propri livelli.

**Chi difende un pianeta attaccato?**
Le **difese** e la **flotta stazionata** sul pianeta combattono insieme (compresi i satelliti solari, che servono solo da bersaglio).

**Cosa si perde e cosa si recupera?**
- Le navi distrutte sono perse.
- Le **difese** distrutte vengono ricostruite con il **70 % di probabilità** ciascuna dopo il combattimento.
- Un «campo di detriti» viene calcolato (30 % del costo in metallo e cristallo delle navi perse) e mostrato nel rapporto, ma non può essere raccolto (§5).
- **Bottino** (se vince l'attaccante): fino al **50 %** di ogni risorsa del bersaglio, limitato alla capacità libera delle navi sopravvissute.

**Come vinco un combattimento?**
Spia prima per conoscere flotta e difese, verifica che il tuo carico basti per il bottino e invia una flotta nettamente superiore (il caso conta). Lo scudo di un'unità assorbe colpi fino a esaurirsi, poi si rigenera del 70 % a ogni round: le unità con grandi scudi incassano quindi molti colpi da un round all'altro.

**Posso attaccare il mio pianeta?**
No. Lo schieramento richiede uno dei **tuoi** pianeti; l'attacco esclude i tuoi.

---

## 8. Difesa

**Quali difese posso costruire?**

| Difesa (nome nel gioco) | Costo (metallo / cristallo / deuterio) | Arma / scudo / scafo | Prerequisiti principali |
|---|---|---|---|
| **Lanciamissili** (*Lanceur de Missiles*, 401) | 2 000 / 0 / 0 | 80 / 20 / 200 | hangar 1 |
| **Laser leggero** (*Artillerie Laser Légère*, 402) | 1 500 / 500 / 0 | 100 / 25 / 2 000 | hangar 2, Energia 2, Laser 3 |
| **Laser pesante** (*Artillerie Laser Lourde*, 403) | 6 000 / 2 000 / 0 | 250 / 100 / 8 000 | hangar 4, Energia 3, Laser 6 |
| **Cannone Gauss** (*Canon de Gauss*, 404) | 20 000 / 15 000 / 2 000 | 1 100 / 200 / 35 000 | hangar 6, Energia 6, Militare 3, Scudi 1 |
| **Cannone ionico** (*Artillerie à Ions*, 405) | 2 000 / 6 000 / 0 | 150 / 500 / 8 000 | hangar 4, Ioni 4 |
| **Cannone al plasma** (*Canon à Plasma*, 406) | 50 000 / 50 000 / 30 000 | 3 000 / 300 / 100 000 | hangar 8, Plasma 7 |
| **Cupola scudo piccola** (*Petit Bouclier*, 407) | 10 000 / 10 000 / 0 | 1 / 2 000 / 20 000 | hangar 6, Scudi 2 |
| **Cupola scudo grande** (*Grand Bouclier*, 408) | 50 000 / 50 000 / 0 | 1 / 10 000 / 100 000 | hangar 8, Scudi 6 |

I missili (intercettori e interplanetari) **non sono disponibili**: il silo missilistico per ora non serve quindi a nulla.

**Gli scudi planetari sono particolari?**
Sì: **uno per tipo per pianeta** (piccolo, grande). Hanno uno scudo enorme e uno scafo spesso per un'arma quasi nulla: servono ad **assorbire** i colpi.

**Quale difesa conviene di più?**
Per costo, lanciamissili e laser sono i più efficienti all'inizio; le cupole assorbono molti colpi; il cannone al plasma è la difesa più potente ma molto costosa. Combinale: i colpi si distribuiscono a caso tra **tutte** le unità, quindi cupole e lanciamissili economici proteggono le tue difese costose.

**Le difese distrutte tornano?**
Ogni difesa distrutta viene ricostruita con il **70 % di probabilità** dopo il combattimento, senza costo; le navi perse non tornano.

**La mia difesa protegge le mie risorse?**
Non direttamente: se vince l'attaccante può saccheggiare fino al 50 % della tua scorta. Una difesa forte rende difficile la sua vittoria; spendere le risorse prima di disconnettersi è la protezione migliore.

**Le mie navi partecipano alla difesa?**
Sì, quelle **stazionate** sul pianeta (non quelle in volo) combattono insieme alla difesa.

**La tecnologia migliora la mia difesa?**
Sì: *Difesa* (scafo), *Scudi* e *Militare* (arma), con +10 % per livello, si applicano anche alle difese.

---

## 9. Potenza, comandante e classifica

**Cos'è la potenza?**
Un punteggio che misura il tuo sviluppo: **edifici + ricerche + navi + difese + colonie**. Per ogni categoria si sommano i costi investiti (metallo + cristallo + deuterio) e si divide per 1 000. Ogni colonia (oltre al primo pianeta) vale 1 000 punti. **Le scorte di risorse non contano.**

**Cos'è il livello di comandante?**
Un livello da 1 a 100 calcolato **solo** dai punti di edifici e ricerche (non dalle navi). La soglia del livello `n` è `10 × (n − 1)³`: livello 2 a 10 punti, livello 10 a 7 290, livello 50 a 1 176 490. Al livello 50 ottieni la 3ª costruzione simultanea (con *Gestion des chantiers*) e la 3ª linea di produzione (con *Production parallèle*).

**Come funziona la classifica?**
Si basa sulla **potenza**; il tuo rango appare nell'intestazione e nella panoramica. Perdere navi abbassa la tua potenza; costruire difese la aumenta.

---

## 10. «Perché non posso…?»

| Messaggio (in francese nel gioco) | Causa e soluzione |
|---|---|
| «Ressources insuffisantes» | Mancano metallo, cristallo o deuterio (il carburante si aggiunge al carico di deuterio per un volo). |
| «Prérequis manquants : …» | Il dettaglio elenca i livelli di edificio o tecnologia da raggiungere. |
| «Capacité de construction atteinte» | La coda del pianeta è piena: attendi o sblocca *Gestion des chantiers* (2 code). |
| «Plus de champs disponibles» | Il pianeta non ha più campi (163): dedica gli ultimi a edifici utili oppure colonizza. |
| «Aucune planète à cette position» | Attacco e spionaggio mirano solo a un pianeta esistente; per colonizzare la posizione deve essere **libera**. |
| «Une mission d'espionnage n'accepte que des sondes d'espionnage» | Invia solo sonde (210). |
| «Capacité de cargaison insuffisante» | Aggiungi cargo o riduci il carico. |
| «Un bouclier planétaire ne se construit qu'en un seul exemplaire» | Una sola cupola piccola e una grande per pianeta. |
| «La flotte est déjà arrivée» | Il richiamo è possibile solo nel volo di andata. |
| «Mission non disponible» | La missione non esiste ancora (§6). |

---

## 11. Ciò che non esiste ancora

Ufficiali, mercato, eventi, lune, missili, riciclaggio e campi di detriti, spedizioni, attacchi di gruppo, limite di flotte tramite *Informatica*, effetto del terraformatore, fuoco rapido, energia dei satelliti solari. Gli elementi corrispondenti (edifici, navi, tecnologie) compaiono a volte negli elenchi e possono essere acquistati **senza effetto**: leggi i ⚠️ qui sopra prima di investire. La roadmap del progetto ([ROADMAP_MVP.md](../ROADMAP_MVP.md)) tiene traccia di questi scarti.

*Questa FAQ è stata verificata sul codice (`packages/game-config`, `packages/game-engine`, API) e, per i satelliti solari, con una prova su un server di test l'11 ottobre 2026.*
