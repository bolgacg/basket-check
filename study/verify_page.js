/* Render the page headless, capture any script error, screenshot it at desktop
   and phone width, probe for horizontal overflow, and walk every tour step.

   node study/verify_page.js [outdir] */
const { chromium } = require('/home/bolgac/projects/minimalist-workout-app/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'docs', 'index.html');
const OUT = process.argv[2] || path.resolve(__dirname, '..', 'data', 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  let fail = false;

  for (const [name, w, h] of [['w1280', 1280, 800], ['w375', 375, 812], ['w390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'dark' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { errors.push(`[${name}] pageerror: ${e.message}`); });
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
    await page.goto(PAGE + '?tour=off', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const overflow = await page.evaluate(() => {
      const bad = [];
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 1) {
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 1 && r.width > 0) {
            let ok = el;
            while (ok && ok !== document.body) {
              const st = getComputedStyle(ok);
              if (st.overflowX === 'auto' || st.overflowX === 'scroll') return;
              ok = ok.parentElement;
            }
            bad.push((el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '')) + ' right=' + Math.round(r.right));
          }
        });
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, bad: bad.slice(0, 8) };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 1) {
      console.log(`OVERFLOW at ${name}: scrollWidth ${overflow.scrollWidth} > ${overflow.clientWidth}`);
      overflow.bad.forEach(b => console.log('   ' + b));
      if (name !== 'w1280') fail = true;
    } else {
      console.log(`no horizontal overflow at ${name} (${w}px)`);
    }

    await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(OUT, `${name}-first.png`) });
    for (const sel of ['#bluecard', '#qgrid', '#domain', '#act1', '#act2', '#act3', '#act4', '#coda']) {
      const h = await page.$(sel);
      if (h) await h.screenshot({ path: path.join(OUT, `${name}-${sel.slice(1)}.png`) });
    }

    // Read back what the page actually printed, so the numbers can be checked.
    const printed = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      q: document.querySelector('#qgrid').innerText,
      stat: document.querySelector('#blufstat').innerText.replace(/\n/g, ' | '),
      verdicts: Array.from(document.querySelectorAll('.verdict')).map(v => v.innerText),
      fail: document.querySelector('#failpane').innerText,
      self: document.querySelector('#selfcheck').innerText,
      logRows: document.querySelectorAll('#logtable tbody tr').length,
      day: document.querySelector('#fundcard').innerText
    }));
    fs.writeFileSync(path.join(OUT, `${name}-printed.json`), JSON.stringify(printed, null, 1));
    if (name === 'w1280') {
      // Open every act-one kind and every log filter so all generated copy is in the dump.
      let text = await page.evaluate(() => document.body.innerText);
      for (const b of await page.$$('#kindchips .chip')) { await b.click(); text += '\n' + await page.evaluate(() => document.querySelector('#kindcard').innerText); }
      const rows = await page.$$('#logtable tbody tr');
      for (const r of rows) { await r.click(); text += '\n' + await page.evaluate(() => document.querySelector('#logdetail').innerText); }
      fs.writeFileSync(path.join(OUT, 'page-text.txt'), text);
    }
    if (name === 'w1280') {
      console.log('background in dark-preferring browser: ' + printed.bg);
      console.log('\nQUESTIONS:\n' + printed.q);
      console.log('STAT: ' + printed.stat);
      printed.verdicts.forEach((v, i) => console.log(`VERDICT ${i}: ${v}`));
      console.log('SELF: ' + printed.self);
      console.log('log rows: ' + printed.logRows);
    }
    await ctx.close();
  }

  // Walk every tour step at both widths and confirm the highlight frames a real box.
  for (const [name, w, h] of [['desktop', 1536, 960], ['phone', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { errors.push(`[tour ${name}] pageerror: ${e.message}`); });
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    let step = 0;
    while (true) {
      const info = await page.evaluate(() => {
        const root = document.querySelector('#tour');
        if (!root || !root.classList.contains('on')) return null;
        const hl = document.querySelector('.tour-hl').getBoundingClientRect();
        const card = document.querySelector('.tour-card').getBoundingClientRect();
        const k = document.querySelector('.tour-card .tk');
        return {
          k: k ? k.textContent : '', hlTop: Math.round(hl.top), hlH: Math.round(hl.height),
          cardTop: Math.round(card.top), cardH: Math.round(card.height),
          overlaps: !(card.right < hl.left || card.left > hl.right || card.bottom < hl.top || card.top > hl.bottom)
        };
      });
      if (!info) break;
      step++;
      const bad = info.hlH < 40 || info.overlaps;
      if (bad) { fail = true; }
      console.log(`tour ${name} step ${step}: ${info.k} highlight top=${info.hlTop} h=${info.hlH} card top=${info.cardTop}${info.overlaps ? '  CARD COVERS THE HIGHLIGHT' : ''}${info.hlH < 40 ? '  HIGHLIGHT COLLAPSED' : ''}`);
      await page.screenshot({ path: path.join(OUT, `tour-${name}-${step}.png`) });
      const next = await page.$('#tnext');
      if (!next) break;
      await next.click();
      await page.waitForTimeout(700);
      if (step > 12) break;
    }
    await ctx.close();
  }

  await browser.close();
  if (errors.length) {
    console.log('\nSCRIPT ERRORS:');
    errors.forEach(e => console.log('  ' + e));
    fail = true;
  } else {
    console.log('\nno script errors');
  }
  console.log('\nshots in ' + OUT);
  process.exit(fail ? 1 : 0);
})();
