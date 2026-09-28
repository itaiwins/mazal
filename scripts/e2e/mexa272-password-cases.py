#!/usr/bin/env python3
"""
Does `security_update_password_require_current_password` bite on a recovery / OTP
session?  (MEXA-272, cleanup and fixture rules from MEXA-280)

Seven cases against the live GoTrue on the Mazal project. Each case needs its own
account, because a successful password update would otherwise disturb the next one,
and the AMR of each session is read out of the access token so the result can be
matched against `Session.IsRecovery()` in the GoTrue source.

  scripts/e2e/mexa272-password-cases.py <label>     # label lands in the output filenames

Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. All three are in
archive/credentials/mazal-supabase.env in the workspace; never paste one into a commit
or an issue comment.

FIXTURE RULES (MEXA-280 - the first version of this script leaked 7 live accounts per
run, twice, and nothing removed them)

1. Fixture emails are FIXED, not timestamped. `e2e-mexa272-pw-correct@example.com` is
   the same address on every run. A timestamped address means a crashed run's rows are
   unreachable and the next run adds seven more; a fixed one means the next run
   reclaims exactly those seven. Leakage is bounded at seven rows instead of growing
   by seven an hour. `setup` deletes a stale fixture before recreating it, so a crashed
   predecessor costs nothing.

2. Teardown runs in `finally`, and it deletes BY EMAIL, not only by the ids this run
   captured. Some of these accounts are created by `generate_link` rather than by the
   admin create call, and the id is not always in the response - deleting by the email
   list cannot miss one that way.

3. A teardown failure is loud and exits non-zero even when every assertion passed. A
   sweep that silently half-worked is worse than one that never ran: the rows are still
   there either way, and only the loud version says so.

The backstop for a run that dies hard enough to skip `finally` (SIGKILL, a dead box)
is `scripts/sweep-e2e-users.mjs`, which clears every `e2e-*@example.com` account.
"""
import json
import os
import sys
import base64
import urllib.request
import urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

OLD_PW = "Correct-Horse-1111"
NEW_PW = "Brand-New-Staple-2222"
WRONG_PW = "Not-The-Password-9999"

# Fixed addresses, one per case. The `e2e-` label and the reserved `example.com` domain
# are what scripts/sweep-e2e-users.mjs matches on; keep both or the sweep skips them.
TAGS = ["pw-correct", "pw-missing", "pw-wrong", "recovery", "magiclink", "signup", "admin"]


def email_for(tag):
    return f"e2e-mexa272-{tag}@example.com"


# Every fixture this run touched, so teardown can delete by email even when the
# create call gave us no id.
touched_emails = set()


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
    """Read the amr claim out of the access token (no verification needed)."""
    payload = access_token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload))
    return [e.get("method") for e in claims.get("amr", [])]


def find_user_id(email):
    """The id of an account by address, or None. Paged, so a long list cannot hide one."""
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


def delete_user(uid):
    st, body = call("DELETE", f"/auth/v1/admin/users/{uid}", key=SVC)
    # 404 means somebody already removed it, which is the state we wanted anyway.
    if st not in (200, 204, 404):
        raise RuntimeError(f"delete {uid} failed: http {st} {body}")


def drop_if_present(email):
    """Clear a stale fixture so this run starts from a known state (rule 1)."""
    uid = find_user_id(email)
    if uid:
        delete_user(uid)
    return uid


def make_user(tag, confirm=True):
    email = email_for(tag)
    touched_emails.add(email)
    drop_if_present(email)
    st, body = call(
        "POST", "/auth/v1/admin/users",
        {"email": email, "password": OLD_PW, "email_confirm": confirm},
        key=SVC,
    )
    assert st == 200, (st, body)
    return email, body["id"]


def password_session(email):
    st, body = call("POST", "/auth/v1/token?grant_type=password",
                    {"email": email, "password": OLD_PW})
    assert st == 200, (st, body)
    return body["access_token"]


def link_session(email, link_type, password=None):
    """generate_link -> POST /verify -> session, the real recovery/OTP path."""
    touched_emails.add(email)
    payload = {"type": link_type, "email": email}
    if password:
        payload["password"] = password
    st, body = call("POST", "/auth/v1/admin/generate_link", payload, key=SVC)
    assert st == 200, (st, body)
    st, sess = call("POST", "/auth/v1/verify",
                    {"type": link_type, "token_hash": body["hashed_token"]})
    assert st == 200, ("verify", st, sess)
    return sess["access_token"]


