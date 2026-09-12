#!/usr/bin/env python3
"""
Robinhood login that handles every challenge type Robinhood currently sends,
not just the app push that robin_stocks 3.4 expects:

  * access_token            -> done
  * mfa_required            -> Robinhood texted / emailed a code (or your authenticator app shows one); type it in
  * challenge {sms|email}   -> same idea, older challenge endpoint
  * verification_workflow   -> the app push; handled by robin_stocks' own poller
  * detail: "..."           -> wrong password or a message from Robinhood; shown verbatim

Shares robin_stocks' session and token cache (~/.tokens/robinhood.pickle) so every
other robin_stocks call works afterwards and later runs log in silently.
"""
from __future__ import annotations

import getpass
import os
import pickle
import sys
import time

import robin_stocks.robinhood as rh
from robin_stocks.robinhood import authentication as auth
from robin_stocks.robinhood.helper import request_get, request_post, set_login_state, update_session
from robin_stocks.robinhood.urls import challenge_url, login_url, positions_url

CLIENT_ID = "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS"


def _pickle_path(pickle_path: str | None = None) -> str:
    d = pickle_path or os.path.join(os.path.expanduser("~"), ".tokens")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "robinhood.pickle")


def _try_cached(path: str) -> dict | None:
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "rb") as fh:
            saved = pickle.load(fh)
        update_session("Authorization", f"{saved['token_type']} {saved['access_token']}")
        set_login_state(True)
        res = request_get(positions_url(), "pagination", {"nonzero": "true"}, jsonify_data=False)
        res.raise_for_status()
        return saved
    except Exception:  # noqa: BLE001
        set_login_state(False)
        update_session("Authorization", None)
        return None


def _ask_code(kind: str) -> str:
    kind = {"sms": "text message", "email": "email"}.get(kind, kind)
    return input(f"Robinhood sent you a code by {kind} (or open your authenticator app). Type the code and press Enter: ").strip()


def login(username: str | None = None, password: str | None = None, mfa_code: str | None = None,
          pickle_path: str | None = None, expires_in: int = 86400) -> dict:
    path = _pickle_path(pickle_path)
    saved = _try_cached(path)
    if saved:
        print("Logged in with the saved session.", file=sys.stderr)
        return saved

    username = username or input("Robinhood email: ").strip()
    password = password or getpass.getpass("Robinhood password (nothing shows while you type): ")
    device_token = auth.generate_device_token()
    payload = {"client_id": CLIENT_ID, "expires_in": expires_in, "grant_type": "password", "password": password,
               "scope": "internal", "username": username, "device_token": device_token, "try_passkeys": False,
               "token_request_path": "/login", "create_read_only_secondary_token": True}
    if mfa_code:
        payload["mfa_code"] = mfa_code

    for attempt in range(6):
        data = request_post(login_url(), payload) or {}
        keys = sorted(k for k in data.keys() if k not in ("access_token", "refresh_token"))
        if "access_token" in data:
            break
        print(f"Robinhood replied with: {', '.join(keys) or 'nothing'}", file=sys.stderr)

        if "verification_workflow" in data:
            print("Robinhood sent an approval to the Robinhood app on your phone. Tap Approve.", file=sys.stderr)
            auth._validate_sherrif_id(device_token, data["verification_workflow"]["id"])
            continue
        if data.get("mfa_required"):
            payload["mfa_code"] = _ask_code(data.get("mfa_type", "sms"))
            continue
        if "challenge" in data:
            ch = data["challenge"]
            code = _ask_code(ch.get("type", "sms"))
            res = request_post(challenge_url(ch["id"]), {"response": code}) or {}
            tries = 3
            while res.get("challenge") and res["challenge"].get("remaining_attempts", 0) > 0 and tries:
                code = _ask_code(ch.get("type", "sms")); tries -= 1
                res = request_post(challenge_url(ch["id"]), {"response": code}) or {}
            if res.get("status") != "validated":
                sys.exit(f"Robinhood did not accept the code ({res}). Run the command again.")
            update_session("X-ROBINHOOD-CHALLENGE-RESPONSE-ID", ch["id"])
            continue
        if "detail" in data:
            msg = str(data["detail"])
            if "credentials" in msg.lower():
                sys.exit("Robinhood says the email or password is wrong. Run the command again and retype them.")
            print(f"Robinhood says: {msg}", file=sys.stderr)
            time.sleep(3)
            continue
        sys.exit(f"Unexpected reply from Robinhood: {data}. Send this text to Claude.")
    else:
        sys.exit("Gave up after several attempts. Send the text above to Claude.")

    update_session("Authorization", f"{data['token_type']} {data['access_token']}")
    set_login_state(True)
    with open(path, "wb") as fh:
        pickle.dump({"token_type": data["token_type"], "access_token": data["access_token"],
                     "refresh_token": data.get("refresh_token"), "device_token": device_token}, fh)
    print("Logged in. Session saved so you will not be asked again for about a day.", file=sys.stderr)
    return data


if __name__ == "__main__":
    login()
    prof = rh.load_portfolio_profile() or {}
    print(f"equity: {prof.get('equity')}")
