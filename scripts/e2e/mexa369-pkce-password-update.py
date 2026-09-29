#!/usr/bin/env python3
"""
Under PKCE, which sessions does `security_update_password_require_current_password`
actually bite on?  (MEXA-369, revising MEXA-272)

`e2e/mexa272-password-cases.py` answers this for the IMPLICIT flow: it mints its recovery,
magic-link and signup sessions with `admin/generate_link` + `POST /auth/v1/verify`, which
stamps every one of them `amr: otp` - and `otp` is one of the three methods GoTrue exempts
from the current-password check (`internal/models/factor.go`, `Session.IsRecovery()`). On
implicit, therefore, a user who had just confirmed their signup email was NOT covered.

`5d063c4` moved the client to `flowType: 'pkce'` (src/api/supabase/client.ts), and under PKCE
`/verify` does not mint the session at all: it redirects back with an auth code, the client
exchanges that at `token?grant_type=pkce`, and the AMR comes from the flow state the
ORIGINATING request created. That differs per entry point - `email/signup` for a signup,
`recovery` for a password reset - and only one of those is exempt. This script proves both,
end to end, against the live project.

    scripts/e2e/mexa369-pkce-password-update.py <label>

Two cases, each on its own fixture, nothing faked in the middle:

  SIGNUP    POST /auth/v1/signup with `code_challenge` -> the confirmation mail -> the link
            from that mail (unfollowed, so the `?code=` is visible) -> grant_type=pkce ->
            `amr` out of the access token -> PUT /auth/v1/user with and without
            `current_password`.  Expected with the flag on: refused without it.

  RECOVERY  POST /auth/v1/recover with `code_challenge`, same chain.  Expected with the flag
            on: ALLOWED without it - a recovery session must stay exempt or password reset
            breaks, since that user by definition does not know the old password. This is
            the case that decides whether the flag is safe to leave on at all.

The two run in one invocation deliberately: the signup case refusing and the recovery case
being allowed in the same run against the same GoTrue is what makes the recovery result
meaningful. A standalone "recovery was allowed" proves nothing, because it is also what
happens when the flag is off.

Why real mailboxes and not `@example.com`: the fixture has to accept mail. GoTrue sends the
confirmation inside the signup transaction, so a send that fails rolls the signup back
(`http 500 unexpected_failure` - no user row, no flow state, nothing to confirm), and
`@example.com` has no MX, so Resend refuses it. The addresses are therefore AgentMail
plus-addresses: **two Resend sends per run**, out of the account's shared 100/day
(PLANS/TEAM_BOARD.md). Do not loop this script.

Because those addresses are not `@example.com`, `scripts/sweep-e2e-users.mjs` will NOT clean
up after this script - by design, it only ever touches the reserved domain. Teardown here is
the only thing that removes them, so it runs in `finally`, deletes by email, and exits
non-zero if it could not (MEXA-280 rules 2 and 3).

Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (all in
archive/credentials/mazal-supabase.env) and AGENTMAIL_API_KEY (mexant-agentmail.env).
Optional: E2E_MAILBOX to point at a different inbox. Never paste one into a commit.
"""
import base64
import calendar
import hashlib
import json
import os
import re
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
AGENTMAIL_KEY = os.environ.get("AGENTMAIL_API_KEY", "")

# Fixed addresses, so a crashed run's rows are reclaimed by the next run rather than
# orphaned (MEXA-280 rule 1). Plus-addressed because the AgentMail plan caps at 3 inboxes.
MAILBOX = os.environ.get("E2E_MAILBOX", "dullcredit616@agentmail.to")
_local, _domain = MAILBOX.split("@", 1)


def fixture(tag):
    return f"{_local}+e2e-mexa369-{tag}@{_domain}"


FIXTURES = [fixture("pkce-signup"), fixture("pkce-recovery")]

