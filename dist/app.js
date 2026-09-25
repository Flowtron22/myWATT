import {
  applianceEnergyForDays as modelApplianceEnergyForDays,
  calculateBill as modelCalculateBill,
  incentiveRate,
  integrateSimulationInterval,
  isActiveAtTime as modelIsActiveAtTime,
  isProtectionConfigCurrent,
  liveLoadKwAt,
  monthlyKwh as modelMonthlyKwh,
  operatingFactor,
  syncUsageHours,
  tariffConfig,
  touEnergySplit as modelTouEnergySplit,
  wattsFor
} from './model.js';

const protectionThreshold = tariffConfig.protection.thresholdKwh;
const daysPerMonth = tariffConfig.daysPerMonth;
const defaultAfa = tariffConfig.afa.rateSenPerKwh;
const representativeWeekdays = tariffConfig.representativeWeekdays;

const defaults = [
  { id: 'homebase', name: 'House idle load', icon: '⌂', watts: 28, hours: 24, qty: 1, duty: 1, on: true, alwaysOn: true, awayOn: true, start: 0, room: 'Whole house', note: 'Small standby loads left connected' },
  { id: 'aircon', name: 'Air conditioner', icon: '❄', watts: 1050, hours: 8, qty: 1, duty: 0.68, on: true, start: 22, room: 'Bedroom', roomAreaSqFt:237, setpoint:24, variant: '1.5 HP', stars: 5, variants: [{ label:'1.0 HP', watts:720 },{ label:'1.5 HP', watts:1050 },{ label:'2.0 HP', watts:1450 },{ label:'2.5 HP', watts:1850 },{ label:'3.0 HP', watts:2300 }], secondaryVariant: 'Inverter', secondaryVariantLabel: 'Compressor type', secondaryVariants: [{ label:'Inverter', duty:.68 },{ label:'Non-inverter', duty:.85 }], note: 'Inverter units vary compressor speed after the room cools. Non-inverter units repeatedly run at full speed and stop. Room floor area and thermostat setting adjust the operating estimate.' },
  { id: 'fridge', name: 'Refrigerator', icon: '▥', watts: 150, hours: 24, qty: 1, duty: 0.38, on: true, awayOn: true, start: 0, room: 'Kitchen', variant: '2-door · 300L', variantLabel: 'Fridge type', stars: 4, variants: [{ label:'Mini bar · 90L', watts:70 },{ label:'1-door · 180L', watts:105 },{ label:'2-door · 300L', watts:150 },{ label:'4-door · 500L', watts:240 },{ label:'Side-by-side · 600L', watts:270 }] },
  { id: 'waterpurifier', name: 'Water purifier / dispenser', icon: '◈', watts: 500, hours: 24, qty: 1, duty: .18, on: true, awayOn: true, start: 0, room: 'Kitchen', variant: 'Hot + cold storage dispenser', variantLabel: 'Which kind do you own?', variants: [{ label:'Basic tap / under-sink filter', watts:0, duty:0 },{ label:'Room-temperature purifier', watts:10, duty:.5 },{ label:'Cold + room dispenser', watts:120, duty:.25 },{ label:'Hot + cold storage dispenser', watts:500, duty:.18 },{ label:'Instant-heating hot + cold', watts:2600, duty:.025 },{ label:'Alkaline water ionizer', watts:130, duty:.01 }], note: 'Choose hot + cold storage if the unit keeps tanks of water ready all day. Choose instant-heating if it heats only when you dispense. Basic filters may use no mains electricity.' },
  { id: 'freezer', name: 'Freezer', icon: '▤', watts: 160, hours: 24, qty: 1, duty: 0.42, on: false, awayOn: true, start: 0, room: 'Kitchen', variant: 'Chest · 300L', variantLabel: 'Freezer type', stars: 4, variants: [{ label:'Chest · 150L', watts:110 },{ label:'Chest · 300L', watts:160 },{ label:'Upright · 250L', watts:185 },{ label:'Upright · 400L', watts:240 }] },
  { id: 'heater', name: 'Water heater', icon: '♨', watts: 3600, hours: 0.6, qty: 1, duty: 1, on: true, start: 7, end: 8, room: 'Bathroom', variant: 'Instant shower · no pump', variantLabel: 'Heater type', variants: [{ label:'Instant shower · no pump', watts:3600, duty:1 },{ label:'Instant shower · with pump', watts:3650, duty:1 },{ label:'Instant high-flow · 5.5 kW', watts:5500, duty:1 },{ label:'Storage tank · 20L', watts:2500, duty:.55 },{ label:'Storage tank · 30–90L', watts:3000, duty:.45 }], note: 'Instant heaters draw full power while water flows. Storage heaters cycle on and off; the estimate includes typical thermostat cycling.' },
  { id: 'washer', name: 'Washing machine', icon: '◉', watts: 500, hours: 0.75, qty: 1, duty: .65, on: true, start: 11, end: 12, room: 'Yard', variant: 'Top load · 8–10kg', variantLabel: 'Washer & cycle', variants: [{ label:'Top load · 8–10kg', watts:500, duty:.65 },{ label:'Top load · 11–14kg', watts:650, duty:.65 },{ label:'Front load · cold wash', watts:500, duty:.55 },{ label:'Front load · warm wash', watts:2000, duty:.28 },{ label:'Front load · steam/hot', watts:2200, duty:.32 }], note: 'Cold front-load cycles usually use less electricity; warm, steam and hot cycles use an internal heater and can use much more.' },
  { id: 'dryer', name: 'Clothes dryer', icon: '◍', watts: 2500, hours: 0.45, qty: 1, duty: 1, on: false, start: 12, room: 'Yard', variant: 'Vented · 8kg', variantLabel: 'Dryer type', variants: [{ label:'Heat pump · 8kg', watts:900 },{ label:'Condenser · 8kg', watts:2100 },{ label:'Vented · 8kg', watts:2500 }] },
  { id: 'tv', name: 'Television', icon: '▰', watts: 110, hours: 4.5, qty: 1, duty: 1, on: true, start: 19, room: 'Living', variant: '55 inch', stars: 5, variants: [{ label:'32 inch', watts:55 },{ label:'43 inch', watts:80 },{ label:'55 inch', watts:110 },{ label:'65 inch', watts:155 },{ label:'75 inch', watts:210 }] },
  { id: 'fan', name: 'Ceiling fan', icon: '✣', watts: 55, hours: 8, qty: 2, duty: 1, on: true, start: 14, end: 22, room: 'Living' },
  { id: 'standingfan', name: 'Standing fan', icon: '✤', watts: 58, hours: 8, qty: 1, duty: 1, on: false, start: 14, end: 22, room: 'Living', variant: '16-inch conventional', variantLabel: 'Fan type', variants: [{ label:'12-inch conventional', watts:39 },{ label:'16-inch conventional', watts:58 },{ label:'Energy-saving DC motor', watts:28 },{ label:'Large / industrial', watts:100 }], note: 'Fan speed changes the actual draw. These are typical inputs; use the wattage printed on your fan when available.' },
  { id: 'airpurifier', name: 'Air purifier', icon: '◎', watts: 11, hours: 24, qty: 1, duty: 1, on: false, start: 0, room: 'Living', variant: 'Auto / medium', variantLabel: 'Usual mode', variants: [{ label:'Sleep / low', watts:7 },{ label:'Auto / medium', watts:11 },{ label:'High', watts:49 },{ label:'Large room / high', watts:66 }], note: 'Auto mode changes fan speed with air quality, so the medium setting is a practical planning estimate.' },
  { id: 'massagechair', name: 'Massage chair', icon: '♨', watts: 180, hours: 0.19, qty: 1, duty: 1, on: false, start: 20, room: 'Living', variant: 'Full-body', variantLabel: 'Chair type', variants: [{ label:'Compact massage seat', watts:100 },{ label:'Full-body', watts:180 },{ label:'Full-body with heating', watts:260 }], note: 'Heating, recline motors and massage intensity can change the power used during a session.' },
  { id: 'lights', name: 'LED lights', icon: '●', watts: 9, hours: 6, qty: 9, duty: 1, on: true, start: 18, end: 24, room: 'Whole house' },
  { id: 'rice', name: 'Rice cooker', icon: '◒', watts: 700, hours: 1.1, qty: 1, duty: 0.62, on: true, start: 17.5, end: 19, room: 'Kitchen' },
  { id: 'microwave', name: 'Microwave', icon: '▣', watts: 1200, hours: 0.15, qty: 1, duty: 1, on: false, start: 12.5, room: 'Kitchen' },
  { id: 'oven', name: 'Electric oven', icon: '▦', watts: 2400, hours: 0.5, qty: 1, duty: 0.75, on: false, start: 18, room: 'Kitchen' },
  { id: 'induction', name: 'Induction cooker', icon: '◉', watts: 2000, hours: 0.75, qty: 1, duty: 0.65, on: false, start: 18, room: 'Kitchen', variant: 'Portable single hob', variantLabel: 'Cooker type', variants: [{ label:'Portable single hob', watts:2000 },{ label:'Built-in 2-zone · 2.8 kW', watts:2800 },{ label:'Built-in 2-zone · 3.5 kW', watts:3500 }], note: 'The selected wattage is the maximum input. Heat settings cycle or reduce power, so the estimate applies a typical cooking load.' },
  { id: 'airfryer', name: 'Air fryer', icon: '◒', watts: 1500, hours: 0.3, qty: 1, duty: 0.72, on: false, start: 18, room: 'Kitchen', variant: 'Medium · 4–6L', variantLabel: 'Fryer size', variants: [{ label:'Small · 2–3L', watts:1200 },{ label:'Medium · 4–6L', watts:1500 },{ label:'Large / dual basket', watts:2000 }], note: 'The heating element cycles around the selected temperature rather than drawing full power continuously.' },
  { id: 'hood', name: 'Cooker hood', icon: '≋', watts: 180, hours: 1, qty: 1, duty: 1, on: false, start: 18, room: 'Kitchen', note: 'Kitchen smoke and exhaust fan' },
  { id: 'iron', name: 'Clothes iron', icon: '◢', watts: 1000, hours: 0.35, qty: 1, duty: .65, on: false, start: 16, room: 'Yard', variant: 'Dry iron', variantLabel: 'Iron type', variants: [{ label:'Dry iron', watts:1000, duty:.65 },{ label:'Basic steam iron', watts:1400, duty:.65 },{ label:'Cordless steam iron', watts:1800, duty:.55 },{ label:'High-power steam iron', watts:2300, duty:.6 },{ label:'Steam generator', watts:2400, duty:.7 }], note: 'The wattage is peak heating input. The thermostat cycles, so the estimate uses a typical on/off heating pattern.' },
  { id: 'hairdryer', name: 'Hair dryer', icon: '≋', watts: 1500, hours: 0.17, qty: 1, duty: 1, on: false, start: 7.5, room: 'Bathroom', variant: 'Standard', variantLabel: 'Dryer type', variants: [{ label:'Compact / travel', watts:1000 },{ label:'Standard', watts:1500 },{ label:'High-power', watts:2000 }], note: 'Heat and speed settings affect the live wattage. The default represents normal heated use.' },
  { id: 'vacuum', name: 'Vacuum cleaner', icon: '⌁', watts: 1400, hours: 0.29, qty: 1, duty: 1, on: false, start: 10, room: 'Whole house', variant: 'Corded canister', variantLabel: 'Vacuum type', variants: [{ label:'Cordless stick · eco', watts:90 },{ label:'Cordless stick · high', watts:250 },{ label:'Corded compact', watts:850 },{ label:'Corded canister', watts:1400 },{ label:'Wet & dry', watts:1500 },{ label:'Robot vacuum', watts:45 }], note: 'Cordless values represent approximate battery power while cleaning. Small charging and standby losses are covered by the house background estimate.' },
  { id: 'router', name: 'Wi‑Fi router', icon: '⌁', watts: 12, hours: 24, qty: 1, duty: 1, on: true, awayOn: true, start: 0, end: 24, room: 'Study' },
  { id: 'pc', name: 'Desktop PC setup', icon: '▣', watts: 340, hours: 4, qty: 1, duty: 0.72, on: true, start: 9, end: 18, room: 'Study', variant: 'Medium · 1 monitor', variantLabel: 'Workload & screens', variants: [{ label:'Light · 1 monitor', watts:140 },{ label:'Light · 2 monitors', watts:180 },{ label:'Medium · 1 monitor', watts:340 },{ label:'Medium · 2 monitors', watts:380 },{ label:'Heavy · 1 monitor', watts:640 },{ label:'Heavy · 2 monitors', watts:680 }], note: 'Light: documents and browsing. Medium: coding, photo work or casual gaming. Heavy: demanding games, 3D or video rendering. Estimate includes the monitor(s).' },
  { id: 'laptop', name: 'Laptop computer', icon: '▱', watts: 65, hours: 6, qty: 1, duty: 0.65, on: false, start: 9, end: 18, room: 'Study', variant: 'Everyday laptop', variantLabel: 'Laptop type', variants: [{ label:'Light / compact', watts:45 },{ label:'Everyday laptop', watts:65 },{ label:'Performance laptop', watts:100 },{ label:'Gaming / workstation', watts:200 }], note: 'The charger rating is a safe maximum. Normal work usually draws less as the battery fills, so the estimate applies a typical operating load.' },
  { id: 'kettle', name: 'Kettle', icon: '◓', watts: 1800, hours: 0.2, qty: 1, duty: 1, on: true, start: 7, end: 7.3, room: 'Kitchen' },
  { id: 'ev', name: 'Home EV charging', icon: '⚡', watts: 7400, hours: 1.5, qty: 1, duty: 1, on: false, start: 0, room: 'Car porch', variant: 'Wallbox · 7.4 kW', variantLabel: 'Charger type', variants: [{ label:'Portable plug · 2.3 kW', watts:2300 },{ label:'Wallbox · 3.7 kW', watts:3700 },{ label:'Wallbox · 7.4 kW', watts:7400 },{ label:'3-phase · 11 kW', watts:11000 }], note: 'Adds to your home bill when charged at home' },
  { id: 'standby', name: 'Standby load', icon: '◌', watts: 32, hours: 24, qty: 1, duty: 1, on: true, awayOn: true, start: 0, end: 24, room: 'Whole house' }
];

