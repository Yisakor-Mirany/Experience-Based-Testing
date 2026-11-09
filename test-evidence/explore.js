const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const log = (...a) => console.log(...a);

async function freshFromHome(browser) {
  const page = await browser.newPage();
  page.on('pageerror', e => log('  [pageerror]', e.message));
  await page.goto(BASE + '/');
  await page.waitForSelector('text=Cozy Cabin');
  await page.click('nav >> text=Add Booking');
  await page.waitForSelector('[data-cy=booking-form]');
  return page;
}
async function bookingsText(page) {
  await page.click('nav >> text=Bookings');
  await page.waitForURL('**/bookings');
  const ps = await page.$$eval('main p', els => els.map(e => e.textContent));
  return ps;
}
async function formState(page) {
  return page.evaluate(() => {
    const s = document.querySelector('select[name=rental]');
    const d = document.querySelector('input[name=date]');
    const g = document.querySelector('input[name=guests]');
    return { selectShown: s.options[s.selectedIndex]?.text, selectValue: s.value, optionCount: s.options.length,
      date: d.value, guests: g.value, dateValid: d.validity.valid, dateMsg: d.validationMessage,
      guestsValid: g.validity.valid, guestsMsg: g.validationMessage, url: location.pathname,
      bodyText: document.querySelector('main').innerText.slice(0, 200) };
  });
}

(async () => {
  const browser = await chromium.launch();

  log('\n== T1: open form from Home, inspect defaults');
  let p = await freshFromHome(browser);
  log(await formState(p));
  log('  options:', await p.$$eval('select[name=rental] option', o => o.map(x => x.value)));
  await p.close();

  log('\n== T2: valid booking, explicitly choose Luxury Villa, date 2026-12-20, 3 guests');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Luxury Villa');
  await p.fill('input[name=date]', '2026-12-20');
  await p.fill('input[name=guests]', '3');
  await p.click('text=Confirm Booking');
  await p.waitForTimeout(500);
  log('  after submit:', await formState(p));
  log('  bookings page:', await bookingsText(p));
  await p.close();

  log('\n== T3: leave rental dropdown untouched (shows first option), pick date, submit');
  p = await freshFromHome(browser);
  await p.fill('input[name=date]', '2026-12-20');
  log('  before submit:', await formState(p));
  await p.click('text=Confirm Booking');
  await p.waitForTimeout(300);
  log('  bookings page:', await bookingsText(p));
  await p.close();

  log('\n== T4: missing date');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Cozy Cabin');
  await p.click('text=Confirm Booking');
  await p.waitForTimeout(300);
  log('  state:', await formState(p));
  log('  bookings page:', await bookingsText(p));
  await p.close();

  for (const g of ['0', '-2', '2.5', '', '999']) {
    log(`\n== T5: guests = "${g}"`);
    p = await freshFromHome(browser);
    await p.selectOption('select[name=rental]', 'Cozy Cabin');
    await p.fill('input[name=date]', '2026-12-20');
    await p.fill('input[name=guests]', g);
    await p.click('text=Confirm Booking');
    await p.waitForTimeout(300);
    const st = await formState(p);
    log('  guests valid:', st.guestsValid, '| msg:', st.guestsMsg);
    log('  bookings page:', await bookingsText(p));
    await p.close();
  }

  log('\n== T6: past date 2020-01-01');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Ski Chalet');
  await p.fill('input[name=date]', '2020-01-01');
  await p.click('text=Confirm Booking');
  await p.waitForTimeout(300);
  log('  state:', (await formState(p)).dateValid);
  log('  bookings page:', await bookingsText(p));
  await p.close();

  log('\n== T7: impossible date typed with keyboard (02/30/2026)');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Ski Chalet');
  await p.click('input[name=date]');
  await p.keyboard.type('02302026');
  log('  date value after typing:', (await formState(p)).date);
  await p.click('text=Confirm Booking');
  await p.waitForTimeout(300);
  log('  state:', await formState(p));
  log('  bookings page:', await bookingsText(p));
  await p.close();

  log('\n== T8: click Confirm Booking twice quickly');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Downtown Loft');
  await p.fill('input[name=date]', '2026-12-24');
  await p.fill('input[name=guests]', '2');
  await p.click('text=Confirm Booking');
  await p.click('text=Confirm Booking');
  await p.waitForTimeout(300);
  log('  bookings page:', await bookingsText(p));
  await p.close();

  log('\n== T9: go directly to /bookings/add (no Home visit first)');
  p = await browser.newPage();
  await p.goto(BASE + '/bookings/add');
  await p.waitForSelector('[data-cy=booking-form]');
  await p.waitForTimeout(1000);
  log(await formState(p));
  await p.close();

  log('\n== T10: refresh Bookings page after booking');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Desert Oasis');
  await p.fill('input[name=date]', '2026-12-28');
  await p.click('text=Confirm Booking');
  log('  before reload:', await bookingsText(p));
  await p.reload();
  await p.waitForTimeout(800);
  log('  after reload:', await p.$$eval('main p', els => els.map(e => e.textContent)), '| main text:', JSON.stringify(await p.innerText('main')));
  await p.close();

  log('\n== T11: empty Bookings page with no bookings');
  p = await browser.newPage();
  await p.goto(BASE + '/bookings');
  await p.waitForTimeout(800);
  log('  main text:', JSON.stringify(await p.innerText('main')));
  await p.close();

  log('\n== T12: Bookings list shows anything besides rental/date/guests (price, id, location)?');
  p = await freshFromHome(browser);
  await p.selectOption('select[name=rental]', 'Mountain Retreat');
  await p.fill('input[name=date]', '2027-01-05');
  await p.fill('input[name=guests]', '4');
  await p.click('text=Confirm Booking');
  log('  bookings page:', await bookingsText(p));

  await p.close();

  await browser.close();
})();
