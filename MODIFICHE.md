# Modifiche: il workbook Fantacalcio Classic come unica fonte

Questo branch sostituisce le fonti dati della dashboard con un solo file — il workbook
`Fantacalcio_Classic_202627_Listone_e_Asta.xlsx` — e costruisce l'interfaccia intorno ai dati che
quel file porta e che prima non c'erano: fasce, note di titolarita' e infortuni, statistiche
2025/26 e 2026/27, e gli abbinamenti di calendario.

Sopra al workbook stanno due sole correzioni, entrambe versionate e spiegate: chi ha lasciato la
Serie A dopo la sua data, e le probabili formazioni lette da due siti per rivedere la gerarchia
titolare/riserva, che il workbook deduce dalle sole quotazioni.

Tutto verificato con `npm run build` (typecheck + bundle) e provato in browser su tutte le viste.

---

## 1. Una sola fonte dati

**Aggiunto**: `data/Fantacalcio_Classic_202627_Listone_e_Asta.xlsx`

**Rimosso**:

| File | Cos'era | Perche' via |
| --- | --- | --- |
| `data/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx` | il listone ufficiale | sostituito dal workbook |
| `data/extra.json` | overlay curato a mano: titolari, rigoristi, piazzati, prezzi di mercato | il workbook ha gli stessi dati, e molti di piu', gia' allineati al listone |
| `scripts/fetch_enrichment.mjs` + script npm `enrich` | download da football-data.org | seconda fonte da tenere allineata, mai collegata all'interfaccia |

`scripts/ingest_xlsx.py` e' riscritto. Prima leggeva due fogli e agganciava `extra.json` per nome;
ora legge tutto il workbook:

| Foglio | Cosa ne esce |
| --- | --- |
| `Portieri` / `Difensori` / `Centrocampisti` / `Attaccanti` | 535 giocatori x 35 colonne: prezzi, fascia, gerarchia, nota, rigoristi, calci piazzati, statistiche 25/26 e 26/27, abbinamento di calendario |
| `Abbinamenti` | matrice 20x20 delle trasferte in comune, migliori e peggiori coppie di squadre, top 20 terzetti di portieri |
| `Infortunati` | categoria e tempi di recupero, agganciati al giocatore |
| `DB` | la sigla a tre lettere di ogni squadra, che da' la chiave `Cognome (SIG)` |
| `Guida` | parametri di lega (budget, squadre, slot, quote) e i testi di legenda e metodo |

Due scelte di robustezza: se un foglio ha intestazioni diverse da quelle attese lo script **esce con
errore** invece di produrre un JSON mezzo vuoto in silenzio; e stampa quanti giocatori, squadre,
coppie e note ha letto, cosi' si vede subito se qualcosa e' andato perso.

I parametri di lega non sono piu' cablati nel codice: budget (500), numero squadre (10) e slot
(3-8-8-6) arrivano dal foglio `Guida` e diventano i default delle impostazioni.

### La modalita' Mantra non c'e' piu'