const applianceCategories = [
  { name:'Always running', ids:['fridge','waterpurifier','freezer','router','standby'] },
  { name:'Cooling & air quality', ids:['aircon','fan','standingfan','airpurifier'] },
  { name:'Kitchen', ids:['rice','microwave','oven','induction','airfryer','hood','kettle'] },
  { name:'Laundry, cleaning & bathroom', ids:['heater','washer','dryer','iron','hairdryer','vacuum'] },
  { name:'Entertainment, comfort & work', ids:['tv','lights','massagechair','pc','laptop'] },
  { name:'Transport', ids:['ev'] }
];
defaults.forEach(a => a.included = Boolean(a.alwaysOn || a.on));

const usageProfiles = {
  heater: { usageMode:'uses-per-day', usesPerDay:2, minutesPerUse:18 },
  washer: { usageMode:'cycles-per-week', usesPerWeek:7, minutesPerUse:45, usageNoun:'loads' },
  dryer: { usageMode:'cycles-per-week', usesPerWeek:3, minutesPerUse:63, usageNoun:'loads' },
  microwave: { usageMode:'cycles-per-week', usesPerWeek:7, minutesPerUse:9, usageNoun:'uses' },
  oven: { usageMode:'cycles-per-week', usesPerWeek:3, minutesPerUse:70, usageNoun:'sessions' },
  hood: { usageMode:'cycles-per-week', usesPerWeek:7, minutesPerUse:60, usageNoun:'sessions' },
  iron: { usageMode:'cycles-per-week', usesPerWeek:2, minutesPerUse:74, usageNoun:'sessions' },
  massagechair: { usageMode:'cycles-per-week', usesPerWeek:4, minutesPerUse:20, usageNoun:'sessions' },
  hairdryer: { usageMode:'cycles-per-week', usesPerWeek:7, minutesPerUse:10, usageNoun:'uses' },
  vacuum: { usageMode:'cycles-per-week', usesPerWeek:4, minutesPerUse:30, usageNoun:'sessions' },
  rice: { usageMode:'cycles-per-week', usesPerWeek:7, minutesPerUse:66, usageNoun:'cooks' },
  induction: { usageMode:'cycles-per-week', usesPerWeek:7, minutesPerUse:45, usageNoun:'cooks' },
  airfryer: { usageMode:'cycles-per-week', usesPerWeek:5, minutesPerUse:25, usageNoun:'cooks' },
  kettle: { usageMode:'cycles-per-week', usesPerWeek:14, minutesPerUse:6, usageNoun:'boils' },
  ev: { usageMode:'ev-distance', kmPerMonth:1500, kwhPer100km:18, chargingEfficiency:.9 }
};
defaults.forEach(a => Object.assign(a, usageProfiles[a.id] || { daysPerWeek:7 }));

let appliances = structuredClone(defaults);
let afaRate = defaultAfa;
let touEnabled = false;
let baselineBill = null;
let simMinute = 420;
let playing = false;
let simSpeed = 1;
let daysAtHome = 30;
let simDay = 0;
let runKwh = 0;
let runPeakKwh = 0;
let runOffpeakKwh = 0;
let runApplianceKwh = {};
let runComplete = false;
let lastFrame = performance.now();
let lastRankingRender = 0;

