import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
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
  updateSceneState();
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
  updateSceneState();
}
$('#timeSlider').addEventListener('input', (e) => setTime(Number(e.target.value)));
$('#playButton').addEventListener('click', () => {
  if (runComplete) resetSimulation();
  if (!simDay) simDay = 1;
  playing = !playing;
  $('#playButton').setAttribute('aria-pressed', String(playing));
  $('#playButton').innerHTML = playing ? '<span>Ⅱ</span> Pause' : '<span>▶</span> Continue';
  updateSimulationPanel();
});
$('#runReset').addEventListener('click', () => resetSimulation());
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

// Three.js flat-isometric house
const canvas = $('#houseCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x063c9d, 15, 28);
const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
camera.position.set(11, 12, 13); camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xfff4c9, 0x061b55, 2.5));
const sun = new THREE.DirectionalLight(0xffed9a, 4.2); sun.position.set(7,12,8); sun.castShadow = true; scene.add(sun);
const group = new THREE.Group(); group.rotation.y = -.08; scene.add(group);
const applianceMeshes = new Map();
const roomLights = [];
function box(w,h,d,color,x,y,z, name='', emissive=0x000000) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: .72, emissive, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; if (name) mesh.userData.applianceId = name; group.add(mesh); return mesh;
}
box(13,.3,9,0x0847a5,0,-.2,0);
// Room floors and low walls
box(5.8,.12,4.1,0xe9dfc8,-3,.02,-2.25); box(5.8,.12,4.1,0xcfe9f8,3,.02,-2.25);
box(5.8,.12,4.1,0xf0dca8,-3,.02,2.25); box(5.8,.12,4.1,0xc6e0f2,3,.02,2.25);
box(12,.85,.16,0xfff8e8,0,.55,-4.35); box(.16,.85,8.7,0xfff8e8,-6,.55,0); box(.16,.85,8.7,0xfff8e8,6,.55,0); box(12,.85,.16,0xfff8e8,0,.55,4.35);
box(.14,.55,8.5,0x1d62c1,0,.4,0); box(11.8,.55,.14,0x1d62c1,0,.4,0);
// Furniture and appliances; restrained, toy-like geometry
box(3.1,.65,1.4,0x1764c9,-3,.42,3.0); box(1.2,.38,1.2,0xffd62e,-3,.26,1.8); // sofa/table
const tv = box(1.7,1.05,.16,0x04194f,-5.1,.75,1.3,'tv',0xffd62e); applianceMeshes.set('tv', tv);
box(3.2,.55,2.2,0xfff6dc,3,.34,2.55); box(3.2,.16,.22,0x5c91cf,3,1.05,3.58); // bed
const ac = box(1.55,.48,.42,0xe9f2f8,4.5,1.15,.5,'aircon',0x62c9ff); applianceMeshes.set('aircon', ac);
box(4.8,.68,.72,0x1764c9,-3,.43,-3.2); // kitchen bench
const fridge = box(1.15,2.2,1.0,0xe2edf5,-5.0,1.17,-2.1,'fridge',0x62c9ff); applianceMeshes.set('fridge', fridge);
const freezer = box(1.25,.8,.9,0xd4e4ef,-4.0,.5,-3.15,'freezer',0x62c9ff); applianceMeshes.set('freezer', freezer);
const rice = box(.65,.6,.65,0xf5f0e5,-2.8,.92,-3.15,'rice',0xffd62e); applianceMeshes.set('rice', rice);
const kettle = box(.42,.62,.42,0x082b70,-1.75,.92,-3.15,'kettle',0xff7248); applianceMeshes.set('kettle', kettle);
const microwave = box(.8,.48,.52,0x0a347f,-.85,.9,-3.15,'microwave',0xff7248); applianceMeshes.set('microwave', microwave);
const waterpurifier = box(.48,.9,.46,0xe7f1f7,-3.95,1.32,-3.15,'waterpurifier',0x62c9ff); applianceMeshes.set('waterpurifier', waterpurifier);
const oven = box(.9,1.0,.7,0x082b70,-1.3,.54,-2.0,'oven',0xff7248); applianceMeshes.set('oven', oven);
const hood = box(1.4,.25,.62,0xc7d9e5,-2.3,1.75,-3.1,'hood',0xffd62e); applianceMeshes.set('hood', hood);
box(2.3,.7,.65,0x1457b6,3,.45,-3.25); // desk
const pc = box(.85,1.15,.65,0x04194f,4.8,.62,-3.0,'pc',0x62c9ff); applianceMeshes.set('pc', pc);
const pcMonitor1 = box(.72,.46,.1,0x061f5d,2.65,1.03,-3.25,'',0x62c9ff);
const pcMonitor2 = box(.72,.46,.1,0x061f5d,3.48,1.03,-3.25,'',0x62c9ff);
const washer = box(1.1,1.15,1.0,0xe8eff5,1.15,.62,-2.85,'washer',0x62c9ff); applianceMeshes.set('washer', washer);
const dryer = box(1.1,1.15,1.0,0xd8e3eb,2.45,.62,-2.85,'dryer',0xff7248); applianceMeshes.set('dryer', dryer);
const iron = box(.62,.24,.3,0xeee3d8,3.45,.84,-3.25,'iron',0xff7248); iron.rotation.y = -.28; applianceMeshes.set('iron', iron);
const heater = box(.56,1.1,.5,0xeee9dc,5.25,.75,-1.3,'heater',0xff7248); applianceMeshes.set('heater', heater);
const router = box(.58,.16,.42,0x061f5d,2.1,.86,-3.25,'router',0x62c9ff); applianceMeshes.set('router', router);
const ev = box(2.7,.58,1.35,0x1457b6,3.4,.05,5.05,'ev',0x62c9ff); applianceMeshes.set('ev', ev);
box(.56,.44,.38,0xffd62e,5.1,.22,4.7); // wallbox
// bulbs/fans as interactive tokens
[[-3,2.1,2.2],[3,2.1,2.2],[-3,2.1,-2.2],[3,2.1,-2.2]].forEach((p,i)=>{ const bulb = new THREE.PointLight(0xffd85a,0,4); bulb.position.set(...p); group.add(bulb); roomLights.push(bulb); const orb = new THREE.Mesh(new THREE.SphereGeometry(.13,12,12), new THREE.MeshBasicMaterial({color:0xffd62e})); orb.position.set(...p); orb.userData.applianceId='lights'; group.add(orb); if(i===0) applianceMeshes.set('lights',orb); });
const fan = new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.08,16), new THREE.MeshStandardMaterial({color:0x1457b6})); fan.position.set(-2.7,2.05,1.9); fan.userData.applianceId='fan'; group.add(fan); applianceMeshes.set('fan',fan);
const powerHub = new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.16,18), new THREE.MeshStandardMaterial({color:0xffd62e,emissive:0xffd62e,emissiveIntensity:1.5}));
powerHub.position.set(0,.22,0); group.add(powerHub);
const energyFlows = [];
applianceMeshes.forEach((mesh,id) => {
  const start = new THREE.Vector3(0,.24,0);
  const end = mesh.position.clone(); end.y = Math.max(.24,end.y*.62);
  const mid = new THREE.Vector3(end.x,.24,0);
  const curve = new THREE.CatmullRomCurve3([start,mid,end]);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), new THREE.LineBasicMaterial({color:0xffd62e,transparent:true,opacity:.08}));
  group.add(line);
  const pulses = [0,.5].map(offset => { const orb=new THREE.Mesh(new THREE.SphereGeometry(.075,10,10),new THREE.MeshBasicMaterial({color:0xffe888,transparent:true,opacity:.95})); orb.visible=false; group.add(orb); return {orb,offset}; });
  energyFlows.push({id,curve,line,pulses});
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.MeshStandardMaterial({color:0x031644,roughness:1})); ground.rotation.x=-Math.PI/2; ground.position.y=-.38; ground.receiveShadow=true; scene.add(ground);
const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color:0x9edcff,size:.06,transparent:true,opacity:0}));
const starData=[]; for(let i=0;i<220;i++) starData.push((Math.random()-.5)*30,Math.random()*12+3,(Math.random()-.5)*22); stars.geometry.setAttribute('position',new THREE.Float32BufferAttribute(starData,3)); scene.add(stars);

