"""Collect today's public files for every BetaShares fund into data/raw/betashares/.

For each fund listed on www.betashares.com.au/fund/ it saves three things:
  holdings/<TICKER>/<date>.csv   the portfolio holdings file, filed under the date it states
  nav/<TICKER>.csv               the daily NAV history, which the site serves in full
  pages/<UTC time>.json          units outstanding, net assets and NAV per unit with their
                                 as-at dates, read from each fund's page (the page is not kept)

The files are BetaShares' and are not part of this repository: data/raw/ is in .gitignore.
Run it once a day and the history of holdings files grows from the first run; the site only
ever serves the latest holdings file.

    python3 study/collect.py [TICKER ...]
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.betashares.com.au"
UA = "Mozilla/5.0 (X11; Linux x86_64) basket-check research script"
PAUSE = 1.5   # one request at a time, slowly


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8-sig", errors="replace")


def text_of(page):
    s = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", page)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", s)


def facts(page):
    """Units outstanding, net assets and NAV per unit, each with the date the page gives."""
    t = text_of(page)
    out = {}
    m = re.search(r"Units outstanding\*? \(#\) ([0-9,]+)", t)
    out["units"] = int(m.group(1).replace(",", "")) if m else None
    m = re.search(r"Net assets\*? \$([0-9,]+)", t)
    out["net_assets"] = int(m.group(1).replace(",", "")) if m else None
    m = re.search(r"NAV/[Uu]nit\*? \$([0-9.,]+) .{0,80}?As at ([0-9]{1,2} [A-Za-z]+ [0-9]{4})", t)
    if m:
        out["nav"] = float(m.group(1).replace(",", ""))
        out["nav_as_at"] = dt.datetime.strptime(m.group(2), "%d %B %Y").date().isoformat()
    m = re.search(r"\* As at ([0-9]{1,2} [A-Za-z]+ [0-9]{4}) \*\*Certain additional costs", t)
    if m:
        out["units_as_at"] = dt.datetime.strptime(m.group(1), "%d %B %Y").date().isoformat()
    m = re.search(r"/files/csv/([A-Z0-9]+)_Portfolio_Holdings\.csv", page)
    out["ticker"] = m.group(1) if m else None
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    out["name"] = text_of(m.group(1)).strip() if m else None
    return out


def main():
    want = set(a.upper() for a in sys.argv[1:])
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%MZ")
    out = os.path.join(ROOT, "data", "raw", "betashares")
    for sub in ("holdings", "nav", "pages"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    index = get(SITE + "/fund/")
    links = sorted(set(re.findall(r'href="(https://www\.betashares\.com\.au/fund/[a-z0-9-]+/)"', index)))
    print(f"{len(links)} fund pages listed")
    pages = {}
    pj = os.path.join(out, "pages", stamp + ".json")
    for url in links:
        time.sleep(PAUSE)
        try:
            f = facts(get(url))
        except Exception as e:
            print("  page failed", url, e)
            continue
        f["url"] = url
        f["fetched"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        tk = f["ticker"]
        if not tk or (want and tk not in want):
            continue
        pages[url] = f
        for kind, src in (("holdings", f"{SITE}/files/csv/{tk}_Portfolio_Holdings.csv"),
                          ("nav", f"{SITE}/wp-admin/admin-ajax.php?action=fund_nav_csv&ticker={tk}")):
            time.sleep(PAUSE)
            try:
                body = get(src)
            except Exception as e:
                print("  ", tk, kind, "failed", e)
                continue
            if kind == "nav":
                open(os.path.join(out, "nav", f"{tk}.csv"), "w").write(body)
                continue
            m = re.search(r"^Date,(\d{4}-\d{2}-\d{2})", body, re.M)
            folder = os.path.join(out, "holdings", tk)
            os.makedirs(folder, exist_ok=True)
            open(os.path.join(folder, (m.group(1) if m else "undated-" + stamp) + ".csv"), "w").write(body)
        print(f"  {tk:6} units {f.get('units')} as at {f.get('units_as_at')}")
        json.dump(pages, open(pj, "w"), indent=1)


if __name__ == "__main__":
    main()