const $ = (selector) => document.querySelector(selector);
const grid = $('#applianceGrid');
const catalogGroups = $('#catalogGroups');
const currency = (n) => `RM ${Math.abs(n).toFixed(2)}`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function selectVariant(a, label) {
  const variant = a.variants?.find(v => v.label === label);
  if (!variant) return false;
  a.variant = label;
  if (variant.duty !== undefined) a.duty = variant.duty;
  return true;
}
function selectSecondaryVariant(a, label) {
  const variant = a.secondaryVariants?.find(v => v.label === label);
  if (!variant) return false;
  a.secondaryVariant = label;
  if (variant.duty !== undefined) a.duty = variant.duty;
  return true;
}
function formatHours(hours) {
  if (hours < 1) return hours.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

defaults.forEach(syncUsageHours);
function applianceEnergyForDays(a, requestedDays = null, includeWhenOff = false) {
  return modelApplianceEnergyForDays(a, { daysAtHome, daysPerMonth }, requestedDays, includeWhenOff);
}
function monthlyKwh() { return modelMonthlyKwh(appliances, { daysAtHome, daysPerMonth }); }
function touEnergySplit(kwhOverride = null) {
  return modelTouEnergySplit(appliances, { daysAtHome, daysPerMonth, representativeWeekdays }, kwhOverride);
}
function calculateBill(kwh = monthlyKwh(), useTou = touEnabled, splitOverride = null) {
  const split = splitOverride || touEnergySplit(kwh);
  return modelCalculateBill({ kwh, useTou, split, afaRate });
}

function applianceKwh(a) { return applianceEnergyForDays(a); }
function holidayBackgroundKwh() {
  const holidayDays = daysPerMonth - daysAtHome;
  return appliances.reduce((sum, a) => sum + (a.on && a.awayOn ? applianceEnergyForDays(a, holidayDays) : 0), 0);
}
function updateUsageMeter(kwh) {
  const display = $('#usageMeterDigits');
  const formatted = Math.min(999999.99, Math.max(0, Number(kwh) || 0)).toFixed(2).padStart(9, '0');
  if (!display.childElementCount) {
    display.innerHTML = [...formatted].map(character => character === '.'
      ? '<span class="usage-meter-decimal" aria-hidden="true">.</span>'
      : `<span class="usage-meter-digit" aria-hidden="true"><span class="usage-meter-wheel">${Array.from({ length:10 }, (_, digit) => `<i>${digit}</i>`).join('')}</span></span>`
    ).join('');
  }
  const digits = formatted.replace('.', '');
  display.querySelectorAll('.usage-meter-wheel').forEach((wheel, index) => wheel.style.setProperty('--digit', digits[index]));
  display.setAttribute('aria-label', `${Number(kwh || 0).toFixed(2)} kilowatt-hours`);
}
function renderEnergyRanking(force = false) {
  const now = performance.now();
  if (!force && now - lastRankingRender < 120) return;
  lastRankingRender = now;
  const entries = appliances
    .filter(appliance => appliance.included !== false && appliance.on)
    .map((appliance, index) => ({
      appliance,
      index,
      kwh: runComplete ? applianceEnergyForDays(appliance) : (runApplianceKwh[appliance.id] || 0)
    }))
    .sort((left, right) => right.kwh - left.kwh || left.index - right.index);
  const leaderKwh = entries[0]?.kwh || 0;
  const rankedKwh = entries.reduce((sum, entry) => sum + entry.kwh, 0);
  const runningBill = calculateBill(runComplete ? monthlyKwh() : runKwh, touEnabled, runComplete ? null : { peakKwh:runPeakKwh, offpeakKwh:runOffpeakKwh });
  $('#rankingCaption').textContent = runComplete ? 'Final breakdown' : playing ? 'Updating live' : runKwh > 0 ? 'Paused' : 'Ready to measure';
  $('#energyRanking').innerHTML = entries.length ? entries.map(({ appliance, kwh }, rank) => {
    const billShare = runningBill.total * (rankedKwh ? kwh / rankedKwh : 0);
    const active = !runComplete && isActiveAtTime(appliance);
    return `<li class="rank-${rank + 1} ${active ? 'currently-running' : ''}">
      <i class="rank-fill" style="--usage:${leaderKwh ? Math.max(2, kwh / leaderKwh * 100) : 0}%"></i>
      <span class="rank-overlay">
        <b>${escapeHtml(appliance.name)}</b>
        <span><strong>${kwh.toFixed(kwh < 10 ? 2 : 1)} kWh</strong><small>${currency(billShare)} share</small></span>
      </span>
    </li>`;
  }).join('') : '<li class="ranking-empty">Switch on an appliance to measure it.</li>';
}
function updateSimulationPanel() {
  const holidayDays = daysPerMonth - daysAtHome;
  const shownKwh = runComplete ? monthlyKwh() : runKwh;
  const progress = runComplete ? 1 : (simDay ? Math.min(1, ((simDay - 1) + simMinute / 1440) / daysAtHome) : 0);
  $('#runDay').textContent = runComplete ? daysAtHome : simDay;
  $('#runTarget').textContent = daysAtHome;
  $('#runProgress').style.width = `${progress * 100}%`;
  $('#runKwh').textContent = `${shownKwh.toFixed(1)} kWh`;
  updateUsageMeter(shownKwh);
  const runningSplit = runComplete ? null : { peakKwh:runPeakKwh, offpeakKwh:runOffpeakKwh };
  $('#runBill').textContent = currency(calculateBill(shownKwh, touEnabled, runningSplit).total);
  $('#runState').textContent = daysAtHome === 0 ? 'HOLIDAY' : runComplete ? 'COMPLETE' : playing ? 'RUNNING' : 'READY';
  $('#shareResult').hidden = !runComplete || daysAtHome === 0;
  $('#homeDaysValue').textContent = daysAtHome;
  $('#holidayNote').textContent = holidayDays ? `${holidayDays} holiday day${holidayDays === 1 ? '' : 's'}: fridge, freezer, water purifier, router and background loads continue if left on.` : 'No holiday days in this billing month.';
  renderEnergyRanking(runComplete || !playing);
}
function resetSimulation(resetClock = true) {
  playing = false;
  simDay = 0;
  runKwh = 0;
  runPeakKwh = 0;
  runOffpeakKwh = 0;
  runApplianceKwh = {};
  runComplete = daysAtHome === 0;
  $('#playButton').setAttribute('aria-pressed', 'false');
  $('#playButton').disabled = daysAtHome === 0;
  $('#playButton').innerHTML = daysAtHome === 0 ? '<span>⌂</span> Background only' : '<span>▶</span> Run simulation';
  if (resetClock) setTime(0);
  updateSimulationPanel();
}

function timeInputValue(decimalHour = 0) {
  const minutes = Math.round((((decimalHour % 24) + 24) % 24) * 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
}
function renderUsageControl(a) {
  if (a.usageMode === 'cycles-per-week') return `<div class="usage-pair">
    <label class="usage-field"><span>${a.usageNoun || 'uses'} / week</span><input type="number" min="0" max="50" step="1" value="${a.usesPerWeek}" data-action="usage-value" data-field="usesPerWeek" data-id="${a.id}"></label>
    <label class="usage-field"><span>Minutes / ${a.usageNoun === 'loads' ? 'load' : 'use'}</span><input type="number" min="1" max="360" step="1" value="${a.minutesPerUse}" data-action="usage-value" data-field="minutesPerUse" data-id="${a.id}"></label>
  </div>`;
  if (a.usageMode === 'uses-per-day') return `<div class="usage-pair">
    <label class="usage-field"><span>Showers / day</span><input type="number" min="0" max="20" step="1" value="${a.usesPerDay}" data-action="usage-value" data-field="usesPerDay" data-id="${a.id}"></label>
    <label class="usage-field"><span>Minutes / shower</span><input type="number" min="1" max="60" step="1" value="${a.minutesPerUse}" data-action="usage-value" data-field="minutesPerUse" data-id="${a.id}"></label>
  </div>`;
  if (a.usageMode === 'ev-distance') return `<div class="usage-pair">
    <label class="usage-field"><span>Driving / month (km)</span><input type="number" min="0" max="10000" step="50" value="${a.kmPerMonth}" data-action="usage-value" data-field="kmPerMonth" data-id="${a.id}"></label>
    <label class="usage-field"><span>kWh / 100 km</span><input type="number" min="8" max="40" step=".5" value="${a.kwhPer100km}" data-action="usage-value" data-field="kwhPer100km" data-id="${a.id}"></label>
  </div>`;
  return `<div class="hours-control">
    <label for="hours-${a.id}"><span>Hours / active day</span><b>${formatHours(a.hours)}h</b></label>
    <input id="hours-${a.id}" data-action="hours" data-id="${a.id}" type="range" min="0" max="24" step="0.05" value="${a.hours}" ${a.on && !a.alwaysOn ? '' : 'disabled'}>
  </div>`;
}
function renderPlanningDetails(a) {
  const scheduled = !a.alwaysOn && a.hours < 23.9;
  const weekly = !a.usageMode && scheduled;
  const isAircon = (a.templateId || a.id) === 'aircon';
  return `<details class="planning-details">
    <summary>Add more details</summary>
    <div class="planning-grid">
      ${scheduled ? `<label class="planning-field"><span>Typical start</span><input type="time" value="${timeInputValue(a.start)}" data-action="start-time" data-id="${a.id}"></label>` : ''}
      ${weekly ? `<label class="planning-field"><span>Days used / week</span><input type="number" min="1" max="7" step="1" value="${a.daysPerWeek || 7}" data-action="usage-value" data-field="daysPerWeek" data-id="${a.id}"></label>` : ''}
      ${isAircon ? `<label class="planning-field"><span>Room floor area (sq ft)</span><input type="number" min="50" max="2000" step="1" value="${a.roomAreaSqFt || 237}" data-action="usage-value" data-field="roomAreaSqFt" data-id="${a.id}"></label><label class="planning-field"><span>Thermostat °C</span><input type="number" min="16" max="30" step="1" value="${a.setpoint || 24}" data-action="usage-value" data-field="setpoint" data-id="${a.id}"></label><p class="planning-help">Floor area = room length × room width.</p>` : ''}
      <label class="planning-field"><span>My label watts</span><input type="number" min="0" max="30000" step="1" value="${a.customWatts || ''}" placeholder="Optional" data-action="custom-watts" data-id="${a.id}" aria-label="${a.name} label watts"></label>
      <label class="planning-field"><span>My label kWh/year</span><input type="number" min="0" max="50000" step="1" value="${a.customAnnualKwh || ''}" placeholder="Optional" data-action="custom-annual" data-id="${a.id}" aria-label="${a.name} label kWh per year"></label>
      <p class="planning-help">Use these only when they appear on your product. Annual kWh replaces the monthly estimate; label watts replaces the estimated wattage and live kW.</p>
    </div>
    ${a.alwaysOn ? '' : `<div class="planning-actions"><button type="button" data-action="duplicate" data-id="${a.id}">Add separate unit</button></div>`}
  </details>`;
}
function applianceSummaryText(a) {
  const estimatedWatts = wattsFor(a);
  const monthly = applianceEnergyForDays(a, null, true);
  return `${[a.variant, a.secondaryVariant].filter(Boolean).join(' · ')}${a.variant || a.secondaryVariant ? ' · ' : ''}${estimatedWatts.toLocaleString()} W · ${a.on ? '' : 'OFF · '}≈${monthly.toFixed(monthly < 10 ? 1 : 0)} kWh/mo`;
}
function refreshApplianceSummary(a) {
  const summary = grid.querySelector(`[data-card="${a.id}"] .appliance-name small`);
  if (summary) summary.textContent = applianceSummaryText(a);
}

function renderAppliances() {
  grid.innerHTML = appliances.filter(a => a.included !== false).map(a => {
    const estimatedWatts = wattsFor(a);
    const usageControl = renderUsageControl(a);
    const ratingControl = a.stars ? `
        <div class="rating-control">
          <span>Energy rating</span>
          <div class="stars" role="group" aria-label="${a.name} energy star rating">
            ${[1,2,3,4,5].map(star => `<button class="star-button ${star <= a.stars ? 'filled' : ''}" type="button" data-action="stars" data-id="${a.id}" data-stars="${star}" aria-label="Set ${star} star rating" aria-pressed="${star === a.stars}">★</button>`).join('')}
          </div>
        </div>` : '';
    const secondaryControl = a.secondaryVariants ? `
        <div class="variant-control">
          <label for="secondary-variant-${a.id}">${a.secondaryVariantLabel || 'Type'}</label>
          <select id="secondary-variant-${a.id}" data-action="secondary-variant" data-id="${a.id}" aria-label="${a.name} ${a.secondaryVariantLabel || 'type'}">
            ${a.secondaryVariants.map(v => `<option value="${v.label}" ${v.label === a.secondaryVariant ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>` : '';
    const shoppingOptions = a.variants ? `
      <div class="product-options ${a.stars ? '' : 'single-option'} ${a.secondaryVariants ? 'has-secondary' : ''}">
        <div class="variant-control">
          <label for="variant-${a.id}">${a.variantLabel || ((a.templateId || a.id) === 'aircon' ? 'Cooling size' : 'Screen size')}</label>
          <select id="variant-${a.id}" data-action="variant" data-id="${a.id}" aria-label="${a.name} size">
            ${a.variants.map(v => `<option value="${v.label}" ${v.label === a.variant ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        ${secondaryControl}
        ${ratingControl}
        <p class="watt-explain">${a.secondaryVariants ? 'Estimated rated input' : 'Estimated input'}: <b>${estimatedWatts.toLocaleString()} W</b>${a.secondaryVariants ? `. Modelled average compressor load while cooling: <b>${Math.round(operatingFactor(a) * 100)}%</b>` : ''}${a.stars ? '. Star impact is an educational estimate; check the product energy label for its tested kWh.' : '.'}</p>
      </div>` : '';
    return `
    <article class="appliance-card ${a.on ? 'on' : ''} ${a.alwaysOn ? 'always-on' : ''}" data-card="${a.id}">
      <div class="appliance-top">
        <span class="appliance-icon" aria-hidden="true">${a.icon}</span>
        <div class="appliance-name"><b>${a.name}</b><small>${applianceSummaryText(a)}</small></div>
        ${a.alwaysOn ? '<span class="always-badge">BASE</span>' : `<div class="card-actions"><button class="remove-appliance" type="button" data-action="remove-home" data-id="${a.id}" aria-label="Remove ${a.name} from my home" title="Remove from my home">−</button><button class="switch" type="button" data-action="toggle" data-id="${a.id}" aria-label="${a.on ? 'Switch off' : 'Switch on'} ${a.name}" aria-pressed="${a.on}"></button></div>`}
      </div>
      <div class="appliance-controls">
        ${usageControl}
        ${a.alwaysOn ? '' : `<div class="qty-control" aria-label="Quantity">
          <button type="button" data-action="qty-down" data-id="${a.id}" aria-label="Reduce ${a.name} quantity">−</button>
          <span>${a.qty}</span>
          <button type="button" data-action="qty-up" data-id="${a.id}" aria-label="Increase ${a.name} quantity">+</button>
        </div>`}
      </div>
      ${a.note ? `<p class="appliance-note">${a.note}</p>` : ''}
      ${shoppingOptions}
      ${renderPlanningDetails(a)}
    </article>`;
  }).join('');
  renderCatalog();
}

function renderCatalog() {
  const hidden = appliances.filter(a => !a.templateId && !a.alwaysOn && a.included === false);
  const included = appliances.filter(a => a.included !== false).length;
  $('#includedCount').textContent = `${included} appliance${included === 1 ? '' : 's'} in your home`;
  $('#availableCount').textContent = hidden.length ? `(${hidden.length})` : '';
  if (!hidden.length) {
    catalogGroups.innerHTML = '<p class="catalog-empty">Every available appliance is already in your home.</p>';
    return;
  }
  catalogGroups.innerHTML = applianceCategories.map(category => {
    const items = hidden.filter(a => category.ids.includes(a.id));
    if (!items.length) return '';
    return `<section class="catalog-group"><h3>${category.name}</h3><div class="catalog-list">${items.map(a => `
      <article class="catalog-item">
        <span aria-hidden="true">${a.icon}</span>
        <div><b>${a.name}</b><small>${[a.variant, a.secondaryVariant].filter(Boolean).join(' · ') || `${wattsFor(a).toLocaleString()} W`}</small></div>
        <button type="button" data-add-appliance="${a.id}" aria-label="Add ${a.name} to my home">＋</button>
      </article>`).join('')}</div></section>`;
  }).join('');
}

function addBillLine(label, sub, value, rebate = false) {
  return `<div class="bill-line ${rebate ? 'rebate' : ''}"><dt>${label}<span>${sub}</span></dt><dd>${rebate ? '−' : ''}${currency(value)}</dd></div>`;
}

function updateBill(announce = false) {
  const b = calculateBill();
  if (baselineBill === null) baselineBill = b.total;
  $('#billTotal').textContent = b.total.toFixed(2);
  $('#billTotalBottom').textContent = currency(b.total);
  $('#mobileBillTotal').textContent = currency(b.total);
  $('#mobileKwhTotal').textContent = `${Math.round(b.kwh).toLocaleString()} kWh`;
  $('#mobilePlanName').textContent = b.useTou ? 'ToU' : 'General';
  $('#billPlanName').textContent = b.useTou ? 'Domestic ToU · RP4' : 'Domestic General · RP4';
  $('#kwhTotal').textContent = Math.round(b.kwh).toLocaleString();
  $('#meterFill').style.width = `${Math.min(100, b.kwh / 1200 * 100)}%`;
  const badge = $('#protectionBadge');
  badge.textContent = b.protectedUser ? 'Protected ≤800 kWh' : 'Above protection';
  badge.classList.toggle('warn', !b.protectedUser);
  const diff = b.total - baselineBill;
  $('#billDelta').textContent = Math.abs(diff) < .01 ? 'Your starting household estimate' : `${diff < 0 ? '↓' : '↑'} ${currency(diff)} ${diff < 0 ? 'saved' : 'more'} from your starting setup`;

  const touToggle = $('#touToggle');
  touToggle.classList.toggle('active', b.useTou);
  touToggle.setAttribute('aria-checked', String(b.useTou));
  touToggle.querySelector('b').textContent = b.useTou ? 'On' : 'Off';
  $('#touPeakKwh').textContent = `${b.peakKwh.toFixed(1)} kWh`;
  $('#touOffpeakKwh').textContent = `${b.offpeakKwh.toFixed(1)} kWh`;
  $('#touPeakRate').textContent = (b.peakRate * 100).toFixed(2);
  $('#touOffpeakRate').textContent = (b.offpeakRate * 100).toFixed(2);
  const alternateBill = calculateBill(b.kwh, !b.useTou);
  const touDifference = (b.useTou ? b.total : alternateBill.total) - (b.useTou ? alternateBill.total : b.total);
  const touCopy = Math.abs(touDifference) < .01
    ? 'Your current schedule costs about the same on General and ToU.'
    : touDifference < 0
      ? `Your schedule is estimated to save ${currency(Math.abs(touDifference))} per month with ToU.`
      : `Your schedule is estimated to cost ${currency(touDifference)} more per month with ToU.`;
  $('#touResult').textContent = b.useTou ? `${touCopy} ToU rates are active in this estimate.` : `${touCopy} Turn on ToU to use those rates.`;

  const eeRate = incentiveRate(b.kwh) * 100;
  $('#billLines').innerHTML = [
    ...(b.useTou ? [
      addBillLine('Peak energy charge', `${(b.peakRate*100).toFixed(2)} sen × ${b.peakKwh.toFixed(1)} kWh`, b.peakKwh * b.peakRate),
      addBillLine('Off-peak energy charge', `${(b.offpeakRate*100).toFixed(2)} sen × ${b.offpeakKwh.toFixed(1)} kWh`, b.offpeakKwh * b.offpeakRate)
    ] : [addBillLine('Energy charge', `${(b.generalRate*100).toFixed(2)} sen × ${b.kwh.toFixed(1)} kWh`, b.energy)]),
    addBillLine('Capacity charge', `4.55 sen × ${b.kwh.toFixed(1)} kWh`, b.capacity),
    addBillLine('Network charge', `12.85 sen × ${b.kwh.toFixed(1)} kWh`, b.network),
    addBillLine('Energy Efficiency Incentive', eeRate ? `${eeRate.toFixed(2)} sen rebate on all kWh` : 'Not available above 1,000 kWh', b.incentive, true),
    addBillLine('Automatic Fuel Adjustment', b.protectedUser ? `Exempt under current ${protectionThreshold} kWh protection` : `${afaRate >= 0 ? '+' : ''}${afaRate.toFixed(2)} sen × ${b.kwh.toFixed(1)} kWh`, Math.abs(b.afa), b.afa < 0),
    addBillLine('Retail charge', b.protectedUser ? 'Exempt under current protection' : 'Fixed monthly charge', b.retail),
    addBillLine('Renewable Energy Fund', b.kwh <= 300 ? 'Exempt at 300 kWh and below' : '1.6% of eligible usage charges', b.kwtbb),
    addBillLine('Service tax', b.protectedUser ? 'Exempt under current protection' : '8% on estimated taxable portion', b.sst)
  ].join('');

  const score = Math.max(8, Math.round(100 - Math.max(0, b.kwh - 250) * .085 - Math.max(0, b.total - 120) * .045));
  $('#scoreValue').textContent = score;
  $('#scoreRing').style.setProperty('--score', `${score * 3.6}deg`);
  $('#scoreTitle').textContent = score >= 80 ? 'Efficient household' : score >= 60 ? 'Good, with room to trim' : score >= 40 ? 'High-use household' : 'Energy intensive';
  $('#scoreCopy').textContent = b.protectedUser ? `${Math.max(0, protectionThreshold - b.kwh).toFixed(0)} kWh of headroom before AFA, retail and SST protection ends.` : `${(b.kwh - protectionThreshold).toFixed(0)} kWh above the current protection line.`;

  const ranked = appliances.filter(a => a.included !== false && a.on && !a.alwaysOn).sort((a,c) => applianceKwh(c) - applianceKwh(a));
  const top = ranked[0];
  if (top) {
    const oneHour = (wattsFor(top) / 1000) * top.qty * operatingFactor(top) * daysPerMonth;
    $('#coachTitle').textContent = `Trim ${top.name.toLowerCase()} by one hour`;
    $('#coachCopy').textContent = `Your biggest load uses about ${applianceKwh(top).toFixed(0)} kWh/month. One hour less per day removes roughly ${oneHour.toFixed(0)} kWh before tariff effects.`;
  } else {
    $('#coachTitle').textContent = 'Only the connected-home baseline remains';
    $('#coachCopy').textContent = 'The always-on house idle load is the only remaining estimated usage.';
  }
  updateScenarioComparison(b);
  updateCalibration(b);
  updateLiveLoad();
  if (announce) $('#billTotal').setAttribute('aria-label', `Estimated bill ${currency(b.total)}`);
}

function mutateAppliance(id, mutator) {
  const a = appliances.find(item => item.id === id);
  if (!a) return;
  mutator(a);
  resetSimulation(false);
  renderAppliances();
  updateBill(true);
}
function duplicateAppliance(id) {
  const index = appliances.findIndex(item => item.id === id);
  if (index < 0) return;
  const source = appliances[index];
  const templateId = source.templateId || source.id;
  const baseName = defaults.find(item => item.id === templateId)?.name || source.name.replace(/ \d+$/, '');
  const siblingCount = appliances.filter(item => item.id === templateId || item.templateId === templateId).length;
  const copy = structuredClone(source);
  copy.id = `${templateId}-copy-${Date.now().toString(36)}`;
  copy.templateId = templateId;
  copy.name = `${baseName} ${siblingCount + 1}`;
  copy.qty = 1;
  copy.included = true;
  appliances.splice(index + 1, 0, copy);
  resetSimulation(false); renderAppliances(); updateBill(true);
}
function removeApplianceFromHome(id) {
  const index = appliances.findIndex(item => item.id === id && !item.alwaysOn);
  if (index < 0) return;
  const appliance = appliances[index];
  if (appliance.templateId) appliances.splice(index, 1);
  else {
    appliance.onBeforeRemoval = appliance.on;
    appliance.on = false;
    appliance.included = false;
  }
  resetSimulation(false); renderAppliances(); updateBill(true);
}
function addApplianceToHome(id) {
  const appliance = appliances.find(item => item.id === id && !item.templateId);
  if (!appliance) return;
  appliance.included = true;
  appliance.on = appliance.onBeforeRemoval ?? true;
  delete appliance.onBeforeRemoval;
  resetSimulation(false); renderAppliances(); updateBill(true);
}

grid.addEventListener('input', (event) => {
  const id = event.target.dataset.id;
  if (event.target.dataset.action === 'hours') {
    const a = appliances.find(item => item.id === id); if (!a) return;
    a.hours = Number(event.target.value);
    const value = event.target.closest('.hours-control')?.querySelector('b');
    if (value) value.textContent = `${formatHours(a.hours)}h`;
    resetSimulation(false); updateBill(true); refreshApplianceSummary(a);
  }
  if (event.target.dataset.action === 'usage-value') {
    const a = appliances.find(item => item.id === id); if (!a) return;
    a[event.target.dataset.field] = Number(event.target.value); syncUsageHours(a); resetSimulation(false); updateBill(true); refreshApplianceSummary(a);
  }
  if (event.target.dataset.action === 'custom-watts' || event.target.dataset.action === 'custom-annual') {
    const a = appliances.find(item => item.id === id); if (!a) return;
    const key = event.target.dataset.action === 'custom-watts' ? 'customWatts' : 'customAnnualKwh';
    a[key] = Math.max(0, Number(event.target.value) || 0);
    syncUsageHours(a); resetSimulation(false); updateBill(true); refreshApplianceSummary(a);
  }
});
grid.addEventListener('change', (event) => {
  const id = event.target.dataset.id;
  if (event.target.dataset.action === 'variant') mutateAppliance(id, a => selectVariant(a, event.target.value));
  if (event.target.dataset.action === 'secondary-variant') mutateAppliance(id, a => selectSecondaryVariant(a, event.target.value));
  if (event.target.dataset.action === 'usage-value') mutateAppliance(id, a => { a[event.target.dataset.field] = Number(event.target.value); syncUsageHours(a); });
  if (event.target.dataset.action === 'start-time') mutateAppliance(id, a => { const [h,m] = event.target.value.split(':').map(Number); a.start = h + m / 60; });
});
grid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'toggle') mutateAppliance(id, a => a.on = !a.on);
  if (action === 'qty-up') mutateAppliance(id, a => a.qty = Math.min(a.id === 'lights' ? 24 : 6, a.qty + 1));
  if (action === 'qty-down') mutateAppliance(id, a => a.qty = Math.max(1, a.qty - 1));
  if (action === 'stars') mutateAppliance(id, a => a.stars = Number(button.dataset.stars));
  if (action === 'duplicate') duplicateAppliance(id);
  if (action === 'remove-home') removeApplianceFromHome(id);
});

$('#addApplianceButton').addEventListener('click', () => { renderCatalog(); $('#applianceDialog').showModal(); });
$('#closeApplianceDialog').addEventListener('click', () => $('#applianceDialog').close());
$('#applianceDialog').addEventListener('click', event => { if (event.target === $('#applianceDialog')) $('#applianceDialog').close(); });
catalogGroups.addEventListener('click', event => {
  const button = event.target.closest('[data-add-appliance]');
  if (button) addApplianceToHome(button.dataset.addAppliance);
});
$('#mobileBillBar').addEventListener('click', () => $('#billPanel').scrollIntoView({ behavior:'smooth', block:'start' }));

const estimateNoticeKey = 'mywatt-estimate-notice-v1';
const estimateNotice = $('#estimateNotice');
function rememberEstimateNotice() {
  try { localStorage.setItem(estimateNoticeKey, 'seen'); } catch {}
}
$('#startPlanning').addEventListener('click', () => { rememberEstimateNotice(); estimateNotice.close(); });
estimateNotice.addEventListener('cancel', rememberEstimateNotice);
try {
  if (localStorage.getItem(estimateNoticeKey) !== 'seen') estimateNotice.showModal();
} catch { estimateNotice.showModal(); }

const presets = {
  careful: { aircon:[5,1], heater:[.35,1], fan:[7,1], lights:[4,7], tv:[2.5,1], pc:[2,1] },
  wfh: { aircon:[9,1], heater:[.6,1], fan:[10,2], lights:[6,9], tv:[4,1], pc:[9,1] },
  hot: { aircon:[13,2], heater:[.7,1], fan:[12,3], lights:[6,10], tv:[5,1], pc:[5,1] }
};
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  appliances = structuredClone(defaults);
  const config = presets[button.dataset.preset];
  Object.entries(config).forEach(([id,[hours,qty]]) => { const a = appliances.find(x => x.id === id); a.hours = hours; a.qty = qty; if (a.usageMode === 'uses-per-day') a.minutesPerUse = hours * 60 / Math.max(1, a.usesPerDay); });
  resetSimulation(); renderAppliances(); updateBill(true);
}));

