"""Check every collected BetaShares holdings file against the NAV BetaShares published.

Level check, for each fund and each holdings date D:
  as printed  the file's Market Value column summed, against the net assets on the fund's page
              (the figure a reader finds next to the file, whatever date it carries);
  dated       the same sum against NAV on D, from the fund's NAV history, times units on issue;
  mine        as dated, after reading each line by its type: fixed rate bonds are printed at
              clean prices, so the interest each has earned since its last coupon is added,
              worked out from the file's own coupon, maturity and face value columns.
Return check, wherever a fund has files for two consecutive trading days D0 and D1: the D0
holdings valued at the D1 prices (market value over quantity in the D1 file), against the
NAV move from D0 to D1 with any distribution added back.

    python3 study/check.py        writes data/check.json
"""
import calendar
import csv
import datetime as dt
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "betashares")


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def load_holdings(path):
    lines = open(path, encoding="utf-8-sig").read().splitlines()
    hi = next(i for i, l in enumerate(lines) if l.startswith("Ticker,"))
    meta = {}
    for l in lines[:hi]:
        p = l.split(",", 1)
        if len(p) == 2 and p[0]:
            meta[p[0]] = p[1].strip()
    body = []
    for l in lines[hi:]:
        if l.strip() in ('""', ""):
            break
        body.append(l)
    rows = list(csv.DictReader(body))
    return meta, rows


def load_nav(path):
    nav, dist = {}, {}
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        if num(r.get("NAV")) is None:
            continue
        nav[r["Date"]] = float(r["NAV"])
        if num(r.get("Distribution")):
            dist[r["Date"]] = float(r["Distribution"])
    return nav, dist


def add_months(d, m):
    y, mo = d.year + (d.month - 1 + m) // 12, (d.month - 1 + m) % 12 + 1
    return dt.date(y, mo, min(d.day, calendar.monthrange(y, mo)[1]))


def accrued(row, d, detail=False):
    """Interest a fixed rate bond has earned since its last coupon, per the file's columns.
    Australian dollar bonds pay twice a year, counting back from maturity."""
    c, f = num(row.get("Coupon (%)")), num(row.get("Notional/Face Value"))
    try:
        m = dt.date.fromisoformat(row.get("Maturity Date") or "")
    except ValueError:
        return None
    if not c or not f or "Float" in row["Ticker"] or m <= d or row.get("Currency") != "AUD":
        return None
    k = 0
    while add_months(m, -6 * (k + 1)) > d:
        k += 1
    nxt, last = add_months(m, -6 * k), add_months(m, -6 * (k + 1))
    a = f * c / 100 / 2 * (d - last).days / (nxt - last).days
    if detail:
        return {"tk": row["Ticker"], "name": row["Name"], "coupon": c, "maturity": m.isoformat(), "face": f,
                "mv": num(row.get("Market Value (AUD)")), "last": last.isoformat(), "next": nxt.isoformat(),
                "days": (d - last).days, "period": (nxt - last).days, "accrued": a}
    return a


def kind(row, layout):
    t = row["Ticker"]
    if "FUTURE" in row.get("Name", "").upper() or t.endswith(" Comdty") or t.endswith(" Index"):
        return "futures"
    if layout == "bond":
        if t == "AUD" or "DOLLAR" in row.get("Name", ""):
            return "cash"
        if row["Ticker"].endswith(" AT") and not row.get("Maturity Date"):
            return "fund"
        return "floating" if "Float" in t else "fixed"
    a = (row.get("Asset Class") or "").lower()
    if "future" in a:
        return "futures"
    if "cash" in a:
        return "cash"
    if "forward" in a or "currency" in a:
        return "forward"
    return a or "other"


def family(name, layout, kinds, rows):
    n = name.lower()
    if "geared" in n:
        return "Geared"
    if "hedged" in n:
        return "Currency hedged"
    if layout == "bond":
        if "complex" in n:
            return "Other"
        ccy = {r.get("Currency") for r in rows if kind(r, layout) in ("fixed", "floating")}
        if "hedged" in n or (ccy and ccy != {"AUD"}):
            return "International bonds"
        return "Floating rate bonds" if kinds.get("floating", 0) > kinds.get("fixed", 0) else "Fixed rate bonds"
    if kinds.get("futures") and not kinds.get("equities") and not kinds.get("equity preference"):
        return "Futures and cash"
    if kinds.get("equity preference"):
        return "Hybrids"
    total = sum(num(r.get("Market Value (AUD)")) or 0 for r in rows) or 1
    in_funds = sum(num(r.get("Market Value (AUD)")) or 0 for r in rows
                   if r["Ticker"].endswith(" AT") and "BETASHARES" in r["Name"].upper() and "CASH" not in r["Name"].upper())
    if in_funds / total > 0.5:
        return "Funds of funds"
    if "yield maximiser" in n or "covered call" in n:
        return "Options overlay"
    ccy = {r.get("Currency") for r in rows if kind(r, layout) == "equities"}
    if kinds.get("equities") and ccy <= {"AUD"}:
        return "Australian shares"
    if kinds.get("equities"):
        return "International shares"
    return "Other"


