import sys
import zipfile
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
TENBAGGER = HERE.parents[1]
if str(TENBAGGER) not in sys.path:
    sys.path.insert(0, str(TENBAGGER))

FIX = HERE / "fixtures"


@pytest.fixture
def fsds_zip(tmp_path):
    """Zip the tiny FSDS fixture the way SEC ships it (four .txt files at the root)."""
    z = tmp_path / "2025q4.zip"
    with zipfile.ZipFile(z, "w") as zf:
        for p in sorted((FIX / "fsds" / "2025q4").glob("*.txt")):
            zf.write(p, p.name)
    return z


@pytest.fixture(autouse=True)
def _no_license_env(monkeypatch):
    for v in ("TENBAGGER_ALPACA_DISPLAY_LICENSE", "TENBAGGER_EODHD_DISPLAY_LICENSE",
              "TENBAGGER_INTRINIO_DISPLAY_LICENSE", "TENBAGGER_FMP_DISPLAY_LICENSE",
              "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "EODHD_API_TOKEN", "INTRINIO_API_KEY",
              "FMP_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        monkeypatch.delenv(v, raising=False)