OLD_PW = "Correct-Horse-1111"
NEW_PW = "Brand-New-Staple-2222"
NEWER_PW = "Third-Time-Staple-3333"

REDIRECT_TO = "mazal://auth/callback"  # inside uri_allow_list (`mazal://auth/**`)

MAIL_TIMEOUT_S = 90


def call(method, path, body=None, token=None, key=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, method=method)
    req.add_header("apikey", key or ANON)
    req.add_header("Authorization", "Bearer " + (token or key or ANON))
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return e.code, {"raw": raw.decode(errors="replace")[:300]}


def amr_of(access_token):
    payload = access_token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload))
    return [e.get("method") for e in claims.get("amr", [])]


def find_user_id(email):
    want = email.lower()
    page = 1
    while True:
        st, body = call("GET", f"/auth/v1/admin/users?page={page}&per_page=200", key=SVC)
        if st != 200:
            raise RuntimeError(f"admin list users failed: http {st} {body}")
        users = body.get("users", [])
        for u in users:
            if (u.get("email") or "").lower() == want:
                return u["id"]
        if len(users) < 200:
            return None
        page += 1


def drop_if_present(email):
    uid = find_user_id(email)
    if uid:
        st, body = call("DELETE", f"/auth/v1/admin/users/{uid}", key=SVC)
        if st not in (200, 204, 404):
            raise RuntimeError(f"delete {uid} failed: http {st} {body}")
    return uid