function isActiveAtTime(a) { return modelIsActiveAtTime(a, simMinute, simDay || 1); }
function updateLiveLoad() {
  const active = appliances.filter(isActiveAtTime);
  const kw = liveLoadKwAt(appliances, simMinute, simDay || 1);
  $('#liveLoad').textContent = `${kw.toFixed(2)} kW`;
  $('#activeCount').textContent = `${active.length} appliance${active.length === 1 ? '' : 's'} running`;
  energyFlows.forEach(flow => {
    const on = active.some(a => (a.templateId || a.id) === flow.id);
    flow.line.material.opacity = on ? .42 : .045;
    flow.pulses.forEach(p => p.orb.visible = on);
  });
}
function relatedSceneAppliances(id) { return appliances.filter(a => a.included !== false && (a.templateId || a.id) === id); }
function updateSceneState() {
  applianceMeshes.forEach((mesh, id) => {
    const related = relatedSceneAppliances(id);
    const active = related.some(isActiveAtTime);
    const enabled = related.some(a => a.on);
    mesh.visible = related.length > 0;
    if (mesh?.material?.emissive) mesh.material.emissiveIntensity = active ? .9 : (enabled ? .16 : 0);
    mesh.scale.y = enabled ? 1.04 : 1;
  });
  const lightsOn = appliances.some(a=>(a.templateId || a.id)==='lights' && isActiveAtTime(a));
  const pcSetup = appliances.find(a=>a.included !== false && (a.templateId || a.id)==='pc' && a.on);
  pcMonitor1.visible = Boolean(pcSetup?.on);
  pcMonitor2.visible = Boolean(pcSetup?.on && pcSetup.variant?.includes('2 monitors'));
  pcMonitor1.material.emissiveIntensity = isActiveAtTime(pcSetup) ? .5 : .08;
  pcMonitor2.material.emissiveIntensity = isActiveAtTime(pcSetup) ? .5 : .08;
  roomLights.forEach(light => light.intensity = lightsOn && (simMinute/60 > 17 || simMinute/60 < 6) ? 8 : 0);
  updateLiveLoad();
}
function updateSky() {
  const hour = simMinute/60;
  const daylight = Math.max(0, Math.sin(((hour-6)/12)*Math.PI));
  const bg = new THREE.Color().lerpColors(new THREE.Color(0x031644), new THREE.Color(0x0870df), daylight*.72);
  renderer.setClearColor(bg,1); scene.fog.color.copy(bg);
  sun.intensity = .8 + daylight*3.8; stars.material.opacity = 1-daylight;
  roomLights.forEach(light => light.intensity = appliances.some(a=>(a.templateId || a.id)==='lights' && isActiveAtTime(a)) && daylight < .25 ? 8 : 0);
}

