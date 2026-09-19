#!/usr/bin/env python3
"""
Curated chart memory — the human/Claude-authored "why it moved" notes that sit on top of the
auto-derived event timeline (portfolio.events). This is the part you never want to lose: a
z-score move day is disposable and rebuildable, but the sentence "China banned H20 exports" is
institutional memory. So curated notes live in their own store and are NEVER touched when the
auto timeline is recomputed.

    data/annotations/<TICKER>.json   notes tied to one security
    data/annotations/MACRO.json      market-wide events that paint on EVERY chart

Each note:
    {
      "id": "2025-01-27-deepseek-selloff",   # stable slug, also the dedupe/upsert key
      "date": "2025-01-27",                  # ISO day the thing happened
      "end": null,                           # optional ISO end for a multi-day event
      "scope": "NVDA" | "MACRO",
      "category": "earnings|guidance|product|regulatory|fed|macro-print|geopolitical|decision|other",
      "title": "DeepSeek R1 shock",
      "note": "…what happened, in plain English…",
      "sources": ["https://…"],
      "author": "claude" | "harry",
      "created_at": "2026-09-19T21:00:00Z"
    }

The whole store is gitignored (data/annotations/ — personal, stays on your machine). merge_into_timeline()
folds a ticker's own notes plus all MACRO notes into an events-timeline dict so the dashboard can
render them and the day-inspector can show them first.

    python -m portfolio.annotations add NVDA 2025-01-27 "DeepSeek R1 shock" "China lab..." --category product --source https://...
    python -m portfolio.annotations list NVDA
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date, datetime, timezone

STORE = os.path.join("data", "annotations")

CATEGORIES = (
    "earnings", "guidance", "product", "regulatory", "fed",
    "macro-print", "geopolitical", "decision", "other",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _iso_day(d) -> str:
    if isinstance(d, str):
        return d[:10]
    if hasattr(d, "isoformat"):
        return d.isoformat()[:10]
    return str(d)[:10]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:48] or "note"


def make_id(scope: str, day: str, title: str) -> str:
    return f"{_iso_day(day)}-{slugify(title)}"


def _path(scope: str) -> str:
    return os.path.join(STORE, f"{(scope or 'MACRO').upper()}.json")


def load(scope: str) -> list:
    """Return the list of curated notes for a scope (ticker or MACRO). Missing -> []."""
    p = _path(scope)
    if not os.path.exists(p):
        return []
    try:
        with open(p, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else data.get("notes", [])
    except Exception:  # noqa: BLE001 — a corrupt file must not take down the timeline
        return []


def save(scope: str, notes: list) -> None:
    os.makedirs(STORE, exist_ok=True)
    notes = sorted(notes, key=lambda n: (n.get("date", ""), n.get("id", "")))
    with open(_path(scope), "w", encoding="utf-8") as fh:
        json.dump(notes, fh, ensure_ascii=False, indent=2)


def add(note: dict) -> dict:
    """
    Upsert one note. `scope`, `date` and `title` are required; everything else has a sane default.
    Dedupe/replace by `id` (derived from date+title when absent), so re-seeding is idempotent.
    """
    scope = (note.get("scope") or "MACRO").upper()
    day = _iso_day(note.get("date") or note.get("day") or date.today())
    title = (note.get("title") or "").strip()
    if not title:
        raise ValueError("a note needs a title")
    cat = (note.get("category") or "other").lower()
    if cat not in CATEGORIES:
        cat = "other"
    sources = note.get("sources") or ([note["source"]] if note.get("source") else [])
    rec = {
        "id": note.get("id") or make_id(scope, day, title),
        "date": day,
        "end": _iso_day(note["end"]) if note.get("end") else None,
        "scope": scope,
        "category": cat,
        "title": title,
        "note": (note.get("note") or "").strip(),
        "sources": [s for s in sources if s],
        "author": (note.get("author") or "harry").lower(),
        "created_at": note.get("created_at") or _now_iso(),
    }
    notes = [n for n in load(scope) if n.get("id") != rec["id"]]
    notes.append(rec)
    save(scope, notes)
    return rec


def remove(scope: str, note_id: str) -> bool:
    notes = load(scope)
    kept = [n for n in notes if n.get("id") != note_id]
    if len(kept) == len(notes):
        return False
    save(scope, kept)
    return True


def _as_event(n: dict) -> dict:
    """Shape a curated note like an events-timeline entry so the UI treats it uniformly."""
    span = "" if not n.get("end") else f" ({n['date']}→{n['end']})"
    return {
        "date": n["date"],
        "end": n.get("end"),
        "type": "note",
        "category": n.get("category", "other"),
        "scope": n.get("scope"),
        "title": n.get("title"),
        "detail": (n.get("title") or "") + span,
        "note": n.get("note", ""),
        "sources": n.get("sources", []),
        "author": n.get("author", "harry"),
        "id": n.get("id"),
    }


def merge_into_timeline(timeline: dict, ticker: str) -> dict:
    """
    Fold a ticker's own curated notes plus every MACRO note into an events-timeline dict
    (as produced by portfolio.events.assemble/build). Notes are added to `events`, indexed
    into `by_date`, and counted. MACRO notes appear on every symbol's chart. Idempotent-ish:
    it won't add a note id already present in by_date.
    """
    if not isinstance(timeline, dict):
        return timeline
    ticker = (ticker or "").upper()
    notes = load(ticker) + [n for n in load("MACRO") if True]
    if not notes:
        return timeline
    events = timeline.setdefault("events", [])
    by_date = timeline.setdefault("by_date", {})
    seen = {e.get("id") for evs in by_date.values() for e in evs if e.get("id")}
    added = 0
    for n in notes:
        if n.get("id") in seen:
            continue
        ev = _as_event(n)
        events.append(ev)
        by_date.setdefault(ev["date"], []).append(ev)
        added += 1
    timeline["events"] = sorted(events, key=lambda e: e.get("date", ""))
    counts = timeline.setdefault("counts", {})
    counts["note"] = counts.get("note", 0) + added
    timeline["has_notes"] = True
    return timeline


# ---- CLI ------------------------------------------------------------------

def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="Curate chart-memory notes.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add", help="add/replace a note")
    a.add_argument("scope", help="ticker (e.g. NVDA) or MACRO")
    a.add_argument("date", help="ISO date, e.g. 2025-01-27")
    a.add_argument("title")
    a.add_argument("note", nargs="?", default="")
    a.add_argument("--category", default="other", choices=CATEGORIES)
    a.add_argument("--end")
    a.add_argument("--source", action="append", dest="sources", default=[])
    a.add_argument("--author", default="harry")

    l = sub.add_parser("list", help="list notes for a scope")
    l.add_argument("scope")

    r = sub.add_parser("rm", help="remove a note by id")
    r.add_argument("scope")
    r.add_argument("id")

    args = ap.parse_args(argv)
    if args.cmd == "add":
        rec = add({
            "scope": args.scope, "date": args.date, "title": args.title, "note": args.note,
            "category": args.category, "end": args.end, "sources": args.sources, "author": args.author,
        })
        print(f"saved {rec['scope']} {rec['id']}")
    elif args.cmd == "list":
        for n in load(args.scope):
            print(f"  {n['date']}  [{n['category']}]  {n['title']}  ({n['id']})")
    elif args.cmd == "rm":
        print("removed" if remove(args.scope, args.id) else "not found")


if __name__ == "__main__":
    sys.exit(main())