def pkce_pair():
    """A verifier and its S256 challenge, the same shape auth-js generates."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    return verifier, challenge


def agentmail(path):
    req = urllib.request.Request("https://api.agentmail.to/v0" + path)
    req.add_header("Authorization", "Bearer " + AGENTMAIL_KEY)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"{}")


def _epoch_ms(ts):
    """AgentMail timestamps are UTC ISO-8601; parse as UTC, not as local time."""
    try:
        return calendar.timegm(time.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S")) * 1000
    except (ValueError, TypeError):
        return 0


def link_from_mailbox(since_ms, to_addr):
    """Poll the real inbox for the mail sent to `to_addr` and pull the verify URL out of it.

    Filters on BOTH the recipient and the arrival time. The recipient matters because both
    fixtures land in the same inbox, so without it the recovery case could pick up the
    signup case's mail; the timestamp matters because a previous run's token is already
    spent, which would surface as a confusing `otp_expired` rather than as "no mail came".
    """
    if not AGENTMAIL_KEY:
        return None
    want = to_addr.lower()
    deadline = time.time() + MAIL_TIMEOUT_S
    while time.time() < deadline:
        try:
            listing = agentmail(f"/inboxes/{urllib.parse.quote(MAILBOX)}/messages?limit=20")
        except urllib.error.HTTPError as e:
            print(f"  agentmail list failed: http {e.code}", file=sys.stderr)
            return None
        for m in listing.get("messages", []):
            if _epoch_ms(m.get("timestamp") or m.get("created_at")) < since_ms:
                continue
            if want not in json.dumps(m.get("to") or []).lower():
                continue
            full = agentmail(
                f"/inboxes/{urllib.parse.quote(MAILBOX)}/messages/"
                f"{urllib.parse.quote(m['message_id'])}"
            )
            # The plain-text part, not the HTML: the HTML link is wrapped in Resend's click
            # tracker, which URL-encodes the whole target. The text part has it verbatim.
            # `]` and `)` are excluded because the text template prints the URL inside
            # brackets, and including one is what turns a good link into a 400
            # (`redirect_to=mazal://auth/callback]` is not in the allow list).
            body = (full.get("text") or "") + "\n" + (full.get("extracted_text") or "")
            hit = re.search(r"https://\S+?/auth/v1/verify\?[^\s\"'\\<>\])]+", body)
            if hit:
                return hit.group(0).replace("&amp;", "&")
        time.sleep(3)
    return None


def link_from_db(email, link_type):
    """Fallback: build the link from the token column, skipping the mailbox.

    GoTrue stores the SAME hash it puts in the mail's `token` parameter, so this is the
    identical value. Used only when the mail did not arrive; the result records which
    source was used, because the two are not equally strong evidence.
    """
    ref = os.environ.get("SUPABASE_PROJECT_REF") or URL.split("//")[1].split(".")[0]
    mgmt = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not mgmt:
        return None
    column = "recovery_token" if link_type == "recovery" else "confirmation_token"
    sql = f"select {column} as tok from auth.users where email = '{email}' limit 1"
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(), method="POST",
    )
    req.add_header("Authorization", "Bearer " + mgmt)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read() or b"[]")
    except urllib.error.HTTPError as e:
        print(f"  management query failed: http {e.code} {e.read()[:200]}", file=sys.stderr)
        return None
    tok = (rows[0] or {}).get("tok") if rows else None
    if not tok:
        return None
    q = urllib.parse.urlencode({"token": tok, "type": link_type, "redirect_to": REDIRECT_TO})
    return f"{URL}/auth/v1/verify?{q}"


def follow_once(link):
    """GET the verify link WITHOUT following the redirect, and hand back the Location."""

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **kw):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(urllib.request.Request(link, method="GET")) as r:
            return r.status, r.headers.get("Location") or ""
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location") or ""
        e.read()
        return e.code, loc


def report(name, amr, st, body):
    code = body.get("error_code") or body.get("code") or ""
    msg = body.get("msg") or body.get("message") or body.get("error_description") or ""
    verdict = "ALLOWED" if st == 200 else "REJECTED"
    print(f"  {name:<42} amr={str(amr):<20} {verdict} http={st} {code} {msg}")
    return {"case": name, "amr": amr, "http": st, "code": code, "msg": msg,
            "allowed": st == 200}


def pkce_session(email, kind, since_ms):
    """Drive the real PKCE chain for one entry point and return (access_token, amr, source).

    `kind` is 'signup' or 'recovery'. Both use the same three steps the app uses; only the
    request that creates the flow state differs, which is the whole point of the script.
    """
    verifier, challenge = pkce_pair()
    pkce = {"code_challenge": challenge, "code_challenge_method": "s256"}
    redirect_q = "?redirect_to=" + urllib.parse.quote(REDIRECT_TO, safe="")

    if kind == "signup":
        st, body = call("POST", "/auth/v1/signup" + redirect_q,
                        {"email": email, "password": OLD_PW, **pkce})
        assert st == 200, ("signup", st, body)
        assert not body.get("access_token"), (
            "signup returned a session; email confirmation is supposed to be required", body)
        print(f"  signup ok, confirmation required, user {str(body.get('id'))[:8]}")
    else:
        # The account already exists and is confirmed, as it would for a real reset.
        st, body = call("POST", "/auth/v1/admin/users",
                        {"email": email, "password": OLD_PW, "email_confirm": True}, key=SVC)
        assert st == 200, ("admin create", st, body)
        st, body = call("POST", "/auth/v1/recover" + redirect_q, {"email": email, **pkce})
        assert st == 200, ("recover", st, body)
        print(f"  recover requested for existing user {str(body.get('id'))[:8] or '(n/a)'}")

    link = link_from_mailbox(since_ms, email)
    source = "email"
    if not link:
        print("  no mail inside the window; falling back to the token column")
        link = link_from_db(email, kind)
        source = "db-token-column"
    assert link, f"no {kind} link from the mailbox or the database"
    link_tok = (urllib.parse.parse_qs(urllib.parse.urlsplit(link).query).get("token") or [""])[0]
    # A `pkce_`-prefixed token is GoTrue saying it stored a flow state for this request.
    # Without one, /verify would mint the session itself and this would be testing implicit.
    print(f"  {kind} link via {source}, token prefix "
          f"{link_tok.split('_')[0] + '_' if '_' in link_tok else '(none)'}")

    st, loc = follow_once(link)
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(loc).query)
    frag = urllib.parse.parse_qs(urllib.parse.urlsplit(loc).fragment)
    print(f"  verify -> http {st} {loc.split('?')[0]} params={sorted(q)} frag={sorted(frag)}")
    assert st in (301, 302, 303, 307), ("verify did not redirect", st, loc)
    assert "error" not in q and "error_code" not in q, ("verify redirected with an error", loc)
    code = (q.get("code") or [None])[0]
    assert code, (f"no ?code= on the {kind} redirect, so this is not PKCE", loc)
    assert "access_token" not in frag, ("tokens in the fragment means implicit, not PKCE", loc)

    st, sess = call("POST", "/auth/v1/token?grant_type=pkce",
                    {"auth_code": code, "code_verifier": verifier})
    assert st == 200, ("pkce exchange", st, sess)
    tok = sess["access_token"]
    amr = amr_of(tok)
    print(f"  exchanged, amr={amr}")
    return tok, amr, source


def run(label):
    out = []
    sources = {}

    # --- 1. signup confirmation. Expected with the flag on: refused without the old password.
    email = fixture("pkce-signup")
    print(f"  fixture {email}")
    if drop_if_present(email):
        print("  (cleared a stale fixture first)")
    started_ms = int(time.time() * 1000) - 5000
    tok, amr, sources["signup"] = pkce_session(email, "signup", started_ms)

    st, body = call("PUT", "/auth/v1/user", {"password": NEW_PW}, token=tok)
    first = report("A pkce signup-confirm, NO current", amr, st, body)
    out.append(first)

    # And with the correct one - a real user must still be able to change it.
    current = NEW_PW if first["allowed"] else OLD_PW
    st, body = call("PUT", "/auth/v1/user",
                    {"password": NEWER_PW, "current_password": current}, token=tok)
    out.append(report("B pkce signup-confirm, correct cur", amr, st, body))

    # --- 2. password reset. Expected with the flag on: STILL ALLOWED without it, or reset
    # is broken for every user who ever forgets their password.
    email = fixture("pkce-recovery")
    print(f"  fixture {email}")
    if drop_if_present(email):
        print("  (cleared a stale fixture first)")
    started_ms = int(time.time() * 1000) - 5000
    tok, amr, sources["recovery"] = pkce_session(email, "recovery", started_ms)

    st, body = call("PUT", "/auth/v1/user", {"password": NEW_PW}, token=tok)
    out.append(report("C pkce recovery reset, NO current", amr, st, body))

    result = {"label": label, "link_sources": sources, "cases": out}
    with open(f"result-{label}.json", "w") as f:
        json.dump(result, f, indent=2)
    return result


def main():
    if len(sys.argv) < 2:
        print("usage: mexa369-pkce-password-update.py <label>", file=sys.stderr)
        return 2
    label = sys.argv[1]
    print(f"\n===== {label} =====")

    failed = None
    try:
        run(label)
    except Exception as exc:  # noqa: BLE001 - re-raised after teardown
        failed = exc
    finally:
        print("  --- teardown ---")
        leaked = []
        for email in FIXTURES:
            try:
                if drop_if_present(email):
                    print(f"  torn down {email}")
            except Exception as exc:  # noqa: BLE001 - one bad address must not skip the rest
                leaked.append((email, repr(exc)))
        if not leaked:
            print("  every fixture cleared")

    if leaked:
        # The sweep script cannot reach these addresses, so a failure here is the whole story.
        print("\nTEARDOWN FAILED - these are still live accounts:", file=sys.stderr)
        for email, err in leaked:
            print(f"  {email}: {err}", file=sys.stderr)
        print("Delete them by hand through /auth/v1/admin/users.", file=sys.stderr)

    if failed is not None:
        raise failed
    return 1 if leaked else 0


if __name__ == "__main__":
    sys.exit(main())
