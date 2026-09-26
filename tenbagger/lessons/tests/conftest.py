import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lessons.generator import build  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "companies.json"
REAL = ROOT.parent / "data" / "companies.json"

SOURCES = [pytest.param(FIXTURE, id="fixture")]
if REAL.exists():
    SOURCES.append(pytest.param(REAL, id="data"))


@pytest.fixture(scope="session", params=SOURCES)
def built(request):
    companies = json.loads(Path(request.param).read_text())
    doc, report = build(companies, seed=42)
    # round-trip through strict JSON exactly as the CLI writes it
    doc = json.loads(json.dumps(doc, allow_nan=False))
    return companies, doc, report


@pytest.fixture(scope="session")
def fixture_companies():
    return json.loads(FIXTURE.read_text())


def all_questions(doc):
    for u in doc["units"]:
        for l in u["lessons"]:
            for q in l["questions"]:
                yield u, l, q
