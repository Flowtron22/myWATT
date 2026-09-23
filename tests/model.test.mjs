import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applianceEnergyForDays,
  calculateBill,
  integrateSimulationInterval,
  isActiveAtTime,
  isProtectionConfigCurrent,
  tariffConfig,
  wattsFor
} from '../dist/model.js';

const state = { daysAtHome:30, daysPerMonth:30, representativeWeekdays:22 };
const appliance = (overrides = {}) => ({ id:'test', watts:1000, hours:1, qty:1, duty:1, on:true, included:true, start:14, daysPerWeek:7, ...overrides });
const bill = (kwh, useTou = false, split = { peakKwh:0, offpeakKwh:kwh }, afaRate = 3.67) => calculateBill({ kwh, useTou, split, afaRate });

test('zero usage produces a zero bill', () => assert.equal(bill(0).total, 0));
test('protection changes only above 800 kWh', () => {
  assert.equal(bill(800).protectedUser, true);
  assert.equal(bill(801).protectedUser, false);
});
test('high-use energy rate begins above 1,500 kWh', () => {
  assert.equal(bill(1500).generalRate, tariffConfig.rates.generalLow);
  assert.equal(bill(1501).generalRate, tariffConfig.rates.generalHigh);
});
test('negative AFA is represented as a rebate for unprotected usage', () => assert.ok(bill(900, false, { peakKwh:0, offpeakKwh:900 }, -5).afa < 0));
test('days-per-week affects monthly energy', () => {
  const fiveDays = appliance({ daysPerWeek:5 });
  assert.equal(applianceEnergyForDays(fiveDays, state), 30 * 5 / 7);
});
test('product label watts override estimated appliance wattage', () => {
  assert.equal(wattsFor(appliance({ watts:800, customWatts:1234 })), 1234);
});
test('annual label energy overrides watts and hours for the monthly estimate', () => {
  const labelled = appliance({ watts:5000, hours:24, customAnnualKwh:1200 });
  assert.equal(applianceEnergyForDays(labelled, state), 100);
});
test('days-per-week also affects live scheduled state', () => {
  const threeDays = appliance({ daysPerWeek:3 });
  assert.equal(isActiveAtTime(threeDays, 14 * 60 + 30, 3), true);
  assert.equal(isActiveAtTime(threeDays, 14 * 60 + 30, 4), false);
});
test('simulation integration splits weekday peak and weekend energy', () => {
  const alwaysOn = appliance({ hours:24, start:0 });
  const weekday = integrateSimulationInterval([alwaysOn], { startDay:1, startMinute:14*60, durationMinutes:60 });
  const weekend = integrateSimulationInterval([alwaysOn], { startDay:6, startMinute:14*60, durationMinutes:60 });
  assert.ok(Math.abs(weekday.totalKwh - 1) < 1e-9);
  assert.ok(Math.abs(weekday.peakKwh - 1) < 1e-9);
  assert.ok(Math.abs(weekend.offpeakKwh - 1) < 1e-9);
});
test('simulation integration reports energy for each active appliance', () => {
  const interval = integrateSimulationInterval([
    appliance({ id:'large', watts:1000, hours:24, start:0 }),
    appliance({ id:'small', watts:250, hours:24, start:0 }),
    appliance({ id:'off', watts:5000, hours:24, start:0, on:false })
  ], { startDay:1, startMinute:0, durationMinutes:60 });
  assert.ok(Math.abs(interval.applianceKwh.large - 1) < 1e-9);
  assert.ok(Math.abs(interval.applianceKwh.small - .25) < 1e-9);
  assert.equal(interval.applianceKwh.off, undefined);
  assert.ok(Math.abs(interval.totalKwh - 1.25) < 1e-9);
});
test('overnight schedules remain active across midnight after the final scheduled day', () => {
  const overnight = appliance({ start:22, hours:4, daysPerWeek:1 });
  assert.equal(isActiveAtTime(overnight, 23*60, 1), true);
  assert.equal(isActiveAtTime(overnight, 60, 2), true);
  assert.equal(isActiveAtTime(overnight, 3*60, 2), false);
});
test('temporary protection configuration has an explicit expiry', () => {
  assert.equal(isProtectionConfigCurrent(new Date(2026, 8, 23)), true);
  assert.equal(isProtectionConfigCurrent(new Date(2027, 0, 1)), false);
});