const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
function hitFromEvent(event) {
  const rect = canvas.getBoundingClientRect(); pointer.x=((event.clientX-rect.left)/rect.width)*2-1; pointer.y=-((event.clientY-rect.top)/rect.height)*2+1; raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObjects(group.children,false).find(hit=>hit.object.userData.applianceId);
}
canvas.addEventListener('pointermove', e => {
  const hit=hitFromEvent(e), tip=$('#sceneTooltip');
  if(!hit){tip.classList.remove('show'); return;}
  const related=relatedSceneAppliances(hit.object.userData.applianceId); if(!related.length){tip.classList.remove('show'); return;} const activeCount=related.filter(a=>a.on).length; tip.textContent=`${related[0].name.replace(/ \d+$/, '')}${related.length > 1 ? ` · ${related.length} units` : ''} · ${activeCount ? 'ON' : 'OFF'}`; const rect=$('#sceneWrap').getBoundingClientRect(); tip.style.left=`${e.clientX-rect.left}px`; tip.style.top=`${e.clientY-rect.top}px`; tip.classList.add('show');
});
canvas.addEventListener('pointerleave',()=>$('#sceneTooltip').classList.remove('show'));
canvas.addEventListener('click', e => {
  const hit=hitFromEvent(e); if(!hit) return;
  const related=relatedSceneAppliances(hit.object.userData.applianceId); if(!related.length) return;
  const turnOn=!related.some(a=>a.on); related.forEach(a=>a.on=turnOn);
  resetSimulation(false); renderAppliances(); updateBill(true);
});

