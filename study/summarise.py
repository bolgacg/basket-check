"""Turn data/check.json into docs/data.js for the page.

Every number the page prints comes from here, and the page recomputes its headline from the
per fund sums shipped with it. What ships is my arithmetic plus short factual excerpts: a
code, a date, a coupon, a quantity. No holdings file is copied.

    python3 study/summarise.py
"""
import json
import os
import statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOL_BP = 5.0
FAMILIES = ["Australian shares", "International shares", "Funds of funds", "Hybrids", "Options overlay",
            "Currency hedged", "Geared", "Futures and cash", "Fixed rate bonds", "Floating rate bonds", "International bonds", "Other"]


def r(x, n=2):
    return None if x is None else round(x, n)


def title(n):
    small = {"ETF", "ASX", "AUD", "USD", "S&P", "ESG", "FRN", "II", "III", "REIT", "NASDAQ", "US", "UK", "LVR", "(30-40%"}
    return " ".join(w.upper() if w.upper().strip("()%") in {x.strip("()%") for x in small} else w.capitalize()
                    for w in (n or "").split())


def main():
    c = json.load(open(os.path.join(ROOT, "data", "check.json")))
    # One day for every fund: the latest holdings date the collection found.
    day = max(f["days"][-1]["d"] for f in c["funds"])
    funds, skipped, seen = [], [], set()
    for w in c.get("weights_only", []):
        if w["tk"] not in seen:
            seen.add(w["tk"])
            skipped.append({"tk": w["tk"], "name": title(w["name"]),
                            "why": "its NAV history download returned a server error" if w.get("why") == "nav" else "its file gives weights only, no values"})
    for f in c["funds"]:
        d = f["days"][-1]
        if d["d"] != day:
            skipped.append({"tk": f["tk"], "name": title(f["name"]), "why": "no NAV for " + day + " in the history it served"})
            continue
        if d.get("mine") is None:
            skipped.append({"tk": f["tk"], "name": title(f["name"]), "why": "no units on issue on its page"})
            continue
        row = {
            "tk": f["tk"], "name": title(f["name"]), "family": f["family"], "d": d["d"], "lines": d["lines"],
            "mv": round(d["mv"], 2), "accrued": round(d["accrued"], 2), "nav": d["nav"], "units": d["units"],
            "units_as_at": d["units_as_at"], "net_assets": d["net_assets"], "nav_as_at": d["nav_as_at"],
            "nav_prev": None, "printed": r(d["as_printed"]), "dated": r(d["dated"]), "mine": r(d["mine"]),
            "floor": r(d.get("floor")), "accrued_bp": r(d.get("accrued_bp")),
            "no_value": [{"tk": x["tk"], "kind": x["kind"], "qty": x["qty"]} for x in d["no_value"]][:4],
            "fixed": d.get("fixed_lines", 0), "floating": d.get("floating_lines", 0),
            "bond": (d.get("bond_lines") or [None])[0],
            "ret": {k: r(v) if isinstance(v, float) else v for k, v in d["ret"].items()} if d.get("ret") else None,
        }
        funds.append(row)
    order = {fam: i for i, fam in enumerate(FAMILIES)}
    funds.sort(key=lambda x: (order.get(x["family"], 99), abs(x["mine"])))

    def out(k, tol=TOL_BP):
        return sum(1 for x in funds if x[k] is not None and abs(x[k]) > tol)

    fams = []
    for fam in FAMILIES:
        xs = [x for x in funds if x["family"] == fam]
        if xs:
            fams.append({"family": fam, "n": len(xs), "out": sum(1 for x in xs if abs(x["mine"]) > TOL_BP),
                         "median": round(statistics.median(abs(x["mine"]) for x in xs), 2)})
    dates = sorted({x["d"] for x in funds})
    bonds = [x for x in funds if x["family"] == "Fixed rate bonds"]
    summary = {
        "n": len(funds), "dates": dates, "tol": TOL_BP,
        "printed_out": out("printed"), "dated_out": out("dated"), "mine_out": out("mine"),
        "floor_median": round(statistics.median(abs(x["floor"]) for x in funds if x["floor"] is not None), 1),
        "bond_n": len(bonds),
        "bond_dated_median": round(statistics.median(abs(x["dated"]) for x in bonds), 1) if bonds else None,
        "bond_mine_median": round(statistics.median(abs(x["mine"]) for x in bonds), 1) if bonds else None,
        "ret_n": sum(1 for x in funds if x["ret"]),
        "skipped": skipped,
    }
    # The unhedged international funds on every date collected, to see whether their shared gap
    # holds still or moves from day to day.
    by_date = {}
    for f in c["funds"]:
        if f["family"] != "International shares":
            continue
        for d in f["days"]:
            if d.get("mine") is not None:
                by_date.setdefault(d["d"], []).append(d["mine"])
    summary["intl_by_date"] = [{"d": k, "n": len(v), "median": round(statistics.median(v), 1),
                                "lo": round(min(v), 1), "hi": round(max(v), 1),
                                "same_side": max(sum(1 for x in v if x > 0), sum(1 for x in v if x < 0))}
                               for k, v in sorted(by_date.items()) if len(v) >= 5]
    page = {"tol": TOL_BP, "summary": summary, "families": fams, "funds": funds}
    with open(os.path.join(ROOT, "docs", "data.js"), "w") as fh:
        fh.write("/* Generated by study/summarise.py from BetaShares' public files. Not typed by hand. */\n")
        fh.write("var D = " + json.dumps(page, separators=(",", ":")) + ";\n")
    json.dump(summary, open(os.path.join(ROOT, "data", "summary.json"), "w"), indent=1)
    return summary


if __name__ == "__main__":
    print(json.dumps(main(), indent=1))
