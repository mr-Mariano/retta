"""Records the Retta demo video (MVP delivery, 2026-11-06).

Each scene of the script is recorded in its own browser window, cut to the
length of your narration clip for that scene, and joined into out/retta-demo.mp4.

Usage, from retta/demo:
    PLAYWRIGHT_BROWSERS_PATH=.browsers .venv/bin/python record.py

Narration: put one clip per scene in audio/ named 1.m4a … 7.m4a (m4a, mp3,
wav or aiff). A missing clip uses the scene's default length with silence,
so a dry run works before you record your voice.

The password comes from SEED_PASSWORD in ../app/.env.seed.local; the script
never prints it. Nothing is paid or published: the payment window is opened
but not confirmed, and the new-match flow stops at its first step.
"""

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import Page, sync_playwright

BASE = "https://retta-chi.vercel.app"
HERE = Path(__file__).parent
AUDIO = HERE / "audio"
OUT = HERE / "out"
TMP = OUT / "tmp"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SIZE = {"width": 1440, "height": 900}
ACCOUNTS = {"jugador": "organizador1@retta.test", "cancha": "cancha1@retta.test", "admin": "admin@retta.test"}


def password() -> str:
    env = HERE.parent / "app" / ".env.seed.local"
    for line in env.read_text().splitlines():
        if line.startswith("SEED_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SEED_PASSWORD is missing in app/.env.seed.local")


def clip_for(n: int) -> Path | None:
    for ext in ("m4a", "mp3", "wav", "aiff", "aac"):
        path = AUDIO / f"{n}.{ext}"
        if path.exists():
            return path
    return None


def duration(path: Path) -> float:
    info = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def soft(step):
    """Runs one step; a missing button never stops the recording."""
    try:
        step()
    except Exception as error:  # noqa: BLE001
        print(f"   (skipped: {str(error).splitlines()[0][:90]})")


def first_visible(page: Page, locator):
    for i in range(locator.count()):
        if locator.nth(i).is_visible():
            return locator.nth(i)
    return locator.first


PACE = 1.0  # set per scene: narration length / default length


def w(page: Page, ms: int):
    """Waits in proportion to the narration, never less than a short beat."""
    page.wait_for_timeout(max(ms * PACE, 700))


# Scenes: (account or None, start path, default seconds, actions)
def s1(page: Page):
    w(page, 1500)
    page.mouse.wheel(0, 300)


def s2(page: Page):
    box = page.get_by_placeholder(re.compile("fut 7 mañana"))
    soft(lambda: box.click())
    soft(lambda: box.type("fut 7 mañana en la noche", delay=70))
    soft(lambda: box.press("Enter"))
    soft(lambda: page.locator("main a[href*='/retas/']").first.wait_for(timeout=12000))
    w(page, 2500)
    soft(lambda: first_visible(page, page.locator("main a[href*='/retas/']")).click())
    w(page, 7000)
    page.mouse.move(700, 500)
    page.mouse.wheel(0, 350)
    w(page, 5000)
    page.mouse.wheel(0, -350)
    w(page, 1500)
    soft(lambda: first_visible(page, page.get_by_role("link", name="Inscribirme")).click())
    w(page, 5000)
    # Test payment (no real money), so Mis retas shows a match afterwards.
    soft(lambda: first_visible(page, page.get_by_role("button", name=re.compile("Pagar|Usar saldo"))).click())


def s3(page: Page):
    w(page, 4000)
    soft(lambda: page.goto(f"{BASE}/avisos"))


def s4(page: Page):
    w(page, 1500)
    soft(lambda: first_visible(page, page.get_by_role("button", name="Organizar")).click())
    soft(lambda: page.get_by_text("Así van tus retas").first.wait_for(timeout=10000))
    page.wait_for_timeout(3000)
    soft(lambda: first_visible(page, page.get_by_role("link", name=re.compile("Nueva reta"))).click())
    soft(lambda: page.get_by_text("¿Dónde y cuándo?").first.wait_for(timeout=10000))
    page.wait_for_timeout(1500)
    choices = page.locator("main button:not([aria-label]):not([disabled])")
    for i in (1, 4, 9):  # a field, a day and a time
        soft(lambda i=i: choices.nth(i).click())
        page.wait_for_timeout(1300)
    page.wait_for_timeout(1500)
    soft(lambda: page.goto(f"{BASE}/perfil/organizar"))


