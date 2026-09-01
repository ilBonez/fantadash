#!/usr/bin/env python3
"""Converte il listone ufficiale Fantacalcio (.xlsx) in src/data/listone.json.

Uso:
    python scripts/ingest_xlsx.py [percorso.xlsx]

Se il percorso non viene passato, prende il file .xlsx piu recente in data/.
Se esiste data/extra.json, i suoi dati curati (titolari, rigoristi, tiratori,
note, prezzi attesi) vengono agganciati ai giocatori per nome e squadra.
Ogni nome che non trova corrispondenza viene stampato: nulla spariscee in
silenzio.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "listone.json"
EXTRA = ROOT / "data" / "extra.json"

# L'header ufficiale sta sulla riga 2, la riga 1 e' il titolo.
HEADER_ROW = 2
COLS = ["Id", "R", "RM", "Nome", "Squadra", "Qt.A", "Qt.I", "Diff.",
        "Qt.A M", "Qt.I M", "Diff.M", "FVM", "FVM M"]

# Token tipo "L.", "Jo.", "D.S.": nel listone sono le iniziali del nome proprio.
INITIAL = re.compile(r"^(?:[A-Za-z]{1,2}\.)+$")


def pick_source(argv: list[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1])
    candidates = sorted((ROOT / "data").glob("*.xlsx"), key=lambda p: p.stat().st_mtime)
    if not candidates:
        sys.exit("Nessun .xlsx trovato in data/. Passa il percorso come argomento.")
    return candidates[-1]


def read_sheet(ws) -> list[dict]:
    rows = list(ws.iter_rows(min_row=HEADER_ROW, values_only=True))
    header = [str(c).strip() if c is not None else "" for c in rows[0]]
    missing = [c for c in COLS if c not in header]
    if missing:
        sys.exit(f"Foglio '{ws.title}': colonne mancanti {missing}. Header letto: {header}")
    idx = {c: header.index(c) for c in COLS}

    out = []
    for row in rows[1:]:
        if row[idx["Id"]] is None or row[idx["Nome"]] is None:
            continue
        rm = str(row[idx["RM"]] or "").strip()
        out.append({
            "id": int(row[idx["Id"]]),
            "r": str(row[idx["R"]]).strip(),
            "rm": [x for x in (s.strip() for s in rm.split(";")) if x],
            "nome": str(row[idx["Nome"]]).strip(),
            "squadra": str(row[idx["Squadra"]]).strip(),
            "qtA": num(row[idx["Qt.A"]]),
            "qtI": num(row[idx["Qt.I"]]),
            "diff": num(row[idx["Diff."]]),
            "qtAM": num(row[idx["Qt.A M"]]),
            "qtIM": num(row[idx["Qt.I M"]]),
            "diffM": num(row[idx["Diff.M"]]),
            "fvm": num(row[idx["FVM"]]),
            "fvmM": num(row[idx["FVM M"]]),
        })
    return out


def num(v) -> float:
    if v is None or v == "":
        return 0
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    return int(f) if f == int(f) else f


# --- agganciare i nomi di extra.json al listone -----------------------------


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def norm_token(t: str) -> str:
    # Via accenti, punti e apostrofi: "N'Dicka" e "Ndicka" devono coincidere.
    return re.sub(r"[.'’]", "", strip_accents(t)).lower()


def split_name(nome: str) -> tuple[list[str], list[str]]:
    """Separa cognome e iniziali: "Martinez Jo." -> (["martinez"], ["j"])."""
    base, initials = [], []
    for t in nome.split():
        if INITIAL.match(t):
            initials.extend(c.lower() for c in t if c.isalpha())
        else:
            base.append(norm_token(t))
    return base, initials


def find_run(haystack: list[str], needle: list[str]) -> int | None:
    n = len(needle)
    for i in range(len(haystack) - n + 1):
        if haystack[i:i + n] == needle:
            return i
    return None


def match_player(nome_sorgente: str, candidati: list[dict]) -> dict | None:
    """Trova il giocatore del listone che corrisponde a un nome dell'overlay.

    Il listone scrive "Cognome I.", le fonti scrivono "Nome Cognome": si cerca
    il cognome come sequenza di token e si controlla l'iniziale sul resto.
    Un nome ambiguo (due Martinez nella stessa squadra) non viene agganciato.
    """
    src = [norm_token(t) for t in nome_sorgente.split()]
    best: list[tuple[int, dict]] = []

    for p in candidati:
        base, initials = split_name(p["nome"])
        if not base:
            continue
        pos = find_run(src, base)
        if pos is None:
            continue
        resto = src[:pos] + src[pos + len(base):]
        if initials and resto and not any(r.startswith(i) for r in resto for i in initials):
            continue
        best.append((len(base) * 10 + (1 if initials else 0), p))

    if not best:
        return None
    best.sort(key=lambda x: -x[0])
    # Pareggio in testa: ambiguo, meglio non indovinare.
    if len(best) > 1 and best[0][0] == best[1][0]:
        return None
    return best[0][1]


def apply_extra(players: list[dict]) -> tuple[dict, list[str]]:
    """Aggancia data/extra.json ai giocatori. Ritorna (note squadre, problemi)."""
    if not EXTRA.exists():
        return {}, []

    extra = json.loads(EXTRA.read_text(encoding="utf-8"))
    problemi: list[str] = []
    per_squadra: dict[str, list[dict]] = {}
    for p in players:
        per_squadra.setdefault(p["squadra"], []).append(p)

    note_squadre: dict[str, str] = {}

    for squadra, dati in (extra.get("squadre") or {}).items():
        candidati = per_squadra.get(squadra)
        if not candidati:
            problemi.append(f"squadra '{squadra}' non presente nel listone")
            continue
        if dati.get("nota"):
            note_squadre[squadra] = dati["nota"]

        def aggancia(nomi: list[str], etichetta: str):
            for i, nome in enumerate(nomi or []):
                p = match_player(nome, candidati)
                if p is None:
                    problemi.append(f"{squadra}: '{nome}' ({etichetta}) non agganciato")
                    continue
                yield i, p

        for _, p in aggancia(dati.get("titolari"), "titolare"):
            p["titolare"] = True
        for i, p in aggancia(dati.get("rigoristi"), "rigorista"):
            # 1 = primo rigorista, 2 = alternativa.
            p["rigorista"] = 1 if i == 0 else 2
        for _, p in aggancia(dati.get("punizioni"), "punizioni"):
            p["punizioni"] = True
        for _, p in aggancia(dati.get("angoli"), "angoli"):
            p["angoli"] = True

    for voce in extra.get("giocatori") or []:
        candidati = per_squadra.get(voce.get("squadra", ""))
        if not candidati:
            problemi.append(f"giocatore '{voce.get('nome')}': squadra '{voce.get('squadra')}' sconosciuta")
            continue
        p = match_player(voce["nome"], candidati)
        if p is None:
            problemi.append(f"{voce['squadra']}: '{voce['nome']}' (scheda) non agganciato")
            continue
        for campo in ("gol", "atteso", "nota", "fm2025", "gol2025"):
            if voce.get(campo) is not None:
                p[campo] = voce[campo]

    return note_squadre, problemi


def main() -> None:
    src = pick_source(sys.argv)
    wb = openpyxl.load_workbook(src, data_only=True)

    players = read_sheet(wb["Tutti"])
    ceduti_ids = set()
    if "Ceduti" in wb.sheetnames:
        ceduti = read_sheet(wb["Ceduti"])
        ceduti_ids = {p["id"] for p in ceduti}
        # I ceduti non sono nel foglio "Tutti": li aggiungiamo marcati.
        known = {p["id"] for p in players}
        for p in ceduti:
            if p["id"] not in known:
                players.append(p)

    for p in players:
        p["ceduto"] = p["id"] in ceduti_ids

    attivi = [p for p in players if not p["ceduto"]]
    note_squadre, problemi = apply_extra(attivi)

    title = str(wb["Tutti"]["A1"].value or "").strip()
    payload = {
        "stagione": title,
        "sorgente": src.name,
        "generatoIl": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "conteggi": {
            r: sum(1 for p in attivi if p["r"] == r)
            for r in ("P", "D", "C", "A")
        },
        "ceduti": len(ceduti_ids),
        "noteSquadre": note_squadre,
        "giocatori": sorted(players, key=lambda p: (p["r"], -p["qtA"], p["nome"])),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{src.name} -> {OUT.relative_to(ROOT)}")
    print(f"  {len(players)} giocatori ({payload['conteggi']}), {len(ceduti_ids)} ceduti")
    if EXTRA.exists():
        marcati = sum(1 for p in attivi if p.get("titolare"))
        rig = sum(1 for p in attivi if p.get("rigorista"))
        print(f"  extra.json: {marcati} titolari, {rig} rigoristi agganciati")
    if problemi:
        print(f"  {len(problemi)} voci di extra.json non agganciate:")
        for x in problemi:
            print(f"    - {x}")


if __name__ == "__main__":
    main()