const scenarioStorageKey = 'rumahwatt-scenarios-v1';
function readScenarios() {
  try { const saved = JSON.parse(localStorage.getItem(scenarioStorageKey) || '[]'); return Array.isArray(saved) ? saved : []; }
  catch { return []; }
}
function writeScenarios(items) { localStorage.setItem(scenarioStorageKey, JSON.stringify(items.slice(-12))); }
function refreshScenarioSelect(selectedId = '') {
  const select = $('#scenarioSelect');
  const scenarios = readScenarios();
  select.innerHTML = '<option value="">No saved scenario</option>' + scenarios.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
  const hasSelection = Boolean(select.value);
  $('#scenarioLoad').disabled = !hasSelection;
  $('#scenarioDelete').disabled = !hasSelection;
  updateScenarioComparison(calculateBill());
}
function updateScenarioComparison(currentBill = calculateBill()) {
  const selected = readScenarios().find(s => s.id === $('#scenarioSelect')?.value);
  const output = $('#scenarioComparison');
  if (!output) return;
  if (!selected) { output.textContent = ''; output.hidden = true; return; }
  const kwhDifference = currentBill.kwh - selected.kwh;
  const billDifference = currentBill.total - selected.bill;
  output.hidden = false;
  output.textContent = `Compared with ${selected.name}: ${kwhDifference >= 0 ? '+' : '−'}${Math.abs(kwhDifference).toFixed(1)} kWh and ${billDifference >= 0 ? '+' : '−'}RM ${Math.abs(billDifference).toFixed(2)} per month.`;
}
$('#scenarioSave').addEventListener('click', () => {
  const name = $('#scenarioName').value.trim() || `Scenario ${readScenarios().length + 1}`;
  const bill = calculateBill();
  const scenarios = readScenarios();
  const saved = { id:`scenario-${Date.now()}`, name, appliances:structuredClone(appliances), afaRate, touEnabled, daysAtHome, kwh:bill.kwh, bill:bill.total };
  scenarios.push(saved); writeScenarios(scenarios); $('#scenarioName').value = ''; refreshScenarioSelect(saved.id);
});
$('#scenarioSelect').addEventListener('change', () => refreshScenarioSelect($('#scenarioSelect').value));
$('#scenarioLoad').addEventListener('click', () => {
  const saved = readScenarios().find(s => s.id === $('#scenarioSelect').value); if (!saved) return;
  appliances = Array.isArray(saved.appliances) ? structuredClone(saved.appliances) : structuredClone(defaults);
  defaults.forEach(defaultAppliance => {
    if (!appliances.some(appliance => appliance.id === defaultAppliance.id)) appliances.push(structuredClone(defaultAppliance));
  });
  appliances.forEach(a => {
    if (a.included === undefined) a.included = true;
    if ((a.templateId || a.id) === 'aircon' && !a.roomAreaSqFt) a.roomAreaSqFt = Math.round((Number(a.roomSize) || 22) * 10.7639);
    delete a.roomSize;
    syncUsageHours(a);
  });
  afaRate = Number.isFinite(saved.afaRate) ? Math.min(10, Math.max(-10, saved.afaRate)) : defaultAfa;
  touEnabled = Boolean(saved.touEnabled);
  daysAtHome = Number.isFinite(saved.daysAtHome) ? Math.min(daysPerMonth, Math.max(0, saved.daysAtHome)) : daysPerMonth;
  $('#homeDays').value = daysAtHome; $('#afaSlider').value = afaRate; resetSimulation(); renderAppliances(); updateAfaLabel(); updateBill(true);
});
$('#scenarioDelete').addEventListener('click', () => {
  const id = $('#scenarioSelect').value; if (!id) return;
  writeScenarios(readScenarios().filter(s => s.id !== id)); refreshScenarioSelect();
});

