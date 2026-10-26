"""
Smoke test for a running stack (app on :8080, Keycloak on :8180):
create a verified user through Keycloak's admin API, sign in through the
Labeleur login page, then read records and print a PDF as that user.

Standard library only, so it runs on any CI runner.
"""
import base64
import html
import http.cookiejar
import json
import re
import sys
import urllib.parse
import urllib.request
import uuid

APP = "http://localhost:8080"
KEYCLOAK = "http://localhost:8180"
EMAIL = f"smoke-{uuid.uuid4().hex[:8]}@example.org"
PASSWORD = "smoke test passphrase"
JS = {"X-Requested-With": "JavaScript"}

# A 1×1 white PNG.
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==")


def fail(msg):
    print(f"FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def request(opener, url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with opener.open(req) as r:
            return r.status, r.geturl(), r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, url, e.read(), dict(e.headers)


plain = urllib.request.build_opener()

# Signed out, the API answers 499 to fetch() instead of redirecting to Keycloak.
status, *_ = request(plain, f"{APP}/api/me", headers=JS)
if status != 499: fail(f"signed-out /api/me answered {status}, expected 499")

# A user with a verified email, as if they had registered and clicked the link.
form = urllib.parse.urlencode({"client_id": "admin-cli", "username": "admin", "password": "admin", "grant_type": "password"}).encode()
_, _, body, _ = request(plain, f"{KEYCLOAK}/realms/master/protocol/openid-connect/token", form)
admin = json.loads(body)["access_token"]
user = {"username": EMAIL, "email": EMAIL, "emailVerified": True, "enabled": True, "firstName": "Smoke", "lastName": "Test",
        "credentials": [{"type": "password", "value": PASSWORD, "temporary": False}]}
status, *_ = request(plain, f"{KEYCLOAK}/admin/realms/labeleur/users", json.dumps(user).encode(),
                     {"Authorization": f"Bearer {admin}", "Content-Type": "application/json"})
if status != 201: fail(f"creating the user answered {status}")

# Sign in through the login page, the way a browser does.
class LocalhostIsSecure(http.cookiejar.DefaultCookiePolicy):
    """Browsers treat http://localhost as a secure context and send Secure cookies there; so does this."""

    def return_ok_secure(self, cookie, request):
        return True


browser = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar(LocalhostIsSecure())))
# Signed out, / is the landing page; /login goes to Keycloak.
status, url, page, _ = request(browser, f"{APP}/")
if status != 200 or not url.startswith(APP) or 'id="root"' not in page.decode(): fail(f"/ answered {status} at {url}, expected the landing page")
status, url, page, _ = request(browser, f"{APP}/login")
page = page.decode()
if "lc-card" not in page: fail(f"{url} is not the Labeleur login page")
action = re.search(r'id="kc-form-login"[^>]*action="([^"]+)"', page)
if not action: fail("no login form")
status, url, page, _ = request(browser, html.unescape(action.group(1)), urllib.parse.urlencode({"username": EMAIL, "password": PASSWORD}).encode())
if not url.startswith(APP):
    said = re.findall(r'(?:id="kc-page-title"|class="[^"]*(?:lc-error|lc-alert-text)[^"]*")[^>]*>\s*([^<]+)', page.decode())
    fail(f"sign-in ended at {url.split('?')[0]}: {' '.join(x.strip() for x in said) or 'no message'}")

status, _, body, _ = request(browser, f"{APP}/api/me", headers=JS)
if status != 200 or json.loads(body)["email"] != EMAIL: fail(f"/api/me answered {status}")
status, _, body, _ = request(browser, f"{APP}/api/records/signs", headers=JS)
if status != 200 or "zerbrechlich" not in body.decode(): fail("the new user has no sample signs")

# Print: the server renders a PDF with AWT inside the image.
job = {"printerId": "p-office", "mediaId": "DK-11201", "kind": "text", "copies": 1, "titles": ["Smoke"],
       "geometry": {"widthMm": 90, "heightMm": 29, "offsetXMm": 3, "offsetYMm": 1, "printableWidthMm": 84, "printableHeightMm": 26}}
boundary = uuid.uuid4().hex
parts = [
    f'--{boundary}\r\nContent-Disposition: form-data; name="job"\r\nContent-Type: application/json\r\n\r\n'.encode() + json.dumps(job).encode(),
    f'--{boundary}\r\nContent-Disposition: form-data; name="page"; filename="label.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + PNG,
]
multipart = b"\r\n".join(parts) + f"\r\n--{boundary}--\r\n".encode()
status, _, body, _ = request(browser, f"{APP}/api/print-jobs", multipart, {**JS, "Content-Type": f"multipart/form-data; boundary={boundary}"})
if status != 200: fail(f"printing answered {status}: {body[:200]}")
done = json.loads(body)
status, _, pdf, _ = request(browser, APP + done["pdfUrl"], headers=JS)
if status != 200 or not pdf.startswith(b"%PDF-"): fail("no PDF")

print(f"Signed in as {EMAIL}, read records and printed a PDF.")