def s5(page: Page):
    w(page, 1500)
    soft(lambda: first_visible(page, page.get_by_role("link", name="Gestionar")).click())
    w(page, 5000)
    page.mouse.wheel(0, 400)


def s6(page: Page):
    w(page, 2500)
    soft(lambda: first_visible(page, page.get_by_role("link", name="Publicar")).click())
    soft(lambda: page.get_by_text("Horas de inicio").first.wait_for(timeout=10000))
    page.wait_for_timeout(1200)
    soft(lambda: page.get_by_role("button", name="sábado").click())
    w(page, 1200)
    soft(lambda: page.get_by_role("button", name="domingo").click())
    w(page, 4000)
    soft(lambda: page.go_back())
    w(page, 1500)
    soft(lambda: first_visible(page, page.get_by_role("link", name="Ver agenda")).click())


def s7(page: Page):
    w(page, 9000)
    soft(lambda: page.goto(f"{BASE}/admin/usuarios"))


SCENES = [
    (None, "/", 20, s1),
    ("jugador", "/explorar", 50, s2),
    ("jugador", "/mis-retas", 20, s3),
    ("jugador", "/explorar", 60, s4),
    ("jugador", "/perfil/organizar", 30, s5),
    ("cancha", "/perfil/canchas", 30, s6),
    ("admin", "/admin/canchas/nueva", 30, s7),
]


def sign_in(browser, account: str, secret: str) -> Path:
    state = TMP / f"state-{account}.json"
    context = browser.new_context(viewport=SIZE, color_scheme="dark")
    page = context.new_page()
    page.goto(f"{BASE}/entrar")
    page.fill("#email", ACCOUNTS[account])
    page.fill("#password", secret)
    page.locator("form button[type=submit]").first.click()
    page.wait_for_url(lambda url: "/entrar" not in url, timeout=30000)
    context.storage_state(path=str(state))
    context.close()
    return state


def main():
    OUT.mkdir(exist_ok=True)
    shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir()
    secret = password()
    parts = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        states = {account: sign_in(browser, account, secret) for account in ACCOUNTS}
        for n, (account, path, default, act) in enumerate(SCENES, start=1):
            clip = clip_for(n)
            length = duration(clip) + 0.6 if clip else default
            global PACE
            PACE = min(length / default, 1.0)
            print(f"Escena {n}: {length:.1f} s {'con tu voz' if clip else '(sin audio)'}")
            started = time.monotonic()
            context = browser.new_context(
                viewport=SIZE,
                color_scheme="dark",
                record_video_dir=str(TMP / f"v{n}"),
                record_video_size=SIZE,
                storage_state=str(states[account]) if account else None,
            )
            # Every playing scene starts in Jugar mode.
            context.add_cookies([{"name": "retta-modo", "value": "jugar", "url": BASE}])
            page = context.new_page()
            page.goto(f"{BASE}{path}", wait_until="networkidle")
            soft(lambda: page.locator("h1:visible").first.wait_for(timeout=15000))
            page.wait_for_timeout(400)
            offset = time.monotonic() - started
            act(page)
            left = offset + length - (time.monotonic() - started)
            if left > 0:
                page.wait_for_timeout(left * 1000)
            video = page.video.path()
            context.close()
            part = TMP / f"part{n}.mp4"
            audio = ["-i", str(clip)] if clip else ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            subprocess.run(
                [FFMPEG, "-y", "-loglevel", "error", "-ss", f"{offset:.2f}", "-i", str(video), *audio,
                 "-t", f"{length:.2f}", "-map", "0:v", "-map", "1:a", "-r", "30", "-c:v", "libx264",
                 "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(part)],
                check=True,
            )
            parts.append(part)
        browser.close()
    listing = TMP / "parts.txt"
    listing.write_text("".join(f"file '{part.name}'\n" for part in parts))
    final = OUT / "retta-demo.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(final)], check=True)
    for state in TMP.glob("state-*.json"):
        state.unlink()  # session cookies; not kept on disk
    print(f"Listo: {final}")


if __name__ == "__main__":
    main()
