# FantaDash

Dashboard locale per l'asta del fantacalcio di Serie A: segna i giocatori acquistati, traccia i
crediti tuoi e degli avversari, vedi in tempo reale chi manca a chi e le statistiche su affari,
scommesse e top acquisti.

Online su **https://ilbonez.github.io/fantadash/** — si apre da qualunque PC, tablet
o telefono, senza installare niente.

Gira senza account e senza server: i dati dell'asta stanno nel browser di chi la
apre (`localStorage`) e si esportano in JSON. Nessun dato passa dal sito.

## Avvio

Serve [Node.js](https://nodejs.org) 20 o superiore. Una volta sola:

```bash
npm install
```

Poi, per lavorare al progetto (ricarica automatica a ogni modifica):

```bash
npm run dev
```

Apre `http://localhost:5180`. Il listone ufficiale 2026/27 e' gia' incluso.

Per **usare** la dashboard all'asta, senza il server di sviluppo:

```bash
npm start
```

Compila e serve la versione ottimizzata, aprendo il browser da solo. Su Windows
basta anche fare doppio clic su `avvia.cmd`.

Lo script di ingest dell'Excel richiede Python 3 con `openpyxl`
(`pip install openpyxl`), ma solo se vuoi aggiornare le quotazioni: il listone
gia' generato e' nel repository.

## Usarla su piu' PC

La dashboard e' una pagina statica: nessun server, nessun account, i dati stanno
nel browser di chi la usa. Tre modi per portarla in giro, dal piu' comodo.

### 1. GitHub Pages (consigliato, anche su Surface ARM)

Attivo su **https://ilbonez.github.io/fantadash/**.

`.github/workflows/pages.yml` ripubblica a ogni push su `main`. Se rifai il
setup da zero su un altro repo servono due cose: repo pubblico (su repo privato
Pages richiede GitHub Pro) e **Settings → Pages → Source: GitHub Actions** — con
`Deploy from a branch` il workflow fallisce su `actions/configure-pages`.

Si apre da qualunque PC, tablet o telefono, con qualunque processore: non c'e'
niente da compilare, quindi **il chip ARM non c'entra**. I dati dell'asta restano
nel browser che la apre, non sul sito.

### 2. Cartella copiata (offline)

```bash
npm run build
```

Copia la cartella `dist/` dove vuoi — chiavetta USB, cartella condivisa. Il
build usa percorsi relativi, quindi funziona anche aperta con doppio clic su
`dist/index.html`, senza installare nulla.

Un avvertimento vero: aperta da `file://` il browser puo' **rifiutare
localStorage**, e in quel caso l'asta non si salva ricaricando la pagina. La
dashboard te lo dice con una fascia gialla in cima. Per evitarlo copia anche
`avvia.cmd` e `scripts/serve.mjs` e usa quelli: servono la cartella in locale
con un'origine vera, e il salvataggio torna a funzionare. In ogni caso esporta
il backup JSON a ogni pausa.

### 3. Eseguibile vero (.exe)

Si puo' fare, ma per questa dashboard e' la strada peggiore delle tre.

| | Peso | Windows ARM | Cosa serve per compilare |
| --- | --- | --- | --- |
| [Tauri](https://tauri.app) | ~10 MB | si, `aarch64-pc-windows-msvc` | Rust + Visual Studio Build Tools |
| [Electron](https://www.electronforge.io/) | ~150 MB | si, `--arch=arm64` | solo Node |

Con Tauri il `.exe` usa la WebView2 gia' presente in Windows 11, quindi resta
piccolo; Electron si porta dietro un Chromium intero.

Se vuoi provarci, la cosa importante e' questa: **compila direttamente sul
Surface**. Un binario ARM64 fatto da un PC x86 richiede toolchain di cross
compilazione, mentre sul Surface stesso `npm run tauri build` produce
l'eseguibile ARM64 nativo senza configurare niente. Il progetto e' gia' pronto
per essere impacchettato: `dist/` e' statico e autosufficiente.

Detto tutto questo, un `.exe` qui non aggiunge nulla: la dashboard non accede a
file, non stampa, non usa il sistema. GitHub Pages o la cartella servita fanno
lo stesso lavoro senza niente da compilare.

## Come si usa durante l'asta

1. **Impostazioni** – nome lega, modalita' (Classic o Mantra), crediti per squadra, slot per
   reparto, elenco squadre. La stella marca la tua.
2. **Piani** – dodici rose candidate costruite sui crediti che ti restano e sui giocatori ancora
   liberi. "Usa come obiettivi" mette la stella a quei giocatori.
3. **Asta** – la lista e' ordinata per `Score`: in cima le scelte migliori per te in questo
   momento. Digita il nome, `Enter` mette il giocatore all'asta, digita il prezzo, scegli la
   squadra, `Enter` assegna. Il focus torna sulla ricerca: si va avanti senza mouse.
4. **Squadre** – matrice "chi manca" (slot mancanti per reparto, crediti residui, offerta massima
   sostenibile) e rose complete.
5. **Statistiche** – inflazione della lega, spesa per reparto, top acquisti, affari, sovrapagati,
   scommesse, miglior valore per credito, big ancora liberi.

### Scorciatoie

| Tasto | Azione |
| --- | --- |
| `/` o `Ctrl+K` | focus sulla ricerca |
| `↓` `↑` | scorri i risultati |
| `Enter` (ricerca) | metti il giocatore evidenziato all'asta |
| `Enter` (prezzo) | assegna alla squadra selezionata |
| `Alt+1…9` | seleziona la squadra n |
| `Esc` | annulla il giocatore in asta |
| `Ctrl+Z` | annulla l'ultima operazione |

Le tre spunte sopra la lista filtrano in fretta: **liberi** nasconde chi e' gia' assegnato,
**mi serve** tiene solo i reparti in cui hai slot vuoti, **obiettivi** solo i giocatori con la
stella. La stella si mette e si toglie cliccandola nella lista, oppure in blocco da Piani.

L'undo vive solo nella sessione: dopo un ricaricamento della pagina lo storico si azzera (le
assegnazioni restano).

### Score: le scelte migliori in cima

La colonna `Score` (0-100) e' l'ordinamento di default della lista. Combina:

- **qualita' nel reparto** – FVM rispetto al miglior FVM ancora libero nello stesso ruolo (peso 55%);
- **resa per credito** – FVM diviso prezzo atteso, rapportato al miglior rapporto del reparto (45%);
- **rigorista** – x1,15 se e' il primo rigorista designato, x1,05 se e' l'alternativa;
- **titolare** – x1,10 se e' nella formazione tipo, x0,85 se ne e' fuori;
- **ti serve?** – se hai gia' riempito gli slot di quel ruolo il punteggio scende al 15%;
- **te lo puoi permettere?** – se il prezzo atteso supera la tua offerta massima sostenibile scende
  al 35%.

Rigori e titolarita' pesano perche' le quotazioni sono pubblicate prima che il campionato inizi:
sono l'unica cosa che il listino non sa ancora.

I giocatori penalizzati scendono in fondo ma non spariscono: in asta servono anche per far rilanciare
gli altri. Il colore aiuta: verde conviene, azzurro buono, grigio non ti serve, ambra fuori budget.
Passa il mouse sul punteggio per vedere il perche'.

### Il listino d'asta: dinamico, non la quotazione

Questa e' la parte che conta piu' di tutte, perche' e' quella che rende i piani realistici.

**Le quotazioni dell'Excel sono una base d'asta, non un prezzo.** La loro somma torna col budget, ma
la distribuzione reale e' molto piu' ripida — e soprattutto **cambia durante l'asta**. Prezzando
tutto a quotazione si pianificano rose impossibili, tipo Lautaro e Thuram insieme.

La colonna `Asta` e' quindi un prezzo ricostruito da zero, con due vincoli presi da aste realmente
concluse:

1. la spesa per reparto segue la **ripartizione mediana**: 7% portieri, 19% difesa, 32% centrocampo,
   42% attacco — su 500 crediti fa 35-95-160-210;
2. il **migliore di ogni reparto** costa quanto si osserva nelle aste.

In mezzo si interpola con `prezzo = top x (fvm / fvmTop)^gamma`, e `gamma` si calibra per far tornare
la spesa totale del reparto. Chi sta oltre il numero di slot della lega vale 1 credito: passato quel
punto nessuno rilancia piu'. Il risultato e' convesso come nella realta' — pochi giocatori carissimi
e una lunga coda da 1-2 crediti, che e' proprio cio' che serve per tenersi i crediti per centrocampo
e attacco.

#### La scarsita' fa salire i prezzi

In una lega da 10 squadre ognuna vuole almeno un attaccante di livello. La **domanda** parte da 10 e
scende solo quando qualcuno il suo l'ha preso; l'**offerta** si svuota a ogni acquisto. Quando
restano due bomber liberi e due squadre senza, quei due costano molto piu' di prima.

Il listino si ricalcola a ogni assegnazione con questo meccanismo. Per ogni reparto:

- la **fascia alta** sono i migliori ancora liberi, tanti quanti ne cercano ancora le squadre
  (portieri 1 a testa, difensori 2, centrocampisti 2, attaccanti 1, meno quelli che una squadra ha
  gia' in rosa);
- la fascia si divide una quota fissa del budget di reparto, quindi **meno sono e piu' costano**;
- il resto si divide quel che rimane, con una spinta molto piu' contenuta: e' la scarsita' dei top a
  fare i prezzi, non quella dei tappabuchi.

Misurato sul listone 2026/27, 10 squadre, temperatura normale, vendendo i bomber uno alla volta:

| Bomber venduti | Squadre a caccia | Spinta | Miglior attaccante libero |
| --- | --- | --- | --- |
| 0 | 10 | 1,00x | Lautaro 80 |
| 2 | 8 | 1,24x | Hojlund 84 |
| 4 | 6 | 1,60x | Kolo Muani 100 |
| 6 | 4 | 2,28x | Douvikas 129 |
| 8 | 2 | 3,00x | Scamacca 147 |

Scamacca a inizio asta sta a 52. Quando restano due bomber e due squadre senza, ne vale 147.

Due limiti tengono il modello onesto:

- la spinta e' limitata a **3x sulla fascia alta e 1,6x sul resto**;
- nessun prezzo puo' superare l'**offerta massima sostenibile** dalla squadra piu' ricca che cerca
  ancora quel reparto: se nessuno puo' pagarlo, non e' un prezzo.

La colonna `Spinta` nella vista Piani mostra il livello attuale rispetto a inizio asta, reparto per
reparto.

#### Temperatura del mercato

Le due fonti concordano sulla forma della curva ma non sul livello, quindi il livello lo scegli tu in
Impostazioni. Su 500 crediti, prezzo del miglior giocatore per reparto:

| Temperatura | P | D | C | A | Quando usarla |
| --- | --- | --- | --- | --- | --- |
| Freddo | 21 | 30 | 35 | 63 | lega prudente, nessuno si scanna sui top |
| **Normale** | 28 | 40 | 46 | 84 | prezzi medi delle aste concluse (default) |
| Caldo | 55 | 78 | 90 | 164 | lega da guerra sui top |

A "Normale" Lautaro sta a 79, Thuram 67, Hojlund 66 — i dati osservati dicono 84 e 71. A "Caldo"
diventano 145 e 103, ed e' lì che prenderli entrambi diventa davvero impossibile.

La temperatura fissa il livello di partenza; da li' in poi lo muove la scarsita', come sopra.

#### Massimo 2 centrocampisti e 1 attaccante di fascia alta

Un giocatore conta come fascia alta sopra l'8% del budget (40 crediti su 500). I piani ne prendono al
massimo **2 a centrocampo e 1 in attacco**, che e' la media reale di una rosa.

Non e' una questione di budget: sulla carta due attaccanti da 80 ci starebbero in 500 crediti. E' che
all'asta sette avversari rilanciano su ognuno, e chi prende i due migliori attaccanti si ritrova il
resto della rosa a 1 credito. "Due bomber" e' l'unica strategia che alza il tetto a 2 attaccanti, e
nella sua scheda si vede il prezzo che paga.

### Correzioni a mano

Il prezzo `Asta` segue questa precedenza:

1. **la tua correzione** – campo `Atteso` nella barra di assegnazione, in azzurro nella lista;
2. **il prezzo curato** in `data/extra.json`, in ambra;
3. **il listino modellato**, ricalibrato sull'asta in corso.

Serve quando il modello non puo' sapere. Malen e' quotato 36 e il listino lo mette a 79, ma dopo 5
gol in 2 giornate va a 300: con quel prezzo il suo `FVM/cr` crolla da 4,6 a 1,4 e lo `Score` scende
da primo a nono. Non e' diventato scarso — a 300 crediti non conviene, ed e' esattamente quello che
devi sapere mentre gli altri rilanciano.

### Piani rosa

Dodici rose candidate, tutte costruite sui crediti che ti restano e sui giocatori ancora liberi.

| Piano | Idea |
| --- | --- |
| Equilibrata | ripartizione mediana delle aste concluse: 7/19/32/42 |
| Due bomber | meta' budget in attacco |
| Tre intoccabili | 3 big a qualunque prezzo, 22 completamenti al minimo |
| Cinque big | 5 titolari di fascia alta, il resto minimo |
| Centrocampo top | i centrocampisti da bonus costano meno degli attaccanti pari resa |
| Difesa e modificatore | reparto arretrato di qualita' |
| Massimo valore | sempre il miglior FVM per credito, nessuna quota |
| Solo titolari | prima le maglie della formazione tipo |
| Rigori e piazzati | rigoristi e tiratori di punizioni e angoli |
| Caccia ai rigoristi | un rigorista designato in ogni slot possibile |
| Nessun buco | almeno 6 crediti per slot, tetto del 15% |
| Tieni crediti | spende il 75% e conserva il resto per la riparazione |

Come vengono costruiti:

1. il budget residuo si divide tra i reparti secondo la quota della strategia (le quote dei reparti
   gia' completi vengono ridistribuite);
2. dentro ogni reparto si prendono i migliori per FVM, tenendo 1 credito per ogni slot ancora da
   coprire;
3. l'avanzo viene reinvestito con scambi successivi, scegliendo ogni volta il maggior guadagno di
   FVM per credito aggiuntivo, senza sfondare il soffitto del reparto, senza superare il tetto sui
   giocatori di fascia alta e senza mai sostituire un rigorista con un non-rigorista nei piani che
   li cercano.

Ogni piano contiene per forza molti slot da 1-2 crediti (la colonna `1-2 cr` nel confronto dice
quanti): sono quelli che liberano il budget per i due centrocampisti e l'attaccante che contano.

**I portieri hanno una regola a parte, valida per tutte le strategie: primo e secondo della stessa
squadra di Serie A.** Se il titolare non gioca il voto lo porta la riserva e non resti mai senza
portiere. Il terzo slot, se c'e', va al piu' economico. I portieri sono anche esclusi da filtri,
tetti e minimi: la coppia viene prima dell'ottimizzazione.

#### La colonna Diverso

Dice quanti giocatori cambiano rispetto al piano con FVM piu' alto. Se un piano risulta `identico`
significa che la sua quota per reparto non e' vincolante: le quote sono un obiettivo, non qualcosa
che il mercato rispetta, e quando i giocatori liberi costano meno della quota non c'e' nulla su cui
spendere di piu'.

Con il listino d'asta al posto delle quotazioni questo capita molto meno: a inizio asta i dodici
piani vanno da 1470 a 2276 di FVM aggiunto, con composizioni diverse (`Top D/C/A` da 0/0/3 a 1/3/1).

Piu' l'asta va avanti, piu' i piani si restringono su chi e' ancora libero: rientra in Piani ogni
volta che vuoi rivedere la rotta.

### Offerta massima sostenibile

Accanto a ogni squadra c'e' un valore `max`: i crediti che puo' spendere su un giocatore
lasciando almeno 1 credito per ogni slot ancora vuoto.

```
max = residui - (slot_rimanenti - 1)
```

E' il numero che serve davvero all'asta: dice fin dove un avversario puo' rilanciare.

## Aggiornare le quotazioni

Il listone e' generato dall'Excel ufficiale di Fantacalcio.it.

**Con `npm run dev` attivo basta copiare il nuovo .xlsx in `data/`**: un plugin Vite se ne accorge,
rilancia l'ingest e la pagina si ricarica da sola. Funziona sia sovrascrivendo il file esistente sia
aggiungendone uno con un nome nuovo (in quel caso diventa lui la sorgente).

A server spento, o per rigenerare a mano:

```bash
npm run ingest
```

Lo script legge il foglio `Tutti` (e `Ceduti`, marcati e nascosti dalla lista) e riscrive
`src/data/listone.json`.

**Le assegnazioni non si perdono** quando aggiorni il listone: sono legate all'`Id` ufficiale del
giocatore, non alla posizione in lista. Cambiano le quotazioni, quindi cambiano i delta e le
statistiche — che e' esattamente il punto. Se un giocatore assegnato scompare dal nuovo listone
(finisce tra i ceduti), la sua assegnazione resta ma non compare piu' nella lista.

Colonne usate: `Id, R, RM, Nome, Squadra, Qt.A, Qt.I, Diff., Qt.A M, Qt.I M, Diff.M, FVM, FVM M`.
In modalita' Classic la dashboard usa `Qt.A`/`FVM`, in Mantra `Qt.A M`/`FVM M` e i ruoli `RM`.

## Titolari, rigoristi e info d'asta

L'Excel ufficiale non dice chi gioca ne' chi tira i rigori. Quei dati stanno in
**`data/extra.json`**, un file curato a mano che l'ingest aggancia al listone per nome e squadra.

Per giocatore la dashboard mostra sigle compatte accanto al nome (il testo completo e' nel tooltip):

| Sigla | Significato |
| --- | --- |
| **R** | primo rigorista designato |
| **r** | alternativa dal dischetto |
| **T** | titolare nella formazione tipo |
| **P** | tira le punizioni |
| **C** | tira i calci d'angolo |
| **n** (rosso) | gol segnati finora |

Per i giocatori di cui ho la fantamedia 2025/26 (Malen 9,1 · Lautaro 8,2 · Thuram 7,9 · Calhanoglu
7,5 · Hojlund 7,4 · McTominay 7,2 · Paz 7,2 · Dimarco 8,4) il dato compare nel tooltip della riga e
nella barra d'asta. Copertura parziale di proposito: sono i giocatori su cui ho una fonte, quindi
il dato **non entra** nel calcolo dello `Score` — sarebbe ingiusto verso tutti gli altri.

Un `*` accanto alla squadra segnala una nota: ballottaggi e gerarchie contese, elencate anche in
Impostazioni sotto "Ballottaggi e gerarchie incerte".

### Aggiornare i dati curati

`data/extra.json` e' strutturato per squadra (`titolari`, `rigoristi`, `punizioni`, `angoli`,
`nota`) piu' un elenco `giocatori` per le schede singole (`gol`, `atteso`, `nota`). Modificalo e
rilancia `npm run ingest`.

L'aggancio dei nomi non e' banale — il listone scrive `Martinez L.`, le fonti scrivono
`Lautaro Martinez` — quindi il matcher cerca il cognome come sequenza di token e verifica l'iniziale
sul resto, ignorando accenti, punti e apostrofi (`N'Dicka` = `Ndicka`). Un nome ambiguo (due Martinez
nella stessa squadra senza iniziale) non viene agganciato di proposito.

**L'ingest stampa ogni nome che non riesce ad agganciare.** Non fidarti del silenzio: se non stampa
nulla, tutto e' agganciato. E' cosi' che sono emersi Leao, Nkunku, Missori e Pedersen — indicati
titolari dalle fonti ma marcati **ceduti** nel listone ufficiale, quindi non acquistabili.

### Fonti e stato dei dati

Dati al **1 settembre 2026**, dopo 2 giornate. Le gerarchie cambiano ogni settimana: riverificale
prima dell'asta.

- Formazioni tipo: [fantacalcio-online.com](https://www.fantacalcio-online.com/it/consigli-fantacalcio/probabili-formazioni-serie-a)
  — 217 titolari agganciati su 220
- Rigoristi: [Sky Sport](https://sport.sky.it/fantacalcio/2026/08/10/rigoristi-serie-a-fantacalcio-2026-2027)
  e [Goal.com](https://www.goal.com/it/liste/fantacalcio-rigoristi-serie-a-2026-2027-tiratori-e-gerarchie-dal-dischetto-delle-20-squadre-del-campionato/bltdebca56c3bd91419)
  — 63 rigoristi agganciati
- Punizioni e angoli: [FantaMaster](https://www.fantamaster.it/tiratori-punizioni-corner-calci-dangolo-seriea-2026-2027-gerarchie-fantacalcio/)
- Marcatori: [DAZN](https://www.dazn.com/it-IT/news/calcio/capocannonieri-serie-a-classifica-marcatori-aggiornata/1sk4dtns3wmef1l94kdidtcn4c)

Le due fonti sui rigoristi non concordano su Atalanta (Scamacca / Kessie), Juventus (Kolo Muani /
Yildiz), Milan (Nkunku / Ramos), Cagliari (Maldini / Fazzini) e Parma. Dove Sky collocava un
giocatore in una squadra diversa da quella delle formazioni tipo ha vinto la formazione tipo, perche'
combacia col listone. Ogni scelta e' annotata nella `nota` della squadra e visibile in dashboard.

## Dati via API: cosa esiste davvero

Sintesi dell'indagine, con la conclusione in cima: **per quotazioni e ruoli fantacalcio non
esiste un'API pubblica ufficiale**. L'Excel resta la fonte autorevole, ed e' il motivo per cui
l'ingest da file e' il percorso principale di questo progetto.

| Fonte | Cosa da' | Costo | Note |
| --- | --- | --- | --- |
| Excel ufficiale Fantacalcio.it | quotazioni Classic e Mantra, ruoli, FVM | gratis | fonte usata qui; nessun endpoint documentato, solo download del file |
| [football-data.org](https://www.football-data.org/) | rose, calendario, classifica, capocannonieri Serie A | gratis (top competizioni), 10 req/min | l'unica gratuita con termini chiari; niente quotazioni fantacalcio |
| API-Football / api-sports.io | statistiche giocatore, infortuni, formazioni | free tier ~100 req/giorno | copertura buona, nomi diversi da quelli del listone |
| [Sportmonks](https://www.sportmonks.com/football-api/serie-a-api/), [TheStatsAPI](https://www.thestatsapi.com/football/league/serie-a), [Enetpulse](https://enetpulse.com/italian-serie-a-api/) | dati completi, xG, storico | a pagamento (da ~50 $/mese) | sovradimensionati per un'asta |
| Scraping di fantacalcio.it / fantacalcio-online.com | voti e statistiche per giornata | gratis | non documentato, si rompe a ogni restyling, termini d'uso da verificare |

Progetti community che affrontano lo stesso problema, utili come riferimento:
[piopy/fantacalcio-py](https://github.com/piopy/fantacalcio-py) (usa CSV di FPEDIA/FSTATS) e
[dandolodavid/fantasta_docker](https://github.com/dandolodavid/fantasta_docker) (wrapper HTTP
sopra lo scraping di fantacalcio.it).

### Arricchimento opzionale (football-data.org)

`scripts/fetch_enrichment.mjs` scarica rose, capocannonieri e calendario Serie A e li salva in
`src/data/enrichment.json`. Gira in Node, quindi **il token non finisce nel bundle**.

```bash
# 1. token gratuito: https://www.football-data.org/client/register
# 2. .env con:  FOOTBALL_DATA_TOKEN=xxxxx
npm run enrich
```

Il file prodotto **non e' ancora collegato all'interfaccia**: i nomi di football-data.org
(`Lautaro Martinez`) non combaciano con quelli del listone (`Martinez L.`), e un match fuzzy
sbagliato in asta e' peggio del dato mancante. I dati sono pronti per chi vuole aggiungere il
collegamento con una tabella di corrispondenze.

## Struttura

```
avvia.cmd                    doppio clic su Windows: compila (se serve) e apre
.github/workflows/pages.yml  deploy automatico su GitHub Pages
data/                        .xlsx ufficiali (il watcher guarda qui)
data/extra.json              titolari, rigoristi, piazzati, prezzi di mercato
scripts/ingest_xlsx.py       .xlsx + extra.json -> src/data/listone.json
scripts/fetch_enrichment.mjs football-data.org -> src/data/enrichment.json
scripts/serve.mjs            server statico senza dipendenze per dist/
vite.config.ts               plugin autoIngest: rigenera il listone al volo
src/lib/listone.ts           caricamento listone, ricerca, accessori per modalita'
src/lib/stats.ts             crediti, slot, offerta massima, statistiche di lega
src/lib/market.ts            listino d'asta: curva di prezzo per reparto
src/lib/advice.ts            prezzo atteso e Score dei consigli
src/lib/plans.ts             strategie, coppia portieri, piani rosa
src/store/useAuction.ts      stato asta (zustand + persist), undo, obiettivi, prezzi corretti
src/components/              Asta, Piani, Squadre, Statistiche, Impostazioni
```

## Backup

**Esporta il JSON prima e durante l'asta** (Impostazioni → Esporta backup). Svuotare la cache del
browser o cambiare computer cancella tutto: il file esportato e' l'unico modo per recuperare.

## Stack

Vite · React 19 · TypeScript · Tailwind 4 · zustand. Nessuna dipendenza runtime esterna,
nessuna chiamata di rete a meno che non lanci l'arricchimento.
