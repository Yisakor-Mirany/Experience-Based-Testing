const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('console', m => { if (m.type()==='error'||m.type()==='warning') console.log('  [console.'+m.type()+']', m.text().slice(0,160)); });
  await p.goto('http://localhost:5173/bookings/add');
  await p.waitForTimeout(800);
  await p.fill('input[name=date]', '2026-12-20');
  await p.click('text=Confirm Booking');
  await p.click('nav >> text=Bookings');
  await p.waitForTimeout(300);
  console.log('T9b bookings:', await p.$$eval('main p', e => e.map(x => x.textContent)));
  await p.click('nav >> text=Home'); await p.waitForSelector('text=Cozy Cabin');
  console.log('Home buttons/links:', await p.$$eval('main button, main a', e => e.map(x => x.textContent)));
  await b.close();
})();