def main():
    pages = {}
    for p in sorted(glob.glob(os.path.join(RAW, "pages", "*.json"))):
        for f in json.load(open(p)).values():
            if f.get("ticker"):
                pages.setdefault(f["ticker"], []).append(f)
    funds, weights_only = [], []
    for folder in sorted(glob.glob(os.path.join(RAW, "holdings", "*"))):
        tk = os.path.basename(folder)
        navp = os.path.join(RAW, "nav", tk + ".csv")
        if not os.path.exists(navp) or tk not in pages:
            weights_only.append({"tk": tk, "name": (pages.get(tk) or [{}])[-1].get("name") or tk, "d": None, "why": "nav"})
            continue
        nav, dist = load_nav(navp)
        files = sorted(glob.glob(os.path.join(folder, "*.csv")))
        days = []
        for path in files:
            meta, rows = load_holdings(path)
            d = meta.get("Date")
            if rows and ("Market Value (AUD)" not in rows[0] or not any(num(r.get("Market Value (AUD)")) for r in rows)):
                # Some files give weights only, with no values, so there is nothing to add up.
                weights_only.append({"tk": tk, "name": meta.get("Fund Name"), "d": d})
                continue
            if not d or d not in nav:
                continue
            layout = "bond" if "Coupon (%)" in rows[0] else "equity"
            kinds = {}
            for r in rows:
                kinds[kind(r, layout)] = kinds.get(kind(r, layout), 0) + 1
            mv = sum(num(r.get("Market Value (AUD)")) or 0 for r in rows)
            acc = sum(accrued(r, dt.date.fromisoformat(d)) or 0 for r in rows) if layout == "bond" else 0.0
            blank = [r["Ticker"] for r in rows if num(r.get("Market Value (AUD)")) is None]
            # The page facts that go with this file: the first collection whose units are dated
            # on or after the file's date.
            pg = next((p for p in pages[tk] if (p.get("units_as_at") or p.get("nav_as_at") or "") >= d), pages[tk][-1])
            units = pg.get("units")
            na_page = pg.get("net_assets")
            day = {"d": d, "layout": layout, "kinds": kinds, "lines": len(rows), "mv": mv, "accrued": acc,
                   "blank": blank, "nav": nav[d], "units": units, "units_as_at": pg.get("units_as_at"),
                   "net_assets": na_page, "nav_page": pg.get("nav"), "nav_as_at": pg.get("nav_as_at"),
                   "name": meta.get("Fund Name") or pg.get("name")}
            if units:
                na = nav[d] * units
                # The floor: the same check pinned one trading day early, which is what a date
                # slip costs. It is about one day's move of the fund.
                dates = sorted(nav)
                i = dates.index(d)
                day["floor"] = (mv / (nav[dates[i - 1]] * units) - 1) * 1e4 if i > 0 else None
                day["as_printed"] = (mv / na_page - 1) * 1e4 if na_page else None
                day["dated"] = (mv / na - 1) * 1e4
                day["mine"] = ((mv + acc) / na - 1) * 1e4
                day["accrued_bp"] = acc / na * 1e4
            # Lines that carry no market value, and what the file says about them instead.
            day["no_value"] = [{"tk": r["Ticker"], "name": r["Name"], "kind": kind(r, layout),
                                "qty": num(r.get("Shares/Units (#)") or r.get("Notional/Face Value"))} for r in rows
                               if num(r.get("Market Value (AUD)")) is None]
            if layout == "bond":
                det = [x for x in (accrued(r, dt.date.fromisoformat(d), True) for r in rows) if x]
                day["bond_lines"] = sorted(det, key=lambda x: -x["accrued"])[:3]
                day["fixed_lines"], day["floating_lines"] = kinds.get("fixed", 0), kinds.get("floating", 0)
            day["rows"] = rows
            days.append(day)
        if not days:
            continue
        # Return check across consecutive files.
        dates = sorted(nav)
        for a, b in zip(days, days[1:]):
            if dates.index(b["d"]) - dates.index(a["d"]) != 1:
                continue
            px1 = {}
            for r in b["rows"]:
                q, v = num(r.get("Shares/Units (#)") or r.get("Notional/Face Value")), num(r.get("Market Value (AUD)"))
                if q and v is not None:
                    px1[r["Ticker"]] = v / q
            base = look = mine = 0.0
            for r in a["rows"]:
                q, v = num(r.get("Shares/Units (#)") or r.get("Notional/Face Value")), num(r.get("Market Value (AUD)"))
                if not q or v is None:
                    continue
                base += v
                look += q * px1.get(r["Ticker"], 0.0)
                mine += q * px1.get(r["Ticker"], v / q)
            if base:
                r_nav = (b["nav"] + dist.get(b["d"], 0.0)) / a["nav"]
                b["ret"] = {"prev": a["d"], "nav_bp": (r_nav - 1) * 1e4,
                            "lookup": (look / base / r_nav - 1) * 1e4, "mine": (mine / base / r_nav - 1) * 1e4,
                            "floor": (1 / r_nav - 1) * 1e4}
        fam = family(days[-1]["name"] or "", days[-1]["layout"], days[-1]["kinds"], days[-1]["rows"])
        for d in days:
            d.pop("rows")
        funds.append({"tk": tk, "name": days[-1]["name"], "family": fam, "url": pages[tk][-1]["url"], "days": days})
    json.dump({"funds": funds, "weights_only": weights_only}, open(os.path.join(ROOT, "data", "check.json"), "w"), indent=1)
    return funds


if __name__ == "__main__":
    fs = main()
    for f in fs:
        d = f["days"][-1]
        print(f"{f['tk']:6} {f['family']:22} {d['d']} units@{d['units_as_at']} "
              f"printed {d.get('as_printed') or 0:8.1f} dated {d.get('dated') or 0:8.1f} mine {d.get('mine') or 0:8.1f}"
              + (f"  ret lookup {d['ret']['lookup']:.1f} mine {d['ret']['mine']:.1f}" if d.get("ret") else ""))