Il workbook e' Classic e non porta `Qt.A M` / `FVM M`. Lasciare uno switch Mantra che restituisce
zeri sarebbe stato peggio che toglierlo, quindi il tipo `Mode` e tutto quello che lo attraversava
(`quot(p, mode)`, `fvm(p, mode)`, il selettore nell'header, il filtro per ruolo Mantra) sono spariti.
Il **ruolo Mantra per esteso** — "Esterno basso / Esterno alto" — resta, e si legge nella scheda del
giocatore.

### Attenzione ai salvataggi

La chiave di `localStorage` passa da `fantadash.v1` a **`fantadash.v2`**: gli id giocatore sono
cambiati sorgente, e un salvataggio vecchio punterebbe a persone sbagliate. Chi aveva un'asta in
corso ricomincia da zero — ma un'asta in corso con i nomi sbagliati sarebbe stato molto peggio.

---

## 2. Le fasce

Il workbook divide ogni reparto in sei fasce: `Top`, `1a`, `2a`, `3a`, `4a`, `Scommessa`. Sono
relative al reparto, e la distribuzione lo dice bene:

| | Top | 1a | 2a | 3a | 4a | Scommessa |
| --- | --- | --- | --- | --- | --- | --- |
| Portieri | | | 5 | 12 | 9 | 38 |
| Difensori | | 1 | 3 | 53 | 117 | 15 |
| Centrocampisti | | 8 | 35 | 110 | 31 | 9 |
| Attaccanti | 9 | 24 | 30 | 22 | 4 | |

I nove `Top` sono tutti attaccanti, i difensori arrivano al massimo a un `1a fascia`, i portieri
partono dalla `2a`.

In dashboard le fasce compaiono in tre punti: un badge colorato su ogni riga, una fila di chip sopra
la lista per filtrare, e una colonna ordinabile.

---

## 3. La scheda che si apre in asta

La lista non puo' mostrare 35 colonne, ma in asta si guarda un giocatore alla volta — e sono i
trenta secondi in cui serve avere tutto davanti. Quindi: la lista resta leggibile, e cliccando una
riga (o `Enter` dalla ricerca) si apre **sopra la barra di assegnazione** la scheda completa.

Nuovo file: `src/components/PlayerCard.tsx`.

- **Fascia di stato** a tutta larghezza in cima: infortunio con tempi di recupero su fondo rosso
  (lungo stop) o ambra (rientro a breve, in dubbio), altrimenti la nota di titolarita'.
- **Prezzi** — quotazione iniziale e attuale, FVM, consigliato e massimo del listone, listino d'asta,
  FVM per credito, Score, e il massimo che la tua squadra puo' ancora offrire.
- **Rendimento** — presenze in Serie A 2025/26, media voto, fantamedia, gol, assist, rigori e
  cartellini; fantamedia ponderata; le giornate gia' giocate del 2026/27; gerarchia e bonus.
- **Ballottaggio** — chi si gioca il posto con lui, con la stella per segnare l'alternativa.
- **Abbinamenti di calendario** — coppia e terzetto migliori fra i liberi, l'abbinamento fisso del
  listone, e le trasferte in comune con i giocatori dello stesso reparto **che hai gia' in rosa**.
- In fondo, i motivi che compongono lo Score.

La barra sotto resta minimale (nome, Qt.A, consigliato/max, listino, prezzo, squadre, `Assegna`):
il flusso da tastiera non cambia di una battuta.

### Le sigle accanto al nome

Rifatte sui dati nuovi (`src/components/PlayerTags.tsx`):

| Prima | Adesso |
| --- | --- |
| `R` rigorista, `r` alternativa | `R1` `R2` `R3` `R4` — l'ordine esatto |
| `P` punizioni, `C` angoli | `P1` `P2` `P3` — l'ordine sui calci piazzati |
| `T` titolare | `T` titolare, `B` ballottaggio |
| — | `!` nota di infortunio, colorata per gravita' |
| — | `N` nuovo: cambia squadra o arriva da fuori Serie A |

### Lo Score tiene conto dello stato fisico

`src/lib/advice.ts` pesa ora anche gerarchia e infortuni:

- rigorista da x1,15 (primo) a x1,01 (quarto); calci piazzati da x1,05 a x1,01;
- gerarchia: x1,10 titolare, x0,95 ballottaggio, x0,80 riserva;
- **stato fisico: x0,60 lungo stop, x0,85 rientro entro settembre, x0,95 in dubbio.**

Esempio: Yildiz e' quotato 22 con FVM 100, ma con il piede rotto fino a fine novembre lo Score
scende a 13. E' esattamente il tipo di cosa che il listino da solo non sa.

### Prezzo consigliato e prezzo massimo

Il workbook porta un prezzo consigliato e un massimo per ogni giocatore, tarati su 500 crediti e 10
squadre. **Non** li ho usati come prezzo atteso: il listino dinamico esistente si muove con l'asta e
resta piu' utile. Sono invece una colonna a se' (`Cons`, formato `consigliato/max`), e quando il
listino d'asta supera il massimo il numero diventa ambra — la lega lo sta pagando piu' di quanto
valga.

La precedenza del prezzo `Asta` si semplifica: prima la tua correzione a mano, poi il listino. Il
gradino intermedio (`data/extra.json`) non esiste piu'.

---

## 4. Abbinamenti di calendario: coppie e terzetti

Nuovo file: `src/lib/abbinamenti.ts`. Nuova vista: `src/components/GriglieView.tsx`.

Il numero che conta e' **quante volte su 38 giornate due squadre giocano entrambe in trasferta**.
Piu' e' basso, meglio i due giocatori si coprono: quando uno e' fuori casa l'altro quasi sempre e' in
casa, quindi ruotandoli si schiera quasi sempre quello favorito.

Una cosa che vale la pena sapere: i derby di citta' (Inter-Milan, Roma-Lazio, Juventus-Torino) stanno
a 0, e da questo segue un'identita' del calendario. Se due squadre non vanno mai fuori insieme, una
terza squadra qualsiasi divide le sue 19 trasferte fra le due — **la somma delle tre coppie fa
esattamente 19**. E' il minimo possibile, ed e' il motivo per cui i terzetti migliori contengono
sempre un derby.

### La colonna Abbinamento

Nella lista d'asta, due righe per giocatore: sopra la coppia migliore (nome, sigla e trasferte in
comune, colorate col giudizio del workbook — `Perfetto` fino a 3, `Ottimo` fino a 6, poi `Nella
media` e `Da evitare`), sotto il terzetto col suo totale.

