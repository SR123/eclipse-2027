const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const Eclipse = require('./eclipse-2027.js');
const root = __dirname;

test('uses the official 2027 reference epoch and delta T', () => {
  assert.equal(new Date(Eclipse.t0UTCms).toISOString(), '2027-08-02T10:00:00.000Z');
  assert.equal(Eclipse.DELTA_T, 71.7);
});

test('matches the NASA central-path sample near the Strait at 08:48 UT', () => {
  const c = Eclipse.localCircumstances(35 + 43.1 / 60, -(5 + 0.6 / 60));
  const nasaSample = Date.parse('2027-08-02T08:48:00Z');
  assert.equal(c.isTotal, true);
  assert.ok(Math.abs(c.tMaxUTC.getTime() - nasaSample) < 45_000);
  assert.ok(c.totalityDurationSec > 285 && c.totalityDurationSec < 305);
});

test('covers southern Spain and distinguishes total from partial locations', () => {
  const tarifa = Eclipse.localCircumstances(36.014, -5.605);
  const malaga = Eclipse.localCircumstances(36.721, -4.422);
  const seville = Eclipse.localCircumstances(37.389, -5.984);
  assert.equal(tarifa.isTotal, true);
  assert.ok(tarifa.totalityDurationSec > 270);
  assert.equal(malaga.isTotal, true);
  assert.ok(malaga.totalityDurationSec > 100);
  assert.equal(seville.isTotal, false);
  assert.ok(seville.obscuration > 0.98);
});

test('reproduces NASA peak magnitude and near-maximum duration', () => {
  const greatestEclipse = Eclipse.localCircumstances(25 + 30.3 / 60, 33 + 11 / 60);
  const luxor = Eclipse.localCircumstances(25.687, 32.640);
  assert.ok(Math.abs(greatestEclipse.magnitude - 1.0790) < 0.0001);
  assert.equal(luxor.isTotal, true);
  assert.ok(luxor.totalityDurationSec > 380);
});

test('includes Pamplona, London and Copenhagen as partial-eclipse references', () => {
  const cities = [
    ['Pamplona', 42.8125, -1.6458, 0.75],
    ['London', 51.5074, -0.1278, 0.40],
    ['Copenhagen', 55.6761, 12.5683, 0.20]
  ];
  for (const [, lat, lon, minimumObscuration] of cities) {
    const c = Eclipse.localCircumstances(lat, lon);
    assert.equal(c.isTotal, false);
    assert.ok(c.obscuration > minimumObscuration);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app-2027.js'), 'utf8');
  for (const [name] of cities) {
    assert.match(html, new RegExp(name));
    assert.match(app, new RegExp(name));
  }
});

test('keeps the 2027 project names separate from the 2026 app', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /2 August 2027/);
  assert.match(html, /eclipse-2027\.js/);
  assert.match(html, /app-2027\.js/);
  assert.match(html, /styles-2027\.css/);
  assert.doesNotMatch(html, /SE2026Aug12|eclipse-2026/);
});
