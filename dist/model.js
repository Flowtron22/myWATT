export const tariffConfig = Object.freeze({
  version: 'RP4',
  daysPerMonth: 30,
  representativeWeekdays: 22,
  protection: Object.freeze({ thresholdKwh: 800, effectiveFrom: '2026-09-01', effectiveUntil: '2026-12-31' }),
  afa: Object.freeze({ rateSenPerKwh: 3.67, period: 'Sep 2026' }),
  rates: Object.freeze({
    generalLow: .2703,
    generalHigh: .3703,
    peakLow: .2852,
    peakHigh: .3852,
    offpeakLow: .2443,
    offpeakHigh: .3443,
    capacity: .0455,
    network: .1285,
    retail: 10,
    renewableFund: .016,
    serviceTax: .08
  })
});

export const starMultipliers = Object.freeze({ 1: 1.18, 2: 1.09, 3: 1, 4: .91, 5: .82 });

export function wattsFor(appliance) {
  if (Number(appliance.customWatts) > 0) return Math.round(Number(appliance.customWatts));
  const base = appliance.variants
    ? (appliance.variants.find(variant => variant.label === appliance.variant)?.watts ?? appliance.watts)
    : appliance.watts;
  return Math.round(base * (appliance.stars ? starMultipliers[appliance.stars] : 1));
}

export function syncUsageHours(appliance, daysPerMonth = tariffConfig.daysPerMonth) {
  if (appliance.usageMode === 'cycles-per-week') appliance.hours = Math.min(24, (Number(appliance.usesPerWeek) || 0) * (Number(appliance.minutesPerUse) || 0) / 60 / 7);
  if (appliance.usageMode === 'uses-per-day') appliance.hours = Math.min(24, (Number(appliance.usesPerDay) || 0) * (Number(appliance.minutesPerUse) || 0) / 60);
  if (appliance.usageMode === 'ev-distance') {
    const energy = (Number(appliance.kmPerMonth) || 0) * (Number(appliance.kwhPer100km) || 0) / 100 / Math.max(.5, Number(appliance.chargingEfficiency) || .9);
    appliance.hours = Math.min(24, energy / Math.max(.001, wattsFor(appliance) / 1000) / daysPerMonth);
  }
}

export function operatingFactor(appliance) {
  if ((appliance.templateId || appliance.id) !== 'aircon') return appliance.duty;
  const recommendedAreaSqFt = { '1.0 HP':161, '1.5 HP':237, '2.0 HP':323, '2.5 HP':409, '3.0 HP':484 }[appliance.variant] || 237;
  const roomFactor = Math.min(1.3, Math.max(.8, (Number(appliance.roomAreaSqFt) || recommendedAreaSqFt) / recommendedAreaSqFt));
  const temperatureFactor = Math.min(1.3, Math.max(.82, 1 + (24 - (Number(appliance.setpoint) || 24)) * .06));
  return Math.min(1, appliance.duty * roomFactor * temperatureFactor);
}

export function incentiveRate(kwh) {
  const bands = [[200,.25],[250,.245],[300,.225],[350,.21],[400,.17],[450,.145],[500,.12],[550,.105],[600,.09],[650,.075],[700,.055],[750,.045],[800,.04],[850,.025],[900,.01],[1000,.005]];
  return (bands.find(([maximum]) => kwh <= maximum) || [0,0])[1];
}

export function usageDaysFor(appliance, { daysAtHome, daysPerMonth }, requestedDays = null) {
  const baseDays = requestedDays ?? (appliance.awayOn ? daysPerMonth : daysAtHome);
  if (appliance.usageMode || appliance.hours >= 23.9) return baseDays;
  return baseDays * Math.min(7, Math.max(1, Number(appliance.daysPerWeek) || 7)) / 7;
}

export function applianceEnergyForDays(appliance, state, requestedDays = null, includeWhenOff = false) {
  if ((!appliance.included || !appliance.on) && !includeWhenOff) return 0;
  const activeDays = requestedDays ?? (appliance.awayOn ? state.daysPerMonth : state.daysAtHome);
  if (Number(appliance.customAnnualKwh) > 0) return Number(appliance.customAnnualKwh) / 12 * activeDays / state.daysPerMonth * appliance.qty;
  if (appliance.usageMode === 'ev-distance') {
    const fullMonth = (Number(appliance.kmPerMonth) || 0) * (Number(appliance.kwhPer100km) || 0) / 100 / Math.max(.5, Number(appliance.chargingEfficiency) || .9) * appliance.qty;
    return fullMonth * activeDays / state.daysPerMonth;
  }
  return (wattsFor(appliance) / 1000) * appliance.hours * appliance.qty * operatingFactor(appliance) * usageDaysFor(appliance, state, activeDays);
}

export function monthlyKwh(appliances, state) {
  return appliances.reduce((sum, appliance) => sum + applianceEnergyForDays(appliance, state), 0);
}

export function overlapHours(start, duration, windowStart, windowEnd) {
  const normalizedStart = ((Number(start) || 0) % 24 + 24) % 24;
  const safeDuration = Math.min(24, Math.max(0, Number(duration) || 0));
  if (safeDuration >= 24) return windowEnd - windowStart;
  const intervalEnd = normalizedStart + safeDuration;
  let overlap = 0;
  for (const offset of [-24, 0, 24]) {
    const startAt = windowStart + offset;
    const endAt = windowEnd + offset;
    overlap += Math.max(0, Math.min(intervalEnd, endAt) - Math.max(normalizedStart, startAt));
  }
  return Math.min(safeDuration, overlap);
}