Sono calcolati **sui giocatori ancora liberi**, non una volta per tutte: appena qualcuno compra il
partner ideale, la colonna propone il migliore fra quelli che restano. E' la parte che serve
davvero durante l'asta.

Il punteggio pesa **60% qualita'** (l'indice di priorita' del listone, normalizzato sul reparto) e
**40% copertura** di calendario. E' una scelta esplicita e discutibile: un portiere da 1 credito che
copre perfettamente il calendario non serve a niente, e la copertura da sola metterebbe in cima i
tappabuchi. Il peso e' una costante in cima al file, facile da spostare.

Il costo e' tenuto basso restringendo il bacino ai 40 migliori liberi per reparto: il partner ideale
non e' mai il 150esimo difensore, e la ricerca del terzetto (quadratica) resta nell'ordine dei
millisecondi.

### La vista Griglie

Nuova tab fra Asta e Piani:

- la **matrice 20x20** colorata (verde = si coprono, rosso = da evitare);
- le classifiche di **coppie di squadre** migliori e peggiori, direttamente dal workbook;
- **coppie e terzetti consigliati** per reparto, con costo del blocco e indice medio, filtrabili sui
  soli giocatori liberi;
- per i portieri, la **top 20 fissa** dei terzetti calcolata nel workbook, accanto a quella live.

Le griglie limitano a tre le comparsate dello stesso nome. Senza quel limite il miglior giocatore
del reparto si prendeva 7 righe su 10: una classifica corretta e inutile da leggere.

### Anche i piani rosa usano il calendario

`src/lib/plans.ts`: il blocco portieri non e' piu' "titolare + riserva della stessa squadra". Ora si
enumerano tutte le terne di portieri liberi che stanno nel budget del reparto e si prende quella col
miglior compromesso fra qualita' e trasferte in comune. La colonna "Blocco portieri" del confronto
mostra le sigle e il totale.

---

## 5. Titolare o riserva: revisione sulle fonti