function updateCalibration(currentBill = calculateBill()) {
  const actualKwh = Number($('#actualKwh')?.value);
  const actualBill = Number($('#actualBill')?.value);
  const actualDays = Math.max(1, Number($('#actualDays')?.value) || 30);
  const output = $('#calibrationResult'); if (!output) return;
  if (!(actualKwh > 0) && !(actualBill > 0)) { output.textContent = 'Enter a real bill to see how closely your configured home matches it.'; return; }
  const normalizedKwh = actualKwh > 0 ? actualKwh / actualDays * 30 : null;
  const parts = [];
  if (normalizedKwh) {
    const explained = currentBill.kwh / normalizedKwh * 100;
    parts.push(`Your setup explains about ${Math.round(explained)}% of the bill's ${normalizedKwh.toFixed(0)} kWh 30-day equivalent`);
  }
  if (actualBill > 0) {
    const normalizedBill = actualBill / actualDays * 30;
    const difference = currentBill.total - normalizedBill;
    parts.push(`the estimate is ${difference >= 0 ? 'RM ' + difference.toFixed(2) + ' higher' : 'RM ' + Math.abs(difference).toFixed(2) + ' lower'} than the 30-day bill equivalent`);
  }
  output.textContent = `${parts.join('; ')}.`;
}
['actualKwh','actualBill','actualDays'].forEach(id => $(`#${id}`).addEventListener('input', () => updateCalibration(calculateBill())));
refreshScenarioSelect();

