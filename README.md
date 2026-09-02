# FantaDash

Dashboard locale per l'asta del fantacalcio di Serie A: segna i giocatori acquistati, traccia i
crediti tuoi e degli avversari, vedi in tempo reale chi manca a chi e le statistiche su affari,
scommesse e top acquisti. Ogni giocatore ha la sua fascia, le sue statistiche, le note su
titolarita' e infortuni, e gli abbinamenti di calendario — coppie e terzetti che si coprono a
vicenda — calcolati sui giocatori ancora liberi.

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

Apre `http://localhost:5180`. Il listone Fantacalcio Classic 2026/27 e' gia' incluso: 535 giocatori
con prezzi consigliati, fasce, note, infortunati e abbinamenti di calendario, meno quelli elencati in
`data/ceduti.txt`.

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

## Accesso e dati: chi vede cosa

All'apertura c'e' una schermata di accesso: nome nel formato `nome.cognome` e una
password qualsiasi. Serve a dare un nome a chi apre la dashboard, e il nome
compare nell'intestazione. Si esce da Impostazioni.

**Non e' una misura di sicurezza e non prova a esserlo.** Il controllo gira nel
browser, quindi chiunque puo' leggere il bundle o saltare la schermata. Sta
scritto anche in cima a `src/lib/utente.ts`, perche' nessuno lo prenda per
protezione leggendo il codice.

Del resto non c'e' nulla da proteggere: **ogni browser ha la sua asta**. Il sito
serve solo file statici, non esiste un server ne' un database. Due persone che
aprono lo stesso indirizzo vedono due aste separate e vuote; niente di quello che
fai tu arriva a loro, e viceversa. Nessun dato lascia il tuo dispositivo.

Per spostare un'asta tra i tuoi dispositivi: Impostazioni → Esporta backup JSON,
poi Importa sull'altro.

