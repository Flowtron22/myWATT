import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const protectionThreshold = 800;
const daysPerMonth = 30;
const defaultAfa = 3.67;

const defaults = [
  { id: 'homebase', name: 'House idle load', icon: '⌂', watts: 28, hours: 24, qty: 1, duty: 1, on: true, alwaysOn: true, start: 0, room: 'Whole house', note: 'Small standby loads left connected' },
  { id: 'aircon', name: 'Air conditioner', icon: '❄', watts: 1050, hours: 8, qty: 1, duty: 0.72, on: true, start: 22, room: 'Bedroom', variant: '1.5 HP', stars: 5, variants: [{ label:'1.0 HP', watts:720 },{ label:'1.5 HP', watts:1050 },{ label:'2.0 HP', watts:1450 },{ label:'2.5 HP', watts:1850 },{ label:'3.0 HP', watts:2300 }] },
  { id: 'fridge', name: 'Refrigerator', icon: '▥', watts: 150, hours: 24, qty: 1, duty: 0.38, on: true, start: 0, room: 'Kitchen', variant: '2-door · 300L', variantLabel: 'Fridge type', stars: 4, variants: [{ label:'Mini bar · 90L', watts:70 },{ label:'1-door · 180L', watts:105 },{ label:'2-door · 300L', watts:150 },{ label:'4-door · 500L', watts:240 },{ label:'Side-by-side · 600L', watts:270 }] },
  { id: 'freezer', name: 'Freezer', icon: '▤', watts: 160, hours: 24, qty: 1, duty: 0.42, on: false, start: 0, room: 'Kitchen', variant: 'Chest · 300L', variantLabel: 'Freezer type', stars: 4, variants: [{ label:'Chest · 150L', watts:110 },{ label:'Chest · 300L', watts:160 },{ label:'Upright · 250L', watts:185 },{ label:'Upright · 400L', watts:240 }] },
  { id: 'heater', name: 'Water heater', icon: '♨', watts: 3600, hours: 0.6, qty: 1, duty: 1, on: true, start: 7, end: 8, room: 'Bathroom', variant: 'Instant shower · no pump', variantLabel: 'Heater type', variants: [{ label:'Instant shower · no pump', watts:3600, duty:1 },{ label:'Instant shower · with pump', watts:3650, duty:1 },{ label:'Instant high-flow · 5.5 kW', watts:5500, duty:1 },{ label:'Storage tank · 20L', watts:2500, duty:.55 },{ label:'Storage tank · 30–90L', watts:3000, duty:.45 }], note: 'Instant heaters draw full power while water flows. Storage heaters cycle on and off; the estimate includes typical thermostat cycling.' },
  { id: 'washer', name: 'Washing machine', icon: '◉', watts: 500, hours: 0.75, qty: 1, duty: .65, on: true, start: 11, end: 12, room: 'Yard', variant: 'Top load · 8–10kg', variantLabel: 'Washer & cycle', variants: [{ label:'Top load · 8–10kg', watts:500, duty:.65 },{ label:'Top load · 11–14kg', watts:650, duty:.65 },{ label:'Front load · cold wash', watts:500, duty:.55 },{ label:'Front load · warm wash', watts:2000, duty:.28 },{ label:'Front load · steam/hot', watts:2200, duty:.32 }], note: 'Cold front-load cycles usually use less electricity; warm, steam and hot cycles use an internal heater and can use much more.' },
  { id: 'dryer', name: 'Clothes dryer', icon: '◍', watts: 2500, hours: 0.45, qty: 1, duty: 1, on: false, start: 12, room: 'Yard', variant: 'Vented · 8kg', variantLabel: 'Dryer type', variants: [{ label:'Heat pump · 8kg', watts:900 },{ label:'Condenser · 8kg', watts:2100 },{ label:'Vented · 8kg', watts:2500 }] },
  { id: 'tv', name: 'Television', icon: '▰', watts: 110, hours: 4.5, qty: 1, duty: 1, on: true, start: 19, room: 'Living', variant: '55 inch', stars: 5, variants: [{ label:'32 inch', watts:55 },{ label:'43 inch', watts:80 },{ label:'55 inch', watts:110 },{ label:'65 inch', watts:155 },{ label:'75 inch', watts:210 }] },
  { id: 'fan', name: 'Ceiling fan', icon: '✣', watts: 55, hours: 8, qty: 2, duty: 1, on: true, start: 14, end: 22, room: 'Living' },
  { id: 'lights', name: 'LED lights', icon: '●', watts: 9, hours: 6, qty: 9, duty: 1, on: true, start: 18, end: 24, room: 'Whole house' },
  { id: 'rice', name: 'Rice cooker', icon: '◒', watts: 700, hours: 1.1, qty: 1, duty: 0.62, on: true, start: 17.5, end: 19, room: 'Kitchen' },
  { id: 'microwave', name: 'Microwave', icon: '▣', watts: 1200, hours: 0.15, qty: 1, duty: 1, on: false, start: 12.5, room: 'Kitchen' },
  { id: 'oven', name: 'Electric oven', icon: '▦', watts: 2400, hours: 0.5, qty: 1, duty: 0.75, on: false, start: 18, room: 'Kitchen' },
  { id: 'hood', name: 'Cooker hood', icon: '≋', watts: 180, hours: 1, qty: 1, duty: 1, on: false, start: 18, room: 'Kitchen', note: 'Kitchen smoke and exhaust fan' },
  { id: 'iron', name: 'Clothes iron', icon: '◢', watts: 1000, hours: 0.35, qty: 1, duty: .65, on: false, start: 16, room: 'Yard', variant: 'Dry iron', variantLabel: 'Iron type', variants: [{ label:'Dry iron', watts:1000, duty:.65 },{ label:'Basic steam iron', watts:1400, duty:.65 },{ label:'Cordless steam iron', watts:1800, duty:.55 },{ label:'High-power steam iron', watts:2300, duty:.6 },{ label:'Steam generator', watts:2400, duty:.7 }], note: 'The wattage is peak heating input. The thermostat cycles, so the estimate uses a typical on/off heating pattern.' },
  { id: 'router', name: 'Wi‑Fi router', icon: '⌁', watts: 12, hours: 24, qty: 1, duty: 1, on: true, start: 0, end: 24, room: 'Study' },
  { id: 'pc', name: 'Desktop PC', icon: '▣', watts: 350, hours: 4, qty: 1, duty: 0.72, on: true, start: 9, end: 18, room: 'Study' },
  { id: 'kettle', name: 'Kettle', icon: '◓', watts: 1800, hours: 0.2, qty: 1, duty: 1, on: true, start: 7, end: 7.3, room: 'Kitchen' },
  { id: 'ev', name: 'Home EV charging', icon: '⚡', watts: 7400, hours: 1.5, qty: 1, duty: 1, on: false, start: 0, room: 'Car porch', variant: 'Wallbox · 7.4 kW', variantLabel: 'Charger type', variants: [{ label:'Portable plug · 2.3 kW', watts:2300 },{ label:'Wallbox · 3.7 kW', watts:3700 },{ label:'Wallbox · 7.4 kW', watts:7400 },{ label:'3-phase · 11 kW', watts:11000 }], note: 'Adds to your home bill when charged at home' },
  { id: 'standby', name: 'Standby load', icon: '◌', watts: 32, hours: 24, qty: 1, duty: 1, on: true, start: 0, end: 24, room: 'Whole house' }
];