$('#resetButton').addEventListener('click', () => { appliances = structuredClone(defaults); afaRate = defaultAfa; touEnabled = false; daysAtHome = 30; $('#homeDays').value = daysAtHome; $('#afaSlider').value = defaultAfa; baselineBill = null; resetSimulation(); renderAppliances(); updateAfaLabel(); updateBill(true); });
$('#infoToggle').addEventListener('click', () => { const note = $('#formulaNote'); note.hidden = !note.hidden; $('#infoToggle').setAttribute('aria-expanded', String(!note.hidden)); });
$('#touToggle').addEventListener('click', () => { touEnabled = !touEnabled; updateBill(true); updateSimulationPanel(); });
function updateAfaLabel() { $('#afaValue').textContent = `${afaRate >= 0 ? '+' : ''}${afaRate.toFixed(2)} sen/kWh`; }
function updateTariffStatus() {
  const current = isProtectionConfigCurrent();
  $('#tariffStamp').classList.toggle('expired', !current);
  $('#tariffStampText').textContent = current ? `Peninsular Malaysia · ${tariffConfig.afa.period} rules` : `Tariff update required · protection ended ${tariffConfig.protection.effectiveUntil}`;
}
$('#afaSlider').addEventListener('input', (e) => { afaRate = Number(e.target.value); updateAfaLabel(); updateBill(); updateSimulationPanel(); });
$('#afaReset').addEventListener('click', () => { afaRate = defaultAfa; $('#afaSlider').value = defaultAfa; updateAfaLabel(); updateBill(); updateSimulationPanel(); });