def update(token, new_pw, current=None):
    body = {"password": new_pw}
    if current is not None:
        body["current_password"] = current
    return call("PUT", "/auth/v1/user", body, token=token)


def report(name, amr, st, body):
    code = body.get("error_code") or body.get("code") or ""
    msg = body.get("msg") or body.get("message") or body.get("error_description") or ""
    verdict = "ALLOWED" if st == 200 else "REJECTED"
    print(f"  {name:<34} amr={str(amr):<14} {verdict} http={st} {code} {msg}")
    return {"case": name, "amr": amr, "http": st, "code": code,
            "msg": msg, "allowed": st == 200}


def run_cases(label):
    out = []

    # 1-3: ordinary password session.
    email, _ = make_user("pw-correct")
    tok = password_session(email)
    out.append(report("1 password + correct current", amr_of(tok), *update(tok, NEW_PW, OLD_PW)))

    email, _ = make_user("pw-missing")
    tok = password_session(email)
    out.append(report("2 password + NO current", amr_of(tok), *update(tok, NEW_PW)))

    email, _ = make_user("pw-wrong")
    tok = password_session(email)
    out.append(report("3 password + wrong current", amr_of(tok), *update(tok, NEW_PW, WRONG_PW)))

    # 4: real recovery session (the password-reset screen's situation).
    email, _ = make_user("recovery")
    tok = link_session(email, "recovery")
    out.append(report("4 recovery session, NO current", amr_of(tok), *update(tok, NEW_PW)))

    # 5: magic-link session. A stolen session is not always a password session.
    email, _ = make_user("magiclink")
    tok = link_session(email, "magiclink")
    out.append(report("5 magiclink session, NO current", amr_of(tok), *update(tok, NEW_PW)))

    # 6: session minted by confirming a signup email. generate_link creates the account
    # here, so clear any stale one first the same way make_user does.
    signup_email = email_for("signup")
    drop_if_present(signup_email)
    tok = link_session(signup_email, "signup", password=OLD_PW)
    out.append(report("6 signup-confirm session, NO cur", amr_of(tok), *update(tok, NEW_PW)))

    # 7: service role admin update.
    email, uid = make_user("admin")
    st, body = call("PUT", f"/auth/v1/admin/users/{uid}", {"password": NEW_PW}, key=SVC)
    out.append(report("7 admin.updateUserById (svc)", ["n/a"], st, body))

    with open(f"result-{label}.json", "w") as f:
        json.dump(out, f, indent=2)
    return out


def teardown():
    """Delete every fixture this run touched. Returns the addresses it could not clear."""
    failures = []
    # Sweep all seven, not only the ones reached: a case that raised part-way through
    # may still have created its account before failing.
    for email in sorted(touched_emails | {email_for(t) for t in TAGS}):
        try:
            if drop_if_present(email):
                print(f"  torn down {email}")
        except Exception as exc:  # noqa: BLE001 - one bad address must not skip the rest
            failures.append((email, repr(exc)))
    return failures


def main():
    if len(sys.argv) < 2:
        print("usage: mexa272-password-cases.py <label>", file=sys.stderr)
        return 2
    label = sys.argv[1]
    print(f"\n===== {label} =====")

    cases_failed = None
    try:
        run_cases(label)
    except Exception as exc:  # noqa: BLE001 - re-raised below, after teardown
        cases_failed = exc
    finally:
        print("  --- teardown ---")
        leaked = teardown()

    if leaked:
        # Rule 3: loud. These are live sign-ins on the project the app ships against,
        # and they also poison any later use of the auth.users count as a control.
        print("\nTEARDOWN FAILED - these fixture accounts are still live:", file=sys.stderr)
        for email, err in leaked:
            print(f"  {email}: {err}", file=sys.stderr)
        print("Clear them with: node scripts/sweep-e2e-users.mjs --apply", file=sys.stderr)

    if cases_failed is not None:
        raise cases_failed
    return 1 if leaked else 0


if __name__ == "__main__":
    sys.exit(main())