La `Gerarchia stimata` del workbook e' derivata dalle quotazioni dentro la stessa squadra e ruolo.
Sui portieri funziona; in mezzo al campo no, perche' un titolare che il mercato non valuta sembra
una riserva.

Ho letto le probabili formazioni da due fonti — [fantacalcio-online.com](https://www.fantacalcio-online.com/it/consigli-fantacalcio/formazioni-tipo-serie-a-2026-2027)
e [fantacalcio.it](https://www.fantacalcio.it/news/calcio-italia/06_08_2026/asta-fantacalcio-le-probabili-formazioni-della-serie-a-enilive-2026-27-495558) —
e le ho messe in `data/formazioni-tipo.json` con URL e data. L'ingest le aggancia al listone e
scrive su ogni giocatore `fonti`: quante delle due lo mettono nell'undici.

### Cosa e' venuto fuori dal confronto

- **Portieri: 18 su 20 combaciano** col workbook. Solo Monza (Thiam / Tornqvist) e Parma (Daffara /
  Corvi) sono contesi, con le due fonti che dicono cose diverse. Il dato ora lo riflette invece di
  scegliere per conto suo.
- **33 giocatori che entrambe le fonti schierano titolari, ma il workbook classifica Ballottaggio o
  Riserva.** I piu' cari: De Ketelaere (52 crediti consigliati), Diao (36), Ghedjemis (22), Maldini
  (21), Politano e Vitinha (16), Locatelli e Perrone (15).
- **29 dati Titolare dal workbook e assenti da entrambe le formazioni tipo**, in testa Woltemade
  (72 crediti) e Krstovic (53).

### Come viene usata la revisione

La gerarchia in dashboard segue l'attendibilita' della prova: entrambe le fonti, poi la fonte
singola, poi il workbook, e in ultimo il primo per quotazione. Il caso che mostra perche' serve il
secondo gradino: **Yildiz** e' quotato 22 e il workbook lo mette dietro Woltemade (23); una fonte
pero' schiera Yildiz e non Woltemade, e l'ordine si inverte correttamente.

Il matcher dei nomi e' il punto fragile — il listone scrive `Martinez Jo.`, le fonti `Martínez
Josep` o solo `Martinez`. Cerca il cognome fra i token della fonte e verifica l'iniziale sul resto,
sfruttando il fatto che nel listone le iniziali hanno **sempre** il punto (cosi' `De Gea` e `Van Der
Brempt` non vengono scambiati per iniziali). **Un nome ambiguo non viene agganciato**: all'Inter la
fonte che scrive solo `Martinez` potrebbe essere il portiere o l'attaccante. Restano 3 nomi non
agganciati su 439, tutti stampati dall'ingest: Norton-Cuffy (ceduto) e i due Martinez dell'Inter.

## 6. Il blocco Ballottaggio nella scheda

Nuovo file: `src/lib/ballottaggi.ts`. Il gruppo di confronto e' **squadra + ruolo Mantra** — due
giocatori con lo stesso ruolo esteso nella stessa squadra si contendono lo stesso posto. Il ruolo
Classic sarebbe troppo grosso: otto difensori non sono tutti alternative l'uno dell'altro.

Nella scheda d'asta il blocco dice in una riga:

- se parte titolare, **chi e' la sua riserva diretta**, quella che ne raccoglie il voto quando salta;
- se non parte, **quale titolare ha davanti**;
- **"Non in ballottaggio"** quando nessun altro in squadra ha il suo ruolo (97 giocatori su 531).

Sotto c'e' il gruppo intero in ordine, col pallino verde su chi parte, il consenso delle fonti
(`n/2`) e il prezzo consigliato. **Ogni nome ha la sua stella**: si segna l'alternativa come
obiettivo senza uscire dalla scheda e senza perdere il giocatore in asta in quel momento.

Verificato in browser: da Yildiz la scheda indica Woltemade come riserva diretta e la stella lo
aggiunge agli obiettivi mentre Yildiz resta in asta; da Woltemade indica Yildiz come titolare
davanti; Pinamonti risulta "non in ballottaggio".

## 7. Presenze 2025/26 nella scheda

Prima le presenze stavano solo nel tooltip. Ora sono la **prima riga** del blocco Rendimento, con il
colore che fa il lavoro: verde da 25 presenze in su, ambra sotto 10. Chi non era in Serie A nel
2025/26 lo legge scritto — "Non era in Serie A nel 2025/26. Nessuna presenza, nessuno storico su cui
basarsi" — invece di vedere degli zeri che sembrano un rendimento pessimo.

## 8. I quattro ceduti del 2 settembre

Vaz (Roma), Fofana Y. (Milan), Norton-Cuffy (Genoa) e Ratkov (Lazio) hanno lasciato la Serie A dopo
la data del workbook. Il listone passa da 535 a **531**.

Non ho cancellato le righe dentro l'`.xlsx`: il foglio `DB` indicizza i giocatori per numero di riga
e alimenta i menu a tendina del foglio `Asta`, quindi cancellare righe romperebbe il workbook come
strumento a se'. C'e' invece **`data/ceduti.txt`**, una chiave per riga, che l'ingest applica sopra
al file:

```
# --- 2 settembre 2026: ceduti all'estero nella notte ---
Vaz (ROM)
Fofana Y. (MIL)
Norton-Cuffy (GEN)
Ratkov (LAZ)
```

Tre dettagli:

- **Gli id restano stabili.** Vengono assegnati prima dell'esclusione, quindi aggiungere un nome non
  rinumera nessun altro e le assegnazioni gia' fatte continuano a puntare al giocatore giusto.
- **Un refuso ferma l'ingest.** Una chiave che non corrisponde a nessuno esce con errore invece di
  essere ignorata: un cognome scritto male sarebbe un giocatore che resta comprabile per sbaglio.
- **Niente abbinamenti orfani.** Se un ceduto era il "miglior abbinamento" di qualcun altro quel
  consiglio viene azzerato. Stavolta non capitava a nessuno dei quattro, ma la protezione c'e'.

`vite.config.ts` sorveglia anche questo file, quindi con `npm run dev` attivo basta salvarlo.

---

## 9. Il listino d'asta rifatto

Il vecchio modello ricostruiva una curva di prezzo da FVM con una gamma calibrata, divideva ogni
reparto in due blocchi e li riscalava con moltiplicatori limitati. Circa 185 righe per riprodurre
qualcosa che il workbook aveva gia' calcolato.

Adesso si parte dal **prezzo consigliato** e si modella solo lo scostamento:

```
prezzo = consigliato x spintaDellaFascia x lambda     dentro [1, offerta massima sostenibile]
```

**Spinta della fascia** — dipende da quanta parte della fascia e' gia' andata, elevata a 0,6 perche'
ogni acquisto alzi meno del precedente. Contagio 0,35 alla fascia adiacente, troncato oltre.
L'ampiezza (quanto una fascia *puo'* scaldarsi) non e' un parametro: e' `quota crediti / quota
giocatori` letta dal listone, quindi il modello scopre da solo che gli attaccanti Top si scaldano e
quelli di 2a fascia no.

Verificato dal vivo comprando i primi due Top — prezzo medio dei rimanenti:

| | Top | 1a | 2a | 3a | 4a |
| --- | --- | --- | --- | --- | --- |
| inizio | 92,3 | 43,0 | 20,4 | 1 | 1 |
| dopo Malen | **114,0** | 47,6 | 20,5 | 1 | 1 |
| dopo Martinez L. | **122,4** | 50,3 | 21,2 | 1 | 1 |

**Lambda** — tiene insieme il portafoglio (crediti per slot che restano) e la temperatura osservata
(quanto la lega ha pagato sopra il consigliato). A inizio asta spendere tanto vuol dire "lega calda";
a fine asta vuol dire "non ci sono piu' soldi": il peso si sposta dall'una all'altro con
l'avanzamento. Ci si fida della temperatura osservata solo man mano che le assegnazioni la rendono
credibile, e lambda e' limitata fra 0,5 e 2.

Tarato su aste simulate contro tre curve di lega. Errore medio sui primi 60 giocatori chiamati:

| Lega | prima | adesso |
| --- | --- | --- |
| calda (top strapagati) | 32% | **17%** |
| piatta (disciplinata) | 17% | 23% |
| tardiva (tutti tengono) | 47% | **32%** |

Due cose che le prove hanno smentito rispetto a quanto avevo proposto: la **banda morta** sulla
temperatura osservata non serviva (peggiorava due scenari su tre, tolta), e il **tetto su lambda**
serviva molto piu' del previsto — nella lega tardiva l'errore finale passa da 24 crediti a 4.

Il selettore Freddo/Normale/Caldo cambia significato: non scala piu' il picco della curva, ma fissa
l'attesa di partenza (0,85x / 1,00x / 1,35x) prima che ci siano assegnazioni da cui imparare. E'
l'unica leva sul punto cieco del modello, il primo quarto d'asta.

## 10. Infortuni successivi al workbook

`data/infortuni.json` aggiunge o sovrascrive lo stato fisico di un giocatore dopo la data del
workbook, con lo stesso vocabolario del foglio Infortunati (e quindi gli stessi pesi nello Score).
Primo caso: **Thuram K. (Juventus)**, operato al ginocchio, rientro previsto a febbraio 2027 — da
"In dubbio per la prossima" a "Infortunato - lungo stop", con il moltiplicatore che scende da 0,95 a
0,60. Come per i ceduti, una chiave che non corrisponde a nessuno ferma l'ingest.

## 11. Cose minori

- Il plugin `autoIngest` non stampa piu' un falso `ingest fallito (-2)` su macOS: il comando `python`
  non esiste, e l'avviso usciva prima che scattasse il fallback su `python3`.
- `README.md` riscritto nelle sezioni sui dati, con le nuove sezioni su fasce, scheda d'asta,
  abbinamenti e ceduti.
- `package.json`: via lo script `enrich`.

---

## File toccati

```
nuovi
  data/Fantacalcio_Classic_202627_Listone_e_Asta.xlsx   la fonte
  data/ceduti.txt                                       chi e' uscito dopo il workbook
  data/formazioni-tipo.json                              undici probabili da due fonti
  data/infortuni.json                                    infortuni dopo la data del workbook
  src/lib/abbinamenti.ts                                 coppie e terzetti fra i liberi
  src/lib/ballottaggi.ts                                 chi si gioca il posto con chi
  src/components/PlayerCard.tsx                          la scheda che si apre in asta
  src/components/GriglieView.tsx                         matrice, coppie, terzetti
  MODIFICHE.md                                           questo file

rimossi
  data/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx
  data/extra.json
  scripts/fetch_enrichment.mjs

riscritti
  scripts/ingest_xlsx.py       tutto il workbook -> listone.json
  src/types.ts                 Player, Listone, fasce; via Mode
  src/lib/listone.ts           filtri nuovi, matrice calendario, via le funzioni per modalita'
  src/components/PlayerTable.tsx  colonne Fascia, Prio, Cons/max, Abbinamento
  src/components/PlayerTags.tsx   sigle nuove

adattati
  src/lib/advice.ts  market.ts  stats.ts  plans.ts  useLeague.ts
  src/store/useAuction.ts  src/App.tsx
  src/components/AstaView.tsx  AssignBar.tsx  Header.tsx  SetupView.tsx  StatsView.tsx
  src/components/LoginSplash.tsx  PlansView.tsx  ui.tsx
  vite.config.ts  package.json  README.md
```

## Per provarlo

```bash
npm install
npm run dev
```