function resize() {
  const rect=canvas.getBoundingClientRect(); renderer.setSize(rect.width,rect.height,false); const aspect=rect.width/rect.height; const view=7.2; camera.left=-view*aspect; camera.right=view*aspect; camera.top=view; camera.bottom=-view; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
let animationFrameId = 0;
let sceneVisible = true;
function scheduleFrame() {
  if (!animationFrameId && (sceneVisible || playing) && !document.hidden) animationFrameId = requestAnimationFrame(animate);
}
function animate(now) {
  animationFrameId = 0;
  if(playing){
    const elapsedMs = Math.min(100, Math.max(0, now-lastFrame));
    const requestedMinutes = elapsedMs*.02*simSpeed;
    const remainingMinutes = Math.max(0, (daysAtHome-simDay+1)*1440-simMinute);
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
  lastFrame=now;
  if (sceneVisible) {
    const fanA=appliances.find(a=>(a.templateId || a.id)==='fan' && isActiveAtTime(a)); if(fanA) fan.rotation.y += .07;
    energyFlows.forEach((flow,flowIndex) => flow.pulses.forEach(p => {
      if (!p.orb.visible) return;
      const progress = (now*.00034*(1+Math.min(simSpeed,8)*.06) + p.offset + flowIndex*.083) % 1;
      p.orb.position.copy(flow.curve.getPoint(progress));
      const pulse = .72 + Math.sin(now*.012 + flowIndex)*.24;
      p.orb.scale.setScalar(pulse);
    }));
    [...applianceMeshes.entries()].forEach(([id,mesh],index) => {
      if(mesh.userData.baseY===undefined) mesh.userData.baseY=mesh.position.y;
      const active=appliances.some(a=>(a.templateId || a.id)===id && isActiveAtTime(a));
      mesh.position.y=mesh.userData.baseY+(active?Math.sin(now*.004+index)*.025:0);
      if(active && mesh.material?.emissive) mesh.material.emissiveIntensity=.72+Math.sin(now*.006+index)*.24;
    });
    if(appliances.some(a=>(a.templateId || a.id)==='tv' && isActiveAtTime(a))) tv.material.emissiveIntensity=.55+Math.random()*.55;
    powerHub.rotation.y += .012;
    powerHub.scale.setScalar(.94+Math.sin(now*.006)*.08);
    renderer.render(scene,camera);
  }
  scheduleFrame();
}

if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    sceneVisible = entry.isIntersecting;
    if (sceneVisible) { lastFrame = performance.now(); scheduleFrame(); }
  }, { threshold:.01 }).observe(canvas);
}
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (!document.hidden) scheduleFrame();
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

renderAppliances(); updateAfaLabel(); updateTariffStatus(); updateBill(); setTime(simMinute); updateSimulationPanel(); registerWebMcp(); resize(); scheduleFrame();