Se un giorno servisse accesso vero, la strada e' un controllo **lato server**
davanti al sito, non codice nel browser: con l'hosting su Cloudflare Pages,
[Cloudflare Access](https://cloudflare.com/products/cloudflare-access) fa login
con PIN via email ed e' gratis fino a 50 utenti. Su GitHub Pages non e'
possibile: il sito privato richiede GitHub Enterprise.

## Come si usa durante l'asta

1. **Impostazioni** – nome lega, crediti per squadra, slot per reparto, elenco squadre. La stella
   marca la tua. In fondo, la guida del listone: legenda delle note e note sul metodo.
2. **Piani** – dodici rose candidate costruite sui crediti che ti restano e sui giocatori ancora
   liberi. "Usa come obiettivi" mette la stella a quei giocatori.
3. **Asta** – la lista e' ordinata per `Score`: in cima le scelte migliori per te in questo
   momento. Digita il nome, `Enter` mette il giocatore all'asta, digita il prezzo, scegli la
   squadra, `Enter` assegna. Il focus torna sulla ricerca: si va avanti senza mouse.
4. **Griglie** – la matrice del calendario, le coppie di squadre migliori e peggiori, e le coppie
   e i terzetti consigliati fra i giocatori ancora liberi, reparto per reparto.
5. **Squadre** – matrice "chi manca" (slot mancanti per reparto, crediti residui, offerta massima
   sostenibile) e rose complete.
6. **Statistiche** – inflazione della lega, spesa per reparto, top acquisti, affari, sovrapagati,
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
- **rigorista** – da x1,15 per il primo designato a x1,01 per il quarto;
- **calci piazzati** – da x1,05 per il primo tiratore a x1,01 per il terzo;
- **gerarchia** – x1,10 titolare, x0,95 in ballottaggio, x0,80 riserva;
- **stato fisico** – x0,60 lungo stop, x0,85 rientro entro settembre, x0,95 in dubbio;
- **ti serve?** – se hai gia' riempito gli slot di quel ruolo il punteggio scende al 15%;
- **te lo puoi permettere?** – se il prezzo atteso supera la tua offerta massima sostenibile scende
  al 35%.

Rigori, gerarchia e infortuni pesano perche' le quotazioni sono pubblicate prima che il campionato
inizi: sono l'unica cosa che il listino non sa ancora. Un lungo stop vale piu' di qualunque altra
correzione — Yildiz e' quotato 22 e ha FVM 100, ma con il piede rotto fino a fine novembre lo Score
crolla a 13.

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
2. **il listino modellato**, ricalibrato sull'asta in corso.

Accanto, sempre visibili, ci sono il **prezzo consigliato** e il **prezzo massimo** del listone
(colonna `Cons`, nel formato `consigliato/max`): sono la taratura fissa del workbook su 500 crediti
e 10 squadre. Quando il listino d'asta supera il prezzo massimo il numero diventa ambra: la lega lo
sta pagando piu' di quanto valga per la tua rosa.

La correzione a mano serve quando nessun modello puo' sapere. Malen e' quotato 38, il listone lo
consiglia a 133 e il listino d'asta lo mette a 84: se in asta parte una guerra e arriva a 300, scrivi
300 nel campo `Atteso` e il suo `FVM/cr` crolla insieme allo `Score`. Non e' diventato scarso — a
quel prezzo non conviene, ed e' esattamente quello che devi sapere mentre gli altri rilanciano.

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
| Solo titolari | prima chi il listone da titolare nella sua squadra |
| Rigori e piazzati | rigoristi e tiratori da calcio piazzato |
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

**I portieri hanno una regola a parte, valida per tutte le strategie: si sceglie il blocco che si
copre meglio sul calendario.** Fra i portieri liberi si enumerano tutte le terne che stanno nel
budget del reparto e si prende quella con il miglior compromesso fra qualita' e trasferte in comune,
cosi' ruotandoli si schiera quasi sempre quello che gioca in casa. I portieri sono esclusi da filtri,
tetti e minimi: il blocco viene prima dell'ottimizzazione.

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

## La fonte dei dati

Tutto quello che la dashboard sa viene da **un solo file**:
`data/Fantacalcio_Classic_202627_Listone_e_Asta.xlsx`. Non ci sono overlay curati a mano, file
`extra.json`, chiamate di rete o seconde fonti da tenere allineate: il workbook e' la fonte di
verita' e basta. L'unica cosa che gli sta accanto e' `data/ceduti.txt`, che non aggiunge dati: ne
toglie (vedi sotto).

Dal workbook l'ingest legge:

| Foglio | Cosa ne esce |
| --- | --- |
| `Portieri` / `Difensori` / `Centrocampisti` / `Attaccanti` | il listone: 535 giocatori con prezzi, fascia, gerarchia, nota, rigoristi, piazzati, statistiche 25/26 e 26/27, abbinamento di calendario |
| `Abbinamenti` | matrice 20x20 delle trasferte in comune, migliori e peggiori coppie di squadre, top 20 terzetti di portieri |
| `Infortunati` | categoria e tempi di recupero, agganciati al giocatore |
| `DB` | la sigla a tre lettere di ogni squadra, che da' la chiave `Nome (SIG)` |
| `Guida` | parametri di lega (budget, squadre, slot, quote per reparto) e i testi di legenda e metodo |

**Con `npm run dev` attivo basta copiare il nuovo .xlsx in `data/`**: un plugin Vite se ne accorge,
rilancia l'ingest e la pagina si ricarica da sola. Funziona sia sovrascrivendo il file esistente sia
aggiungendone uno con un nome nuovo (in quel caso diventa lui la sorgente).

A server spento, o per rigenerare a mano:

```bash
npm run ingest
```

Lo script si ferma con un errore se un foglio ha intestazioni diverse da quelle attese, invece di
produrre un JSON vuoto in silenzio, e stampa quanti giocatori, squadre e note ha letto.

**Attenzione ai backup**: gli id dei giocatori sono assegnati dall'ingest, non dal file, quindi
cambiando workbook cambiano. Se sostituisci il file ad asta iniziata, esporta prima il backup JSON e
ricontrolla le assegnazioni. Togliere un nome da `ceduti.txt` invece e' sicuro: gli id si assegnano
prima dell'esclusione, quindi nessun altro giocatore viene rinumerato.

### Chi e' andato via dopo il workbook

Il workbook e' una fotografia al 1 settembre 2026, il mercato no. Chi lascia la Serie A dopo quella
data va in **`data/ceduti.txt`**, una chiave per riga nel formato del listone:

```
# --- 2 settembre 2026: ceduti all'estero nella notte ---
Vaz (ROM)
Fofana Y. (MIL)
Norton-Cuffy (GEN)
Ratkov (LAZ)
```

L'ingest li toglie dal listone: spariscono dalla lista d'asta, dai piani, dalle griglie e dai
suggerimenti di abbinamento, e se erano l'abbinamento consigliato di qualcun altro quel consiglio
viene azzerato invece di puntare a un giocatore che non esiste piu'.

Non si cancellano le righe dentro l'`.xlsx`: il foglio `DB` indicizza i giocatori per numero di riga
e alimenta i menu a tendina del foglio `Asta`, quindi cancellare righe romperebbe il workbook come
strumento a se'.

Una chiave che non corrisponde a nessuno **ferma l'ingest con un errore**: un cognome scritto male e'
un giocatore che resta comprabile per sbaglio, e il silenzio sarebbe il modo peggiore di scoprirlo.
Il file e' guardato dal watcher come il .xlsx: con `npm run dev` attivo basta salvarlo.

## Cosa si vede di ogni giocatore

Le colonne della lista d'asta, da sinistra: ruolo, obiettivo, nome con le sigle, sigla squadra,
fascia, priorita' nel reparto, `Qt.A`, `Cons` (consigliato/max), `Asta` (listino dinamico), `FVM`,
`Score`, `Abbinamento`, prezzo pagato e squadra che lo ha preso.

### Le sigle accanto al nome

| Sigla | Significato |
| --- | --- |
| **!** | nota di infortunio: rosso lungo stop, ambra rientro a breve o in dubbio |
| **R1**, **R2**… | ordine fra i rigoristi della squadra |
| **P1**, **P2**… | ordine fra i tiratori da calcio piazzato |
| **T** | titolare stimato |
| **B** | in ballottaggio |
| **N** | nuovo: cambia squadra o arriva da fuori Serie A, nessuno storico italiano |
| **n** (rosso) | gol nelle giornate gia' giocate del 2026/27 |

### Le fasce

Il workbook divide ogni reparto in sei fasce — `Top`, `1a`, `2a`, `3a`, `4a`, `Scommessa` — e la
dashboard le usa in tre punti: un badge colorato su ogni riga, una fila di chip per filtrare la
lista, e una colonna ordinabile. Le fasce sono relative al reparto e la distribuzione lo dice bene:
i nove `Top` sono tutti attaccanti, i difensori arrivano al massimo a un `1a fascia`, i portieri
partono dalla `2a`. E' la scorciatoia per capire subito in che mercato ti stai muovendo.

### La scheda che si apre in asta

Cliccare una riga (o premere `Enter` dalla ricerca) mette il giocatore all'asta e apre sopra la
barra di assegnazione **la scheda completa**, divisa in tre blocchi:

- **Prezzi** – quotazione iniziale e attuale, FVM, consigliato e massimo, listino d'asta, FVM per
  credito, Score, e il massimo che la tua squadra puo' ancora offrire;
- **Rendimento** – presenze, media voto, fantamedia, gol, assist, rigori, cartellini del 2025/26,
  fantamedia ponderata, le giornate gia' giocate del 2026/27, gerarchia e bonus;
- **Abbinamenti di calendario** – coppia e terzetto migliori fra i liberi, l'abbinamento fisso del
  listone, e le trasferte in comune con i giocatori dello stesso reparto che hai gia' in rosa.

Sopra i tre blocchi, a tutta larghezza, la nota di stato: infortunio con tempi di recupero su fondo
rosso o ambra, altrimenti la nota di titolarita'. Sotto, i motivi che compongono lo `Score`.

E' tutto li' perche' in asta si guarda un giocatore alla volta, e sono i trenta secondi in cui serve
avere prezzi, stato fisico, rendimento e abbinamenti insieme. La lista resta leggibile, la scheda
porta il resto.

## Abbinamenti di calendario: coppie e terzetti

Il numero che conta e' **quante volte su 38 giornate due squadre giocano entrambe in trasferta**.
Piu' e' basso, meglio i due giocatori si coprono: quando uno e' fuori casa l'altro quasi sempre e'
in casa, quindi ruotandoli in formazione si schiera quasi sempre quello favorito. Il caso limite
sono i derby di citta' — Inter-Milan, Roma-Lazio, Juventus-Torino — che non vanno **mai** fuori
insieme: valore 0.

Sui terzetti vale un'identita' del calendario: se due squadre stanno a 0, una terza squadra
qualsiasi divide le sue 19 trasferte fra le due, e la somma delle tre coppie fa esattamente **19**.
E' il minimo possibile, ed e' il motivo per cui i terzetti migliori contengono sempre un derby.

La colonna `Abbinamento` della lista mostra due righe: sopra la coppia migliore (nome, sigla e
trasferte in comune, colorate secondo il giudizio del workbook: `Perfetto` fino a 3, `Ottimo` fino a
6, poi `Nella media` e `Da evitare`), sotto il terzetto con il suo totale. Sono calcolati **sui
giocatori ancora liberi**: appena qualcuno compra il partner ideale, la colonna propone il migliore
fra quelli che restano.

Il punteggio pesa **60% qualita'** (l'indice di priorita' del listone, normalizzato sul reparto) e
**40% copertura** di calendario. E' una scelta esplicita: un portiere da 1 credito che copre
perfettamente il calendario non serve a niente, e la copertura da sola metterebbe in cima i
tappabuchi. La griglia limita a tre le comparsate dello stesso nome, altrimenti il miglior giocatore
del reparto si prenderebbe quasi tutte le righe.

La vista **Griglie** mette insieme la matrice 20x20 colorata, le classifiche di coppie di squadre
del workbook, le coppie e i terzetti consigliati per reparto (con costo consigliato del blocco e
indice medio) e, per i portieri, la top 20 fissa dei terzetti calcolata nel workbook.

Anche i **piani rosa** usano il calendario: il blocco portieri non e' piu' titolare + riserva della
stessa squadra, ma i tre portieri liberi che dentro il budget del reparto si coprono meglio a
vicenda. La colonna "Blocco portieri" mostra le sigle e il totale di trasferte in comune.

## Dati via API: cosa esiste davvero

Sintesi dell'indagine, con la conclusione in cima: **per quotazioni e ruoli fantacalcio non
esiste un'API pubblica ufficiale**. L'Excel resta la fonte autorevole, ed e' il motivo per cui
l'ingest da file e' il percorso principale di questo progetto.

| Fonte | Cosa da' | Costo | Note |
| --- | --- | --- | --- |
| Excel di Fantacalcio.it | quotazioni, ruoli, FVM, statistiche | gratis | la base del workbook usato qui; nessun endpoint documentato, solo download del file |
| [football-data.org](https://www.football-data.org/) | rose, calendario, classifica, capocannonieri Serie A | gratis (top competizioni), 10 req/min | l'unica gratuita con termini chiari; niente quotazioni fantacalcio |
| API-Football / api-sports.io | statistiche giocatore, infortuni, formazioni | free tier ~100 req/giorno | copertura buona, nomi diversi da quelli del listone |
| [Sportmonks](https://www.sportmonks.com/football-api/serie-a-api/), [TheStatsAPI](https://www.thestatsapi.com/football/league/serie-a), [Enetpulse](https://enetpulse.com/italian-serie-a-api/) | dati completi, xG, storico | a pagamento (da ~50 $/mese) | sovradimensionati per un'asta |
| Scraping di fantacalcio.it / fantacalcio-online.com | voti e statistiche per giornata | gratis | non documentato, si rompe a ogni restyling, termini d'uso da verificare |

Progetti community che affrontano lo stesso problema, utili come riferimento:
[piopy/fantacalcio-py](https://github.com/piopy/fantacalcio-py) (usa CSV di FPEDIA/FSTATS) e
[dandolodavid/fantasta_docker](https://github.com/dandolodavid/fantasta_docker) (wrapper HTTP
sopra lo scraping di fantacalcio.it).

## Struttura

```
avvia.cmd                    doppio clic su Windows: compila (se serve) e apre
.github/workflows/pages.yml  deploy automatico su GitHub Pages
data/                        il workbook .xlsx (il watcher guarda qui)
data/ceduti.txt              chi ha lasciato la Serie A dopo la data del workbook
scripts/ingest_xlsx.py       workbook - ceduti.txt -> src/data/listone.json
scripts/serve.mjs            server statico senza dipendenze per dist/
vite.config.ts               plugin autoIngest: rigenera il listone al volo
src/lib/listone.ts           caricamento listone, ricerca, filtri, matrice calendario
src/lib/abbinamenti.ts       coppie e terzetti migliori fra i giocatori liberi
src/lib/stats.ts             crediti, slot, offerta massima, statistiche di lega
src/lib/market.ts            listino d'asta: curva di prezzo per reparto
src/lib/advice.ts            prezzo atteso e Score dei consigli
src/lib/utente.ts            splash di accesso (non e' sicurezza, vedi commento)
src/lib/plans.ts             strategie, blocco portieri, piani rosa
src/store/useAuction.ts      stato asta (zustand + persist), undo, obiettivi, prezzi corretti
src/components/PlayerCard.tsx  la scheda che si apre quando il giocatore va all'asta
src/components/GriglieView.tsx matrice, coppie e terzetti
src/components/              Asta, Griglie, Piani, Squadre, Statistiche, Impostazioni
```

## Backup

**Esporta il JSON prima e durante l'asta** (Impostazioni → Esporta backup). Svuotare la cache del
browser o cambiare computer cancella tutto: il file esportato e' l'unico modo per recuperare.

## Stack

Vite · React 19 · TypeScript · Tailwind 4 · zustand. Nessuna dipendenza runtime esterna e
nessuna chiamata di rete: tutto quello che serve e' nel bundle.