function setTime(minute) {
  simMinute = (minute + 1440) % 1440;
  $('#timeSlider').value = Math.round(simMinute);
  const h = Math.floor(simMinute / 60), m = Math.floor(simMinute % 60);
  $('#simTime').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  updateSky();
  updateLiveLoad();
}
$('#timeSlider').addEventListener('input', (e) => setTime(Number(e.target.value)));
$('#playButton').addEventListener('click', () => {
  if (runComplete) resetSimulation();
  if (!simDay) simDay = 1;
  playing = !playing;
  $('#playButton').setAttribute('aria-pressed', String(playing));
  $('#playButton').innerHTML = playing ? '<span>Ⅱ</span> Pause' : '<span>▶</span> Continue';
  lastFrame = performance.now();
  if (playing) scheduleFrame();
  updateSimulationPanel();
});
$('#runReset').addEventListener('click', () => resetSimulation());

function roundedPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}
function fittedCanvasText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length && context.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
  return `${clipped}…`;
}
function createMeterResultCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1080;
  const context = canvas.getContext('2d');
  const totalKwh = monthlyKwh();
  const bill = calculateBill(totalKwh);
  const entries = appliances
    .filter(appliance => appliance.included !== false && appliance.on)
    .map((appliance, index) => ({ appliance, index, kwh:applianceEnergyForDays(appliance) }))
    .sort((left, right) => right.kwh - left.kwh || left.index - right.index);
  const rankedKwh = entries.reduce((sum, entry) => sum + entry.kwh, 0);
  const leaders = entries.slice(0, 5);
  const leaderKwh = leaders[0]?.kwh || 0;

  const backdrop = context.createLinearGradient(0, 0, 0, canvas.height);
  backdrop.addColorStop(0, '#073d9f');
  backdrop.addColorStop(1, '#031b56');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, canvas.width, canvas.height);
  roundedPath(context, 28, 28, 844, 1024, 32);
  context.strokeStyle = '#ffd62e';
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = '#62c9ff';
  context.font = '800 22px Arial, sans-serif';
  context.fillText('LIVE BILLING RUN', 68, 84);
  context.fillStyle = '#fffdf6';
  context.font = '900 38px Arial, sans-serif';
  context.fillText(`Day ${daysAtHome} of ${daysAtHome}`, 68, 132);
  roundedPath(context, 674, 68, 150, 52, 26);
  context.fillStyle = '#0b3476';
  context.fill();
  context.strokeStyle = '#62c9ff';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#fffdf6';
  context.font = '900 20px Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('COMPLETE', 749, 101);
  context.textAlign = 'left';

  roundedPath(context, 68, 164, 756, 164, 24);
  const meterGradient = context.createLinearGradient(0, 164, 0, 328);
  meterGradient.addColorStop(0, '#e6ebf1');
  meterGradient.addColorStop(1, '#aab7c8');
  context.fillStyle = meterGradient;
  context.fill();
  context.strokeStyle = '#7285a1';
  context.lineWidth = 2;
  context.stroke();

  const formatted = Math.min(999999.99, Math.max(0, totalKwh)).toFixed(2).padStart(9, '0');
  const boxWidth = 66, boxHeight = 78, gap = 8, decimalWidth = 24;
  const totalMeterWidth = formatted.split('').reduce((sum, character) => sum + (character === '.' ? decimalWidth : boxWidth), 0) + gap * (formatted.length - 1);
  let meterX = (canvas.width - totalMeterWidth) / 2;
  formatted.split('').forEach(character => {
    if (character === '.') {
      context.fillStyle = '#0a285b';
      context.font = '900 38px Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText('.', meterX + decimalWidth / 2, 263);
      meterX += decimalWidth + gap;
      return;
    }
    roundedPath(context, meterX, 196, boxWidth, boxHeight, 6);
    const digitGradient = context.createLinearGradient(0, 196, 0, 274);
    digitGradient.addColorStop(0, '#041b4b');
    digitGradient.addColorStop(.48, '#0b3476');
    digitGradient.addColorStop(.52, '#061f55');
    digitGradient.addColorStop(1, '#03183f');
    context.fillStyle = digitGradient;
    context.fill();
    context.strokeStyle = '#25477c';
    context.stroke();
    context.fillStyle = '#f6f8fb';
    context.font = '900 48px Consolas, monospace';
    context.textAlign = 'center';
    context.fillText(character, meterX + boxWidth / 2, 252);
    meterX += boxWidth + gap;
  });
  context.fillStyle = '#12366d';
  context.font = '900 18px Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('kWh', canvas.width / 2, 307);
  context.textAlign = 'left';

  [[68, 'Energy so far', `${totalKwh.toFixed(1)} kWh`], [454, 'Estimated bill', `RM ${bill.total.toFixed(2)}`]].forEach(([x, label, value]) => {
    roundedPath(context, x, 354, 370, 112, 18);
    context.fillStyle = 'rgba(255,255,255,.07)';
    context.fill();
    context.fillStyle = '#b9d5ff';
    context.font = '700 20px Arial, sans-serif';
    context.fillText(label, x + 22, 389);
    context.fillStyle = '#fffdf6';
    context.font = '900 30px Arial, sans-serif';
    context.fillText(value, x + 22, 433);
  });

  leaders.forEach(({ appliance, kwh }, rank) => {
    const y = 500 + rank * 94;
    const usage = leaderKwh ? Math.max(.02, kwh / leaderKwh) : 0;
    roundedPath(context, 68, y, 756, 76, 10);
    context.fillStyle = 'rgba(1,13,49,.72)';
    context.fill();
    context.save();
    roundedPath(context, 68, y, 756, 76, 10);
    context.clip();
    context.fillStyle = ['#ff625c','#53db8b','#62c9ff','#d4a900','#d4a900'][rank];
    context.globalAlpha = .78;
    context.fillRect(68, y, 756 * usage, 76);
    context.restore();
    context.fillStyle = '#ffffff';
    context.font = '900 22px Arial, sans-serif';
    context.fillText(fittedCanvasText(context, appliance.name, 430), 88, y + 45);
    const share = bill.total * (rankedKwh ? kwh / rankedKwh : 0);
    context.textAlign = 'right';
    context.font = '900 20px Arial, sans-serif';
    context.fillText(`${kwh.toFixed(kwh < 10 ? 2 : 1)} kWh`, 802, y + 31);
    context.fillStyle = '#e7f2ff';
    context.font = '700 15px Arial, sans-serif';
    context.fillText(`RM ${share.toFixed(2)} share`, 802, y + 55);
    context.textAlign = 'left';
  });

  context.fillStyle = '#ffd62e';
  context.font = '900 28px Arial, sans-serif';
  context.fillText('myWATT???', 68, 1010);
  context.fillStyle = '#b9d5ff';
  context.font = '700 16px Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText('Planning simulation · not an official TNB bill', 824, 1008);
  context.textAlign = 'left';
  return canvas;
}
function downloadMeterResult(blob) {
  const link = document.createElement('a');
  link.download = `myWATT-meter-${daysAtHome}-days.png`;
  link.href = URL.createObjectURL(blob);
  document.body.append(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
}
$('#shareResult').addEventListener('click', async () => {
  const canvas = createMeterResultCanvas();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `myWATT-meter-${daysAtHome}-days.png`, { type:'image/png' });
  const shareData = { files:[file], title:'myWATT??? meter result', text:'My household energy simulation result from myWATT???' };
  if (navigator.canShare?.({ files:[file] })) {
    try { await navigator.share(shareData); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  downloadMeterResult(blob);
});
$('#homeDays').addEventListener('input', (event) => {
  daysAtHome = Number(event.target.value);
  resetSimulation();
  renderAppliances();
  updateBill(true);
});
document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => {
  simSpeed = Number(button.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach(candidate => {
    const selected = candidate === button;
    candidate.classList.toggle('active', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
}));

function isActiveAtTime(a) { return modelIsActiveAtTime(a, simMinute, simDay || 1); }
function updateLiveLoad() {
  const active = appliances.filter(isActiveAtTime);
  const kw = liveLoadKwAt(appliances, simMinute, simDay || 1);
  $('#liveLoad').textContent = `${kw.toFixed(2)} kW`;
  $('#activeCount').textContent = `${active.length} appliance${active.length === 1 ? '' : 's'} running`;
}

const skyStops = [
  { hour:0, top:'#020b2a', bottom:'#0a2359' },
  { hour:5, top:'#07143d', bottom:'#193a72' },
  { hour:7.5, top:'#715eaa', bottom:'#f1a36d' },
  { hour:12, top:'#0f6ddd', bottom:'#62c9ff' },
  { hour:17, top:'#1778d8', bottom:'#77cfff' },
  { hour:19, top:'#49347f', bottom:'#ef805f' },
  { hour:21, top:'#07143d', bottom:'#163769' },
  { hour:24, top:'#020b2a', bottom:'#0a2359' }
];
function hexChannels(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
function blendHex(from, to, amount) {
  const left = hexChannels(from), right = hexChannels(to);
  const channels = left.map((channel, index) => Math.round(channel + (right[index] - channel) * amount));
  return `rgb(${channels.join(',')})`;
}
function skyPalette(hour) {
  const rightIndex = skyStops.findIndex(stop => hour <= stop.hour);
  const right = skyStops[Math.max(1, rightIndex)];
  const left = skyStops[Math.max(0, Math.max(1, rightIndex) - 1)];
  const amount = (hour - left.hour) / Math.max(.01, right.hour - left.hour);
  return { top:blendHex(left.top, right.top, amount), bottom:blendHex(left.bottom, right.bottom, amount) };
}
function updateSky() {
  const wrap = $('#sceneWrap');
  const hour = simMinute / 60;
  const palette = skyPalette(hour);
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const isDay = hour >= 6 && hour < 18;
  const orbitProgress = isDay ? (hour - 6) / 12 : ((hour + 6) % 24) / 12;
  const orbX = 8 + orbitProgress * 84;
  const orbY = 72 - Math.sin(orbitProgress * Math.PI) * 58;
  wrap.style.background = `linear-gradient(180deg,${palette.top} 0%,${palette.bottom} 100%)`;
  wrap.style.setProperty('--stars-opacity', String(Math.max(0, Math.min(1, 1 - daylight * 1.8))));
  wrap.style.setProperty('--orb-x', `${orbX}%`);
  wrap.style.setProperty('--orb-y', `${orbY}%`);
  wrap.style.setProperty('--orb-color', isDay ? '#ffd62e' : '#e7f2ff');
  wrap.style.setProperty('--orb-glow', isDay ? 'rgba(255,214,46,.48)' : 'rgba(158,220,255,.25)');
}

let animationFrameId = 0;
function scheduleFrame() {
  if (!animationFrameId && playing && !document.hidden) animationFrameId = requestAnimationFrame(animate);
}
function animate(now) {
  animationFrameId = 0;
  if (playing) {
    const elapsedMs = Math.min(100, Math.max(0, now - lastFrame));
    const requestedMinutes = elapsedMs * .02 * simSpeed;
    const remainingMinutes = Math.max(0, (daysAtHome - simDay + 1) * 1440 - simMinute);
    const simulatedMinutes = Math.min(requestedMinutes, remainingMinutes);
    const interval = integrateSimulationInterval(appliances, { startDay:simDay || 1, startMinute:simMinute, durationMinutes:simulatedMinutes });
    runKwh += interval.totalKwh;
    runPeakKwh += interval.peakKwh;
    runOffpeakKwh += interval.offpeakKwh;
    Object.entries(interval.applianceKwh).forEach(([id, kwh]) => { runApplianceKwh[id] = (runApplianceKwh[id] || 0) + kwh; });
    simDay = interval.endDay;
    setTime(interval.endMinute);
    if (remainingMinutes <= requestedMinutes + 1e-9) {
      playing = false;
      runComplete = true;
      $('#playButton').setAttribute('aria-pressed', 'false');
      $('#playButton').innerHTML = '<span>↻</span> Run again';
    }
    updateSimulationPanel();
  }
  lastFrame = now;
  if (playing) scheduleFrame();
}
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (!document.hidden && playing) scheduleFrame();
});
function registerWebMcp() {
  const context=document.modelContext; if(!context?.registerTool) return;
  const tool={
    name:'configure_household_energy', title:'Configure household energy',
    description:'Set appliance usage, product size, energy-star rating and tariff plan in the visible myWATT simulation and return the updated monthly kWh and Malaysian bill estimate.',
    inputSchema:{type:'object',properties:{appliances:{type:'array',items:{type:'object',properties:{id:{type:'string'},inHome:{type:'boolean'},hoursPerDay:{type:'number',minimum:0,maximum:24},quantity:{type:'integer',minimum:1,maximum:24},enabled:{type:'boolean'},variant:{type:'string'},compressorType:{type:'string'},stars:{type:'integer',minimum:1,maximum:5},labelWatts:{type:'number',minimum:0,maximum:30000},labelKwhPerYear:{type:'number',minimum:0,maximum:50000}},required:['id'],additionalProperties:false}},afaSenPerKwh:{type:'number',minimum:-10,maximum:10},touEnabled:{type:'boolean'}},additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input){
      if(!input || typeof input!=='object') throw new Error('Input must be an object.');
      if(input.afaSenPerKwh!==undefined){ if(!Number.isFinite(input.afaSenPerKwh)||input.afaSenPerKwh < -10||input.afaSenPerKwh > 10) throw new Error('AFA must be between -10 and 10 sen/kWh.'); afaRate=input.afaSenPerKwh; $('#afaSlider').value=afaRate; updateAfaLabel(); }
      if(input.touEnabled!==undefined) touEnabled=input.touEnabled;
      if(input.appliances){ for(const update of input.appliances){ const a=appliances.find(x=>x.id===update.id); if(!a) throw new Error(`Unknown appliance id: ${update.id}`); if(a.alwaysOn && (update.enabled===false || update.inHome===false)) throw new Error(`${a.name} represents the unavoidable connected-home baseline and cannot be removed or switched off.`); if(update.inHome!==undefined) a.included=update.inHome; if(update.hoursPerDay!==undefined) a.hours=update.hoursPerDay; if(update.quantity!==undefined) a.qty=update.quantity; if(update.enabled!==undefined){ a.on=update.enabled; if(update.enabled) a.included=true; } if(update.stars!==undefined){ if(!a.stars) throw new Error(`${a.name} does not use the star-rating control.`); a.stars=update.stars; } if(update.labelWatts!==undefined) a.customWatts=update.labelWatts; if(update.labelKwhPerYear!==undefined) a.customAnnualKwh=update.labelKwhPerYear; if(update.variant!==undefined && !selectVariant(a, update.variant)) throw new Error(`Unknown ${a.name} variant: ${update.variant}`); if(update.compressorType!==undefined && !selectSecondaryVariant(a, update.compressorType)) throw new Error(`Unknown ${a.name} compressor type: ${update.compressorType}`); if(update.labelWatts!==undefined) syncUsageHours(a); } }
      renderAppliances(); updateBill(true); const bill=calculateBill(); return {monthlyKwh:Number(bill.kwh.toFixed(1)),estimatedBillRm:Number(bill.total.toFixed(2)),tariff:bill.useTou?'Domestic ToU':'Domestic General',peakKwh:Number(bill.peakKwh.toFixed(1)),offpeakKwh:Number(bill.offpeakKwh.toFixed(1)),protected:bill.protectedUser};
    }
  };
  try { void Promise.resolve(context.registerTool(tool)).catch(()=>{}); } catch {}
}

renderAppliances(); updateAfaLabel(); updateTariffStatus(); updateBill(); setTime(simMinute); updateSimulationPanel(); registerWebMcp();
