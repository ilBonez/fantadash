# Modifiche: il workbook Fantacalcio Classic come unica fonte

Questo branch sostituisce le fonti dati della dashboard con un solo file — il workbook
`Fantacalcio_Classic_202627_Listone_e_Asta.xlsx` — e costruisce l'interfaccia intorno ai dati che
quel file porta e che prima non c'erano: fasce, note di titolarita' e infortuni, statistiche
2025/26 e 2026/27, e gli abbinamenti di calendario.

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
- **Rendimento** — presenze, media voto, fantamedia, gol, assist, rigori e cartellini del 2025/26;
  fantamedia ponderata; le giornate gia' giocate del 2026/27; gerarchia e bonus.
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

## 5. I quattro ceduti del 2 settembre

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

## 6. Cose minori

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
  src/lib/abbinamenti.ts                                 coppie e terzetti fra i liberi
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