let appliances = structuredClone(defaults);
let afaRate = defaultAfa;
let baselineBill = null;
let simMinute = 420;
let playing = false;
let simSpeed = 1;
let lastFrame = performance.now();

const $ = (selector) => document.querySelector(selector);
const grid = $('#applianceGrid');
const currency = (n) => `RM ${Math.abs(n).toFixed(2)}`;
const starMultipliers = { 1: 1.18, 2: 1.09, 3: 1, 4: .91, 5: .82 };

function wattsFor(a) {
  const base = a.variants ? (a.variants.find(v => v.label === a.variant)?.watts || a.watts) : a.watts;
  return Math.round(base * (a.stars ? starMultipliers[a.stars] : 1));
}
function selectVariant(a, label) {
  const variant = a.variants?.find(v => v.label === label);
  if (!variant) return false;
  a.variant = label;
  if (variant.duty !== undefined) a.duty = variant.duty;
  return true;
}
function formatHours(hours) {
  if (hours < 1) return hours.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function incentiveRate(kwh) {
  const bands = [[200,.25],[250,.245],[300,.225],[350,.21],[400,.17],[450,.145],[500,.12],[550,.105],[600,.09],[650,.075],[700,.055],[750,.045],[800,.04],[850,.025],[900,.01],[1000,.005]];
  return (bands.find(([max]) => kwh <= max) || [0,0])[1];
}

function calculateBill() {
  const kwh = appliances.reduce((sum, a) => sum + (a.on ? (wattsFor(a) / 1000) * a.hours * a.qty * a.duty * daysPerMonth : 0), 0);
  const generationRate = kwh > 1500 ? .3703 : .2703;
  const energy = kwh * generationRate;
  const capacity = kwh * .0455;
  const network = kwh * .1285;
  const incentive = kwh * incentiveRate(kwh);
  const protectedUser = kwh <= protectionThreshold;
  const afa = protectedUser ? 0 : kwh * (afaRate / 100);
  const retail = protectedUser ? 0 : 10;
  const kwhChargesAfterDiscount = Math.max(0, energy + capacity + network - incentive);
  const kwtbb = kwh > 300 ? kwhChargesAfterDiscount * .016 : 0;
  const taxableShare = protectedUser ? 0 : Math.max(0, kwh - protectionThreshold) / kwh;
  const sst = protectedUser ? 0 : ((kwhChargesAfterDiscount + afa) * taxableShare + retail) * .08;
  const subtotal = energy + capacity + network + afa + retail - incentive + kwtbb + sst;
  const minimumAdjustment = Math.max(0, 5 - subtotal);
  const total = Math.max(5, subtotal);
  return { kwh, generationRate, energy, capacity, network, incentive, afa, retail, kwtbb, sst, subtotal, minimumAdjustment, total, protectedUser };
}

function applianceKwh(a) { return a.on ? (wattsFor(a) / 1000) * a.hours * a.qty * a.duty * daysPerMonth : 0; }

function renderAppliances() {
  grid.innerHTML = appliances.map(a => {
    const estimatedWatts = wattsFor(a);
    const monthlyKwh = (estimatedWatts / 1000) * a.hours * a.qty * a.duty * daysPerMonth;
    const ratingControl = a.stars ? `
        <div class="rating-control">
          <span>Energy rating</span>
          <div class="stars" role="group" aria-label="${a.name} energy star rating">
            ${[1,2,3,4,5].map(star => `<button class="star-button ${star <= a.stars ? 'filled' : ''}" type="button" data-action="stars" data-id="${a.id}" data-stars="${star}" aria-label="Set ${star} star rating" aria-pressed="${star === a.stars}">★</button>`).join('')}
          </div>
        </div>` : '';
    const shoppingOptions = a.variants ? `
      <div class="product-options ${a.stars ? '' : 'single-option'}">
        <div class="variant-control">
          <label for="variant-${a.id}">${a.variantLabel || (a.id === 'aircon' ? 'Cooling size' : 'Screen size')}</label>
          <select id="variant-${a.id}" data-action="variant" data-id="${a.id}" aria-label="${a.name} size">
            ${a.variants.map(v => `<option value="${v.label}" ${v.label === a.variant ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        ${ratingControl}
        <p class="watt-explain">Estimated input: <b>${estimatedWatts.toLocaleString()} W</b>${a.stars ? '. Star impact is an educational estimate; check the product energy label for its tested kWh.' : '.'}</p>
      </div>` : '';
    return `
    <article class="appliance-card ${a.on ? 'on' : ''} ${a.alwaysOn ? 'always-on' : ''}" data-card="${a.id}">
      <div class="appliance-top">
        <span class="appliance-icon" aria-hidden="true">${a.icon}</span>
        <div class="appliance-name"><b>${a.name}</b><small>${a.variant ? `${a.variant} · ` : ''}${estimatedWatts.toLocaleString()} W · ${a.on ? '' : 'OFF · '}≈${monthlyKwh.toFixed(monthlyKwh < 10 ? 1 : 0)} kWh/mo</small></div>
        ${a.alwaysOn ? '<span class="always-badge">BASE</span>' : `<button class="switch" type="button" data-action="toggle" data-id="${a.id}" aria-label="${a.on ? 'Switch off' : 'Switch on'} ${a.name}" aria-pressed="${a.on}"></button>`}
      </div>
      <div class="appliance-controls">
        <div class="hours-control">
          <label for="hours-${a.id}"><span>Hours / day</span><b>${formatHours(a.hours)}h</b></label>
          <input id="hours-${a.id}" data-action="hours" data-id="${a.id}" type="range" min="0" max="24" step="0.05" value="${a.hours}" ${a.on && !a.alwaysOn ? '' : 'disabled'}>
        </div>
        ${a.alwaysOn ? '' : `<div class="qty-control" aria-label="Quantity">
          <button type="button" data-action="qty-down" data-id="${a.id}" aria-label="Reduce ${a.name} quantity">−</button>
          <span>${a.qty}</span>
          <button type="button" data-action="qty-up" data-id="${a.id}" aria-label="Increase ${a.name} quantity">+</button>
        </div>`}
      </div>
      ${a.note ? `<p class="appliance-note">${a.note}</p>` : ''}
      ${shoppingOptions}
    </article>`;
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
  $('#kwhTotal').textContent = Math.round(b.kwh).toLocaleString();
  $('#meterFill').style.width = `${Math.min(100, b.kwh / 1200 * 100)}%`;
  const badge = $('#protectionBadge');
  badge.textContent = b.protectedUser ? 'Protected ≤800 kWh' : 'Above protection';
  badge.classList.toggle('warn', !b.protectedUser);
  const diff = b.total - baselineBill;
  $('#billDelta').textContent = Math.abs(diff) < .01 ? 'Your starting household estimate' : `${diff < 0 ? '↓' : '↑'} ${currency(diff)} ${diff < 0 ? 'saved' : 'more'} from your starting setup`;

  const eeRate = incentiveRate(b.kwh) * 100;
  $('#billLines').innerHTML = [
    addBillLine('Energy charge', `${(b.generationRate*100).toFixed(2)} sen × ${b.kwh.toFixed(1)} kWh`, b.energy),
    addBillLine('Capacity charge', `4.55 sen × ${b.kwh.toFixed(1)} kWh`, b.capacity),
    addBillLine('Network charge', `12.85 sen × ${b.kwh.toFixed(1)} kWh`, b.network),
    addBillLine('Energy Efficiency Incentive', eeRate ? `${eeRate.toFixed(2)} sen rebate on all kWh` : 'Not available above 1,000 kWh', b.incentive, true),
    addBillLine('Automatic Fuel Adjustment', b.protectedUser ? `Exempt under current ${protectionThreshold} kWh protection` : `${afaRate >= 0 ? '+' : ''}${afaRate.toFixed(2)} sen × ${b.kwh.toFixed(1)} kWh`, Math.abs(b.afa), b.afa < 0),
    addBillLine('Retail charge', b.protectedUser ? 'Exempt under current protection' : 'Fixed monthly charge', b.retail),
    addBillLine('Renewable Energy Fund', b.kwh <= 300 ? 'Exempt at 300 kWh and below' : '1.6% of eligible usage charges', b.kwtbb),
    addBillLine('Service tax', b.protectedUser ? 'Exempt under current protection' : '8% on estimated taxable portion', b.sst),
    ...(b.minimumAdjustment > 0 ? [addBillLine('Minimum monthly charge', 'Domestic tariff minimum: RM5.00', b.minimumAdjustment)] : [])
  ].join('');

  const score = Math.max(8, Math.round(100 - Math.max(0, b.kwh - 250) * .085 - Math.max(0, b.total - 120) * .045));
  $('#scoreValue').textContent = score;
  $('#scoreRing').style.setProperty('--score', `${score * 3.6}deg`);
  $('#scoreTitle').textContent = score >= 80 ? 'Efficient household' : score >= 60 ? 'Good, with room to trim' : score >= 40 ? 'High-use household' : 'Energy intensive';
  $('#scoreCopy').textContent = b.protectedUser ? `${Math.max(0, protectionThreshold - b.kwh).toFixed(0)} kWh of headroom before AFA, retail and SST protection ends.` : `${(b.kwh - protectionThreshold).toFixed(0)} kWh above the current protection line.`;

  const ranked = appliances.filter(a => a.on && !a.alwaysOn).sort((a,c) => applianceKwh(c) - applianceKwh(a));
  const top = ranked[0];
  if (top) {
    const oneHour = (wattsFor(top) / 1000) * top.qty * top.duty * daysPerMonth;
    $('#coachTitle').textContent = `Trim ${top.name.toLowerCase()} by one hour`;
    $('#coachCopy').textContent = `Your biggest load uses about ${applianceKwh(top).toFixed(0)} kWh/month. One hour less per day removes roughly ${oneHour.toFixed(0)} kWh before tariff effects.`;
  } else {
    $('#coachTitle').textContent = 'Only the connected-home baseline remains';
    $('#coachCopy').textContent = 'The estimate stays at the RM5 domestic minimum charge even when every optional appliance is switched off.';
  }
  updateSceneState();
  if (announce) $('#billTotal').setAttribute('aria-label', `Estimated bill ${currency(b.total)}`);
}

function mutateAppliance(id, mutator) {
  const a = appliances.find(item => item.id === id);
  if (!a) return;
  mutator(a);
  renderAppliances();
  updateBill(true);
}

grid.addEventListener('input', (event) => {
  const id = event.target.dataset.id;
  if (event.target.dataset.action === 'hours') mutateAppliance(id, a => a.hours = Number(event.target.value));
});
grid.addEventListener('change', (event) => {
  const id = event.target.dataset.id;
  if (event.target.dataset.action === 'variant') mutateAppliance(id, a => selectVariant(a, event.target.value));
});
grid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'toggle') mutateAppliance(id, a => a.on = !a.on);
  if (action === 'qty-up') mutateAppliance(id, a => a.qty = Math.min(a.id === 'lights' ? 24 : 6, a.qty + 1));
  if (action === 'qty-down') mutateAppliance(id, a => a.qty = Math.max(1, a.qty - 1));
  if (action === 'stars') mutateAppliance(id, a => a.stars = Number(button.dataset.stars));
});

const presets = {
  careful: { aircon:[5,1], heater:[.35,1], fan:[7,1], lights:[4,7], tv:[2.5,1], pc:[2,1] },
  wfh: { aircon:[9,1], heater:[.6,1], fan:[10,2], lights:[6,9], tv:[4,1], pc:[9,1] },
  hot: { aircon:[13,2], heater:[.7,1], fan:[12,3], lights:[6,10], tv:[5,1], pc:[5,1] }
};
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  appliances = structuredClone(defaults);
  const config = presets[button.dataset.preset];
  Object.entries(config).forEach(([id,[hours,qty]]) => { const a = appliances.find(x => x.id === id); a.hours = hours; a.qty = qty; });
  renderAppliances(); updateBill(true);
}));

$('#resetButton').addEventListener('click', () => { appliances = structuredClone(defaults); afaRate = defaultAfa; $('#afaSlider').value = defaultAfa; baselineBill = null; renderAppliances(); updateAfaLabel(); updateBill(true); });
$('#infoToggle').addEventListener('click', () => { const note = $('#formulaNote'); note.hidden = !note.hidden; $('#infoToggle').setAttribute('aria-expanded', String(!note.hidden)); });
function updateAfaLabel() { $('#afaValue').textContent = `${afaRate >= 0 ? '+' : ''}${afaRate.toFixed(2)} sen/kWh`; }
$('#afaSlider').addEventListener('input', (e) => { afaRate = Number(e.target.value); updateAfaLabel(); updateBill(); });
$('#afaReset').addEventListener('click', () => { afaRate = defaultAfa; $('#afaSlider').value = defaultAfa; updateAfaLabel(); updateBill(); });

function setTime(minute) {
  simMinute = (minute + 1440) % 1440;
  $('#timeSlider').value = Math.round(simMinute);
  const h = Math.floor(simMinute / 60), m = Math.floor(simMinute % 60);
  $('#simTime').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  updateSky();
  updateLiveLoad();
}
$('#timeSlider').addEventListener('input', (e) => setTime(Number(e.target.value)));
$('#playButton').addEventListener('click', () => { playing = !playing; $('#playButton').setAttribute('aria-pressed', String(playing)); $('#playButton').innerHTML = playing ? '<span>Ⅱ</span> Pause' : '<span>▶</span> Simulate a day'; });
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
scene.fog = new THREE.Fog(0x0c261f, 15, 28);
const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
camera.position.set(11, 12, 13); camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xfff2c2, 0x142a26, 2.5));
const sun = new THREE.DirectionalLight(0xffe6a0, 4.2); sun.position.set(7,12,8); sun.castShadow = true; scene.add(sun);
const group = new THREE.Group(); group.rotation.y = -.08; scene.add(group);
const applianceMeshes = new Map();
const roomLights = [];
function box(w,h,d,color,x,y,z, name='', emissive=0x000000) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: .72, emissive, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; if (name) mesh.userData.applianceId = name; group.add(mesh); return mesh;
}
box(13,.3,9,0x24483b,0,-.2,0);
// Room floors and low walls
box(5.8,.12,4.1,0xdacfae,-3,.02,-2.25); box(5.8,.12,4.1,0xb7cfbe,3,.02,-2.25);
box(5.8,.12,4.1,0xd7bb92,-3,.02,2.25); box(5.8,.12,4.1,0xa9c5c7,3,.02,2.25);
box(12,.85,.16,0xf1ead9,0,.55,-4.35); box(.16,.85,8.7,0xf1ead9,-6,.55,0); box(.16,.85,8.7,0xf1ead9,6,.55,0); box(12,.85,.16,0xf1ead9,0,.55,4.35);
box(.14,.55,8.5,0x5e796f,0,.4,0); box(11.8,.55,.14,0x5e796f,0,.4,0);
// Furniture and appliances; restrained, toy-like geometry
box(3.1,.65,1.4,0x48665c,-3,.42,3.0); box(1.2,.38,1.2,0xf4c84a,-3,.26,1.8); // sofa/table
const tv = box(1.7,1.05,.16,0x101916,-5.1,.75,1.3,'tv',0xf4c84a); applianceMeshes.set('tv', tv);
box(3.2,.55,2.2,0xe8dfca,3,.34,2.55); box(3.2,.16,.22,0x7e9b91,3,1.05,3.58); // bed
const ac = box(1.55,.48,.42,0xe9eee8,4.5,1.15,.5,'aircon',0x78d9ff); applianceMeshes.set('aircon', ac);
box(4.8,.68,.72,0x536e61,-3,.43,-3.2); // kitchen bench
const fridge = box(1.15,2.2,1.0,0xdce5df,-5.0,1.17,-2.1,'fridge',0x8ae6bd); applianceMeshes.set('fridge', fridge);
const freezer = box(1.25,.8,.9,0xcddbd5,-4.0,.5,-3.15,'freezer',0x78d9ff); applianceMeshes.set('freezer', freezer);
const rice = box(.65,.6,.65,0xf0eee5,-2.8,.92,-3.15,'rice',0xf4c84a); applianceMeshes.set('rice', rice);
const kettle = box(.42,.62,.42,0x25362f,-1.75,.92,-3.15,'kettle',0xff7a3d); applianceMeshes.set('kettle', kettle);
const microwave = box(.8,.48,.52,0x2e4039,-.85,.9,-3.15,'microwave',0xff7a3d); applianceMeshes.set('microwave', microwave);
const oven = box(.9,1.0,.7,0x27362f,-1.3,.54,-2.0,'oven',0xff7a3d); applianceMeshes.set('oven', oven);
const hood = box(1.4,.25,.62,0xb9c9c1,-2.3,1.75,-3.1,'hood',0xf4c84a); applianceMeshes.set('hood', hood);
box(2.3,.7,.65,0x3c5b51,3,.45,-3.25); // desk
const pc = box(.85,1.15,.65,0x151e1b,4.8,.62,-3.0,'pc',0x8ae6bd); applianceMeshes.set('pc', pc);
const washer = box(1.1,1.15,1.0,0xe4ebe5,1.15,.62,-2.85,'washer',0x78d9ff); applianceMeshes.set('washer', washer);
const dryer = box(1.1,1.15,1.0,0xcfd9d2,2.45,.62,-2.85,'dryer',0xff7a3d); applianceMeshes.set('dryer', dryer);
const iron = box(.62,.24,.3,0xe8ddd0,3.45,.84,-3.25,'iron',0xff7a3d); iron.rotation.y = -.28; applianceMeshes.set('iron', iron);
const heater = box(.56,1.1,.5,0xe7e3d6,5.25,.75,-1.3,'heater',0xff7a3d); applianceMeshes.set('heater', heater);
const router = box(.58,.16,.42,0x182520,2.1,.86,-3.25,'router',0x8ae6bd); applianceMeshes.set('router', router);
const ev = box(2.7,.58,1.35,0x315f55,3.4,.05,5.05,'ev',0x8ae6bd); applianceMeshes.set('ev', ev);
box(.56,.44,.38,0xf4c84a,5.1,.22,4.7); // wallbox
// bulbs/fans as interactive tokens
[[-3,2.1,2.2],[3,2.1,2.2],[-3,2.1,-2.2],[3,2.1,-2.2]].forEach((p,i)=>{ const bulb = new THREE.PointLight(0xffcc55,0,4); bulb.position.set(...p); group.add(bulb); roomLights.push(bulb); const orb = new THREE.Mesh(new THREE.SphereGeometry(.13,12,12), new THREE.MeshBasicMaterial({color:0xf4c84a})); orb.position.set(...p); orb.userData.applianceId='lights'; group.add(orb); if(i===0) applianceMeshes.set('lights',orb); });
const fan = new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.08,16), new THREE.MeshStandardMaterial({color:0x304f45})); fan.position.set(-2.7,2.05,1.9); fan.userData.applianceId='fan'; group.add(fan); applianceMeshes.set('fan',fan);
const powerHub = new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.16,18), new THREE.MeshStandardMaterial({color:0xf4c84a,emissive:0xf4c84a,emissiveIntensity:1.5}));
powerHub.position.set(0,.22,0); group.add(powerHub);
const energyFlows = [];
applianceMeshes.forEach((mesh,id) => {
  const start = new THREE.Vector3(0,.24,0);
  const end = mesh.position.clone(); end.y = Math.max(.24,end.y*.62);
  const mid = new THREE.Vector3(end.x,.24,0);
  const curve = new THREE.CatmullRomCurve3([start,mid,end]);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), new THREE.LineBasicMaterial({color:0xf4c84a,transparent:true,opacity:.08}));
  group.add(line);
  const pulses = [0,.5].map(offset => { const orb=new THREE.Mesh(new THREE.SphereGeometry(.075,10,10),new THREE.MeshBasicMaterial({color:0xffe888,transparent:true,opacity:.95})); orb.visible=false; group.add(orb); return {orb,offset}; });
  energyFlows.push({id,curve,line,pulses});
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.MeshStandardMaterial({color:0x0b1d18,roughness:1})); ground.rotation.x=-Math.PI/2; ground.position.y=-.38; ground.receiveShadow=true; scene.add(ground);
const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color:0x9ee8ca,size:.06,transparent:true,opacity:0}));
const starData=[]; for(let i=0;i<220;i++) starData.push((Math.random()-.5)*30,Math.random()*12+3,(Math.random()-.5)*22); stars.geometry.setAttribute('position',new THREE.Float32BufferAttribute(starData,3)); scene.add(stars);

function isActiveAtTime(a) {
  if (!a.on) return false;
  const hour = simMinute / 60;
  if (a.hours >= 23.9) return true;
  const end = (a.start + a.hours) % 24;
  if (a.start + a.hours < 24) return hour >= a.start && hour < end;
  return hour >= a.start || hour < end;
}
function updateLiveLoad() {
  const active = appliances.filter(isActiveAtTime);
  const kw = active.reduce((sum,a) => sum + wattsFor(a) * a.qty * a.duty, 0) / 1000;
  $('#liveLoad').textContent = `${kw.toFixed(2)} kW`;
  $('#activeCount').textContent = `${active.length} appliance${active.length === 1 ? '' : 's'} running`;
  energyFlows.forEach(flow => {
    const on = active.some(a => a.id === flow.id);
    flow.line.material.opacity = on ? .42 : .045;
    flow.pulses.forEach(p => p.orb.visible = on);
  });
}
function updateSceneState() {
  appliances.forEach(a => {
    const mesh = applianceMeshes.get(a.id);
    if (mesh?.material?.emissive) mesh.material.emissiveIntensity = isActiveAtTime(a) ? .9 : (a.on ? .16 : 0);
    if (mesh) mesh.scale.y = a.on ? 1.04 : 1;
  });
  const lightsOn = appliances.find(a=>a.id==='lights')?.on;
  roomLights.forEach(light => light.intensity = lightsOn && (simMinute/60 > 17 || simMinute/60 < 6) ? 8 : 0);
  updateLiveLoad();
}
function updateSky() {
  const hour = simMinute/60;
  const daylight = Math.max(0, Math.sin(((hour-6)/12)*Math.PI));
  const bg = new THREE.Color().lerpColors(new THREE.Color(0x071612), new THREE.Color(0x5c9e92), daylight*.72);
  renderer.setClearColor(bg,1); scene.fog.color.copy(bg);
  sun.intensity = .8 + daylight*3.8; stars.material.opacity = 1-daylight;
  roomLights.forEach(light => light.intensity = appliances.find(a=>a.id==='lights')?.on && daylight < .25 ? 8 : 0);
}

const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
function hitFromEvent(event) {
  const rect = canvas.getBoundingClientRect(); pointer.x=((event.clientX-rect.left)/rect.width)*2-1; pointer.y=-((event.clientY-rect.top)/rect.height)*2+1; raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObjects(group.children,false).find(hit=>hit.object.userData.applianceId);
}
canvas.addEventListener('pointermove', e => {
  const hit=hitFromEvent(e), tip=$('#sceneTooltip');
  if(!hit){tip.classList.remove('show'); return;}
  const a=appliances.find(x=>x.id===hit.object.userData.applianceId); tip.textContent=`${a.name} · ${a.on?'ON':'OFF'}`; const rect=$('#sceneWrap').getBoundingClientRect(); tip.style.left=`${e.clientX-rect.left}px`; tip.style.top=`${e.clientY-rect.top}px`; tip.classList.add('show');
});
canvas.addEventListener('pointerleave',()=>$('#sceneTooltip').classList.remove('show'));
canvas.addEventListener('click', e => { const hit=hitFromEvent(e); if(hit) mutateAppliance(hit.object.userData.applianceId,a=>a.on=!a.on); });

function resize() {
  const rect=canvas.getBoundingClientRect(); renderer.setSize(rect.width,rect.height,false); const aspect=rect.width/rect.height; const view=7.2; camera.left=-view*aspect; camera.right=view*aspect; camera.top=view; camera.bottom=-view; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
function animate(now) {
  requestAnimationFrame(animate);
  if(playing){ setTime(simMinute+(now-lastFrame)*.02*simSpeed); }
  lastFrame=now;
  const fanA=appliances.find(a=>a.id==='fan'); if(fanA && isActiveAtTime(fanA)) fan.rotation.y += .07;
  energyFlows.forEach((flow,flowIndex) => flow.pulses.forEach(p => {
    if (!p.orb.visible) return;
    const progress = (now*.00034*(1+Math.min(simSpeed,8)*.06) + p.offset + flowIndex*.083) % 1;
    p.orb.position.copy(flow.curve.getPoint(progress));
    const pulse = .72 + Math.sin(now*.012 + flowIndex)*.24;
    p.orb.scale.setScalar(pulse);
  }));
  appliances.forEach((a,index) => {
    const mesh=applianceMeshes.get(a.id); if(!mesh) return;
    if(mesh.userData.baseY===undefined) mesh.userData.baseY=mesh.position.y;
    const active=isActiveAtTime(a);
    mesh.position.y=mesh.userData.baseY+(active?Math.sin(now*.004+index)*.025:0);
    if(active && mesh.material?.emissive) mesh.material.emissiveIntensity=.72+Math.sin(now*.006+index)*.24;
  });
  if(isActiveAtTime(appliances.find(a=>a.id==='tv'))) tv.material.emissiveIntensity=.55+Math.random()*.55;
  powerHub.rotation.y += .012;
  powerHub.scale.setScalar(.94+Math.sin(now*.006)*.08);
  renderer.render(scene,camera);
}

function registerWebMcp() {
  const context=document.modelContext; if(!context?.registerTool) return;
  const tool={
    name:'configure_household_energy', title:'Configure household energy',
    description:'Set appliance usage, product size and energy-star rating in the visible RumahWatt simulation and return the updated monthly kWh and Malaysian bill estimate.',
    inputSchema:{type:'object',properties:{appliances:{type:'array',items:{type:'object',properties:{id:{type:'string'},hoursPerDay:{type:'number',minimum:0,maximum:24},quantity:{type:'integer',minimum:1,maximum:24},enabled:{type:'boolean'},variant:{type:'string'},stars:{type:'integer',minimum:1,maximum:5}},required:['id'],additionalProperties:false}},afaSenPerKwh:{type:'number',minimum:-10,maximum:10}},additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input){
      if(!input || typeof input!=='object') throw new Error('Input must be an object.');
      if(input.afaSenPerKwh!==undefined){ if(!Number.isFinite(input.afaSenPerKwh)||input.afaSenPerKwh < -10||input.afaSenPerKwh > 10) throw new Error('AFA must be between -10 and 10 sen/kWh.'); afaRate=input.afaSenPerKwh; $('#afaSlider').value=afaRate; updateAfaLabel(); }
      if(input.appliances){ for(const update of input.appliances){ const a=appliances.find(x=>x.id===update.id); if(!a) throw new Error(`Unknown appliance id: ${update.id}`); if(a.alwaysOn && update.enabled===false) throw new Error(`${a.name} represents the unavoidable connected-home baseline and cannot be switched off.`); if(update.hoursPerDay!==undefined) a.hours=update.hoursPerDay; if(update.quantity!==undefined) a.qty=update.quantity; if(update.enabled!==undefined) a.on=update.enabled; if(update.stars!==undefined){ if(!a.stars) throw new Error(`${a.name} does not use the star-rating control.`); a.stars=update.stars; } if(update.variant!==undefined && !selectVariant(a, update.variant)) throw new Error(`Unknown ${a.name} variant: ${update.variant}`); } }
      renderAppliances(); updateBill(true); const bill=calculateBill(); return {monthlyKwh:Number(bill.kwh.toFixed(1)),estimatedBillRm:Number(bill.total.toFixed(2)),protected:bill.protectedUser};
    }
  };
  try { void Promise.resolve(context.registerTool(tool)).catch(()=>{}); } catch {}
}

renderAppliances(); updateAfaLabel(); updateBill(); setTime(simMinute); registerWebMcp(); resize(); animate(performance.now());