export function touEnergySplit(appliances, state, kwhOverride = null) {
  const totalKwh = monthlyKwh(appliances, state);
  const weekdayShare = state.representativeWeekdays / state.daysPerMonth;
  const scheduledPeakKwh = appliances.reduce((sum, appliance) => {
    const energy = applianceEnergyForDays(appliance, state);
    const duration = Math.min(24, Math.max(0, Number(appliance.hours) || 0));
    if (!energy || !duration) return sum;
    const weekdayPeakShare = overlapHours(appliance.start, duration, 14, 22) / duration;
    return sum + energy * weekdayShare * weekdayPeakShare;
  }, 0);
  const requestedKwh = kwhOverride === null ? totalKwh : Math.max(0, Number(kwhOverride) || 0);
  const scale = totalKwh > 0 ? requestedKwh / totalKwh : 0;
  const peakKwh = Math.min(requestedKwh, scheduledPeakKwh * scale);
  return { peakKwh, offpeakKwh: Math.max(0, requestedKwh - peakKwh) };
}

export function calculateBill({ kwh, useTou, split, afaRate, config = tariffConfig }) {
  const highUsage = kwh > 1500;
  const rates = config.rates;
  const generalRate = highUsage ? rates.generalHigh : rates.generalLow;
  const peakRate = highUsage ? rates.peakHigh : rates.peakLow;
  const offpeakRate = highUsage ? rates.offpeakHigh : rates.offpeakLow;
  const energy = useTou ? split.peakKwh * peakRate + split.offpeakKwh * offpeakRate : kwh * generalRate;
  const generationRate = kwh ? energy / kwh : (useTou ? offpeakRate : generalRate);
  const capacity = kwh * rates.capacity;
  const network = kwh * rates.network;
  const incentive = kwh * incentiveRate(kwh);
  const protectedUser = kwh <= config.protection.thresholdKwh;
  const afa = protectedUser ? 0 : kwh * (afaRate / 100);
  const retail = protectedUser ? 0 : rates.retail;
  const kwhChargesAfterDiscount = Math.max(0, energy + capacity + network - incentive);
  const kwtbb = kwh > 300 ? kwhChargesAfterDiscount * rates.renewableFund : 0;
  const taxableShare = protectedUser ? 0 : Math.max(0, kwh - config.protection.thresholdKwh) / kwh;
  const sst = protectedUser ? 0 : ((kwhChargesAfterDiscount + afa) * taxableShare + retail) * rates.serviceTax;
  const subtotal = energy + capacity + network + afa + retail - incentive + kwtbb + sst;
  return { kwh, generationRate, generalRate, peakRate, offpeakRate, peakKwh:split.peakKwh, offpeakKwh:split.offpeakKwh, useTou, energy, capacity, network, incentive, afa, retail, kwtbb, sst, subtotal, total:Math.max(0, subtotal), protectedUser };
}

export function isActiveAtTime(appliance, minute, day = 1) {
  if (!appliance?.included || !appliance.on) return false;
  if (appliance.hours >= 23.9) return true;
  const hour = (((minute % 1440) + 1440) % 1440) / 60;
  const start = ((Number(appliance.start) || 0) % 24 + 24) % 24;
  const duration = Math.max(0, Number(appliance.hours) || 0);
  const end = (start + duration) % 24;
  const overnight = start + duration >= 24;
  const scheduleDay = overnight && hour < end ? Math.max(1, day) - 1 : Math.max(1, day);
  if (!appliance.usageMode) {
    const activeDaysPerWeek = Math.min(7, Math.max(1, Number(appliance.daysPerWeek) || 7));
    const weekdayIndex = ((scheduleDay - 1) % 7 + 7) % 7;
    if (weekdayIndex >= activeDaysPerWeek) return false;
  }
  if (!overnight) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function isTouPeakAt(minute, day = 1) {
  const weekday = ((Math.max(1, day) - 1) % 7) < 5;
  const hour = (((minute % 1440) + 1440) % 1440) / 60;
  return weekday && hour >= 14 && hour < 22;
}

export function liveLoadKwAt(appliances, minute, day = 1) {
  return appliances.filter(appliance => isActiveAtTime(appliance, minute, day)).reduce((sum, appliance) => sum + wattsFor(appliance) * appliance.qty * operatingFactor(appliance), 0) / 1000;
}

export function integrateSimulationInterval(appliances, { startDay, startMinute, durationMinutes }) {
  let day = Math.max(1, startDay);
  let minute = ((startMinute % 1440) + 1440) % 1440;
  let remaining = Math.max(0, durationMinutes);
  let totalKwh = 0;
  let peakKwh = 0;
  let offpeakKwh = 0;
  while (remaining > 1e-9) {
    const step = Math.min(1, remaining, 1440 - minute);
    const sampleMinute = minute + step / 2;
    const energy = liveLoadKwAt(appliances, sampleMinute, day) * step / 60;
    totalKwh += energy;
    if (isTouPeakAt(sampleMinute, day)) peakKwh += energy;
    else offpeakKwh += energy;
    minute += step;
    remaining -= step;
    if (minute >= 1440 - 1e-9) { minute = 0; day += 1; }
  }
  return { totalKwh, peakKwh, offpeakKwh, endDay:day, endMinute:minute };
}

export function isProtectionConfigCurrent(date = new Date(), config = tariffConfig) {
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return localDate >= config.protection.effectiveFrom && localDate <= config.protection.effectiveUntil;
}
