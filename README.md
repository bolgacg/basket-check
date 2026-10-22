# basket-check

Does each fund's holdings file add up to its NAV?

An end of day reconciliation of public ETF files: each BetaShares fund's published holdings report,
summed, against the fund's NAV on the report's own date times its units on issue. It is one input to
PCF work, not the PCF check itself, which also needs the next day's corporate actions, the cash
component and the creation unit size; issuers do not publish those, and this project does not attempt
them. The gaps come from dates that do not line up, bonds printed without the interest they have
earned, hedges and futures margin the file does not carry, and a shared international gap for which
the page offers only a hypothesis.

Page: https://bolgacg.github.io/basket-check/

## What it checks

- **As printed.** The file's Market Value column summed, against the net assets on the fund's page.
- **Dated.** The same sum against the NAV on the file's own date, from the fund's NAV history, times
  the units on issue.
- **Mine.** As dated, after adding to every fixed rate bond the interest it has earned since its last
  coupon, worked out from the file's own coupon, maturity and face value columns. Two variants, accrual
  to settlement and no accrual inside the ex interest window, are reported beside it.
- **Futures pairs.** Where two funds hold the same futures contract, their gaps per contract, to test
  whether a gap is one day's margin not yet in the file's cash.
- **Day over day.** Wherever two consecutive files exist, the earlier holdings valued at the later
  file's values, against the NAV move. The site serves only the latest file, so this needs the
  collector to have run on both days.

## Run it

```
python3 study/collect.py      # today's holdings files, NAV histories and units, into data/raw/
python3 study/check.py        # every check for every fund, data/check.json
python3 study/summarise.py    # the page's numbers, docs/data.js
node study/verify_page.js     # renders the page, screenshots, walks the tour
```

Then open `docs/index.html`. Every number on the page comes from `docs/data.js`, which
`summarise.py` writes; the page recomputes its own counts in the browser and prints whether they
match. Run `collect.py` once a day and the history of holdings files grows from the first run.

## Data and terms

Holdings files, NAV histories, units on issue and net assets come from www.betashares.com.au/fund/
and the download links on each fund page. Betashares' website terms say "You may use the
information for your own personal reference only" and "Except as permitted under the Copyright Act
1968 (Cth) or other applicable laws, this website or any portion of this website may not otherwise be
reproduced, adapted, distributed, displayed, or transmitted to any other person or incorporated in any
way into another document or other material, without BHPL's express written consent." This project
relies on what the Copyright Act permits, fair dealing for research and for criticism or review with
the source acknowledged. So this repository contains no Betashares file: `data/raw/` is excluded from
version control, and `collect.py` downloads the files to the machine that runs it. The page shows my
calculations, with only short factual excerpts such as a code, a date, a coupon or a quantity. This
project is not affiliated with or endorsed by Betashares, ASX or Optiver, and nothing in it describes
Optiver's systems. The collector fetches each file once per run, one request at a time with a pause
between, and is meant to run once a day. If Betashares asks, I will take the page down.

I built this with Claude as a coding assistant. The checks, the rules and the conclusions are mine.
