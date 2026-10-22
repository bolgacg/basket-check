# basket-check

Does each fund's holdings file add up to its NAV?

An ETF pricing desk checks every day that each fund's basket adds up to the NAV the issuer
publishes. I ran that check on one day of public holdings files from every BetaShares fund that
publishes one: each file summed, and set against the fund's NAV on the file's own date times its
units on issue. The gaps come from dates that do not line up, bonds printed without the interest
they have earned, and holdings that move the NAV without carrying a value in the file.

Page: https://bolgacg.github.io/basket-check/

## What it checks

- **As printed.** The file's Market Value column summed, against the net assets on the fund's page.
- **Dated.** The same sum against the NAV on the file's own date, from the fund's NAV history, times
  the units on issue.
- **Mine.** As dated, after adding to every fixed rate bond the interest it has earned since its last
  coupon, worked out from the file's own coupon, maturity and face value columns.
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
Optiver's systems.

I built this with Claude as a coding assistant. The checks, the rules and the conclusions are mine.
