/* ------------------------------------------------------------------ *
 *  eclipse-2027.js — Total Solar Eclipse of 2027 August 2
 *
 *  Computes local circumstances of the eclipse for any point on Earth
 *  using the standard "Besselian elements" method (Meeus, Astronomical
 *  Algorithms ch. 54 / Espenak), plus the position of the Moon's shadow
 *  on the ground for the animation.
 *
 *  Official polynomial Besselian elements (NASA/GSFC, F. Espenak):
 *  https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2027Aug02Tbeselm.html
 *  Reference time t0 = 2027 Aug 2, 10:00:00 TDT.  ΔT = 71.7 s.
 *
 *  Note: these published polynomial elements are a low-order fit, so at
 *  the very edge of the path of totality (where duration → 0) computed
 *  durations are sensitive and may differ from full-ephemeris sources by
 *  tens of seconds. Timings and central-path values are accurate.
 * ------------------------------------------------------------------ */

const Eclipse = (() => {
  const DEG = Math.PI / 180;
  const R_EARTH_KM = 6378.137;
  const DELTA_T = 71.7;
  const T0_UTC_MS = Date.UTC(2027, 7, 2, 10, 0, 0);

  const E = {
    x:  [-0.019645, 0.5447105, -0.0000444, -0.0000091],
    y:  [0.160063, -0.2111569, -0.0001217, 0.0000037],
    d:  [17.76247, -0.010181, -0.000004],
    l1: [0.530596, 0.0000138, -0.0000128],
    l2: [-0.015464, 0.0000137, -0.0000128],
    mu: [328.42249, 15.002093],
    tanf1: 0.0046064,
    tanf2: 0.0045834,
    tmin: -3.0, tmax: 3.0
  };

  const poly  = (c, t) => c.reduce((s, v, i) => s + v * Math.pow(t, i), 0);
  const dpoly = (c, t) => c.reduce((s, v, i) => i ? s + i * v * Math.pow(t, i - 1) : s, 0);

  function besselAt(t) {
    return {
      x: poly(E.x, t), dx: dpoly(E.x, t),
      y: poly(E.y, t), dy: dpoly(E.y, t),
      d: poly(E.d, t) * DEG, dd: dpoly(E.d, t) * DEG,
      mu: poly(E.mu, t) * DEG, dmu: dpoly(E.mu, t) * DEG,
      l1: poly(E.l1, t), l2: poly(E.l2, t)
    };
  }

  function observerRho(latDeg) {
    const lat = latDeg * DEG;
    const u = Math.atan(0.99664719 * Math.tan(lat));
    return { rsin: 0.99664719 * Math.sin(u), rcos: Math.cos(u) };
  }

  function lensArea(a, b, dst) {
    if (dst >= a + b) return 0;
    if (dst <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2;
    const a2 = a * a, b2 = b * b, d2 = dst * dst;
    const ca = Math.acos((d2 + a2 - b2) / (2 * dst * a));
    const cb = Math.acos((d2 + b2 - a2) / (2 * dst * b));
    return a2 * (ca - Math.sin(2 * ca) / 2) + b2 * (cb - Math.sin(2 * cb) / 2);
  }

  function relAt(t, lonRad, rho) {
    const b = besselAt(t);
    const H = b.mu + lonRad;
    const cosH = Math.cos(H), sinH = Math.sin(H);
    const cosd = Math.cos(b.d), sind = Math.sin(b.d);
    const xi = rho.rcos * sinH;
    const eta = rho.rsin * cosd - rho.rcos * cosH * sind;
    const zeta = rho.rsin * sind + rho.rcos * cosH * cosd;
    const dxi = b.dmu * rho.rcos * cosH;
    const deta = b.dmu * xi * sind - zeta * b.dd;
    const u = xi - b.x, v = eta - b.y;
    return {
      u, v, du: dxi - b.dx, dv: deta - b.dy,
      L1: b.l1 - zeta * E.tanf1, L2: b.l2 - zeta * E.tanf2, zeta
    };
  }

  // Raw circumstances for a location (no formatting). Returns null if no eclipse.
  function rawCirc(latDeg, lonDeg) {
    const lonRad = lonDeg * DEG;
    const rho = observerRho(latDeg);
    let t = 0.11;
    for (let i = 0; i < 30; i++) {
      const r = relAt(t, lonRad, rho);
      const n2 = r.du * r.du + r.dv * r.dv;
      const dt = -(r.u * r.du + r.v * r.dv) / n2;
      t += dt;
      if (Math.abs(dt) < 1e-8) break;
    }
    t = Math.max(E.tmin, Math.min(E.tmax, t));
    const r = relAt(t, lonRad, rho);
    const m = Math.hypot(r.u, r.v);
    const n = Math.hypot(r.du, r.dv);
    const diamCover = (r.L1 - m) / (r.L1 + r.L2);   // crosses 1.0 at totality edge
    if (diamCover <= 0) return null;
    return { t, m, n, L1: r.L1, L2: r.L2, zeta: r.zeta, diamCover, lonRad, rho };
  }

  // Exact contact time: Newton-solve dist(t)² = radius(t)², accounting for the
  // umbra/penumbra radius and the curved relative motion (more accurate than
  // the constant-radius semi-duration estimate). `umbra` => use |L2| else L1.
  function contactTime(tGuess, lonRad, rho, umbra) {
    let t = tGuess;
    for (let i = 0; i < 25; i++) {
      const r = relAt(t, lonRad, rho);
      const L = umbra ? Math.abs(r.L2) : r.L1;
      const eps = 1e-4;
      const r2 = relAt(t + eps, lonRad, rho);
      const L2v = umbra ? Math.abs(r2.L2) : r2.L1;
      const g = r.u * r.u + r.v * r.v - L * L;
      const gp = 2 * (r.u * r.du + r.v * r.dv) - 2 * L * (L2v - L) / eps;
      const dt = g / gp;
      t -= dt;
      if (Math.abs(dt) < 1e-9) break;
    }
    return t;
  }

  function localCircumstances(latDeg, lonDeg) {
    const c = rawCirc(latDeg, lonDeg);
    if (!c) return null;
    const { t, m, n, L1, L2, zeta, diamCover, lonRad, rho } = c;

    const isTotal = L2 < 0 && m < Math.abs(L2);
    const Rsun = (L1 + L2) / 2, Rmoon = (L1 - L2) / 2;
    const obsc = lensArea(Rsun, Rmoon, m) / (Math.PI * Rsun * Rsun);
    const sunAltMax = Math.asin(Math.max(-1, Math.min(1, zeta))) / DEG;

    // Sun azimuth at maximum (compass bearing from North, clockwise).
    // The shadow axis points at the Sun, so its declination d and local
    // hour angle H = mu + lon give the Sun's direction (solar parallax is
    // negligible for an on-map arrow).
    const b = besselAt(t);
    const H = b.mu + lonRad, phi = latDeg * DEG;
    const sunAzMax = ((Math.atan2(Math.sin(H),
        Math.cos(H) * Math.sin(phi) - Math.tan(b.d) * Math.cos(phi)) / DEG) + 180 + 360) % 360;

    // Eclipse magnitude: diameter fraction for partial (<1);
    // Moon/Sun apparent-diameter ratio for total (>1, NASA convention).
    const magnitude = isTotal ? (L1 - L2) / (L1 + L2) : diamCover;

    // rough semi-durations to seed the exact contact solver
    const semi = (L) => (m < L ? Math.sqrt(L * L - m * m) / n : NaN);
    const sP = semi(L1), sT = isTotal ? semi(Math.abs(L2)) : NaN;
    const toUTC = (th) => new Date(T0_UTC_MS + (th * 3600 - DELTA_T) * 1000);

    const c1 = isFinite(sP) ? contactTime(t - sP, lonRad, rho, false) : null;
    const c4 = isFinite(sP) ? contactTime(t + sP, lonRad, rho, false) : null;
    const c2 = isTotal ? contactTime(t - sT, lonRad, rho, true) : null;
    const c3 = isTotal ? contactTime(t + sT, lonRad, rho, true) : null;

    return {
      lat: latDeg, lon: lonDeg,
      magnitude, obscuration: Math.max(0, Math.min(1, obsc)),
      isTotal, sunAltMax, sunAzMax, sunUp: sunAltMax > 0,
      tMaxUTC: toUTC(t),
      c1UTC: c1 != null ? toUTC(c1) : null,
      c4UTC: c4 != null ? toUTC(c4) : null,
      c2UTC: c2 != null ? toUTC(c2) : null,
      c3UTC: c3 != null ? toUTC(c3) : null,
      totalityDurationSec: isTotal ? (c3 - c2) * 3600 : 0,
      partialDurationSec: c1 != null ? (c4 - c1) * 3600 : 0
    };
  }

  function skyGeometry(latDeg, lonDeg, tUTCms) {
    const t = (tUTCms - T0_UTC_MS) / 3600000 + DELTA_T / 3600;
    const rho = observerRho(latDeg);
    const r = relAt(t, lonDeg * DEG, rho);
    const m = Math.hypot(r.u, r.v);
    const Rsun = (r.L1 + r.L2) / 2, Rmoon = (r.L1 - r.L2) / 2;
    const obsc = lensArea(Rsun, Rmoon, m) / (Math.PI * Rsun * Rsun);
    return {
      u: r.u, v: r.v, sep: m, Rsun, Rmoon,
      diamCover: (r.L1 - m) / (r.L1 + r.L2),
      obscuration: Math.max(0, Math.min(1, obsc)),
      sunAlt: Math.asin(Math.max(-1, Math.min(1, r.zeta))) / DEG
    };
  }

  /* ---------------- geographic helpers (for path building) ---------- */
  const D2R = DEG, R2D = 1 / DEG, RG = 6371;
  function dest(lat, lon, brgDeg, distKm) {
    const δ = distKm / RG, θ = brgDeg * D2R, φ1 = lat * D2R, λ1 = lon * D2R;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
                               Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    return [φ2 * R2D, ((λ2 * R2D + 540) % 360) - 180];
  }
  function bearing(a, b) {
    const φ1 = a[0] * D2R, φ2 = b[0] * D2R, Δλ = (b[1] - a[1]) * D2R;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return Math.atan2(y, x) * R2D;
  }

  // Approximate sub-shadow point on a spherical Earth — used only as a
  // starting guess that is then refined with the accurate forward model.
  function shadowGuess(t) {
    const b = besselAt(t);
    const r2 = b.x * b.x + b.y * b.y;
    if (r2 >= 1) return null;
    const zeta = Math.sqrt(1 - r2);
    const cosd = Math.cos(b.d), sind = Math.sin(b.d);
    const phiP = Math.asin(Math.max(-1, Math.min(1, b.y * cosd + zeta * sind)));
    const H = Math.atan2(b.x, zeta * cosd - b.y * sind);
    let lon = ((H - b.mu) / DEG + 540) % 360 - 180;
    const lat = Math.atan(Math.tan(phiP) / 0.99330562) / DEG;
    const sunAlt = Math.asin(zeta) / DEG;
    return { lat, lon, sunAlt,
      umbraRadiusKm: Math.abs(b.l2 - zeta * E.tanf2) * R_EARTH_KM / Math.max(0.12, Math.sin(sunAlt * DEG)),
      penumbraRadiusKm: (b.l1 - zeta * E.tanf1) * R_EARTH_KM / Math.max(0.12, Math.sin(sunAlt * DEG)) };
  }
  // expose for the animation (continuous, good enough for the moving disk)
  function shadowCenterAt(t) { return shadowGuess(t); }

  // Build the path of totality from the forward model so it is fully
  // consistent with the per-location readouts. For each time we locate
  // the central line (minimum axis distance) and the N/S totality limits.
  function pathBand(stepMin = 1.5) {
    const center = [], north = [], south = [];
    for (let t = E.tmin; t <= E.tmax; t += stepMin / 60) {
      const g = shadowGuess(t);
      if (!g || g.sunAlt <= 0) continue;
      // local travel bearing from neighbouring guesses
      const ga = shadowGuess(t + 0.01), gb = shadowGuess(t - 0.01);
      if (!ga || !gb) continue;
      const brg = bearing([gb.lat, gb.lon], [ga.lat, ga.lon]);

      // refine the centre: minimise forward axis-distance m along the perpendicular
      const along = (s) => { const p = dest(g.lat, g.lon, brg + 90, s);
        const c = rawCirc(p[0], p[1]); return { p, m: c ? c.m : 1, c }; };
      let lo = -250, hi = 250;
      for (let i = 0; i < 40; i++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (along(m1).m < along(m2).m) hi = m2; else lo = m1;
      }
      const cs = (lo + hi) / 2;
      const cen = dest(g.lat, g.lon, brg + 90, cs);
      const cc = rawCirc(cen[0], cen[1]);
      if (!cc || cc.L2 >= 0 || cc.m >= Math.abs(cc.L2)) continue;   // no totality
      center.push({ t, lat: cen[0], lon: cen[1] });

      // limits: walk outward to where the eclipse stops being total (diamCover→1)
      const edge = (sign) => {
        let a = 0, bnd = 400;
        for (let i = 0; i < 28; i++) {
          const mid = (a + bnd) / 2;
          const p = dest(cen[0], cen[1], brg + sign * 90, mid);
          const c = rawCirc(p[0], p[1]);
          const total = c && c.L2 < 0 && c.m < Math.abs(c.L2);
          if (total) a = mid; else bnd = mid;
        }
        return dest(cen[0], cen[1], brg + sign * 90, a);
      };
      north.push(edge(-1));
      south.push(edge(1));
    }
    return { center, north, south };
  }

  return { localCircumstances, skyGeometry, shadowCenterAt, pathBand,
           t0UTCms: T0_UTC_MS, DELTA_T, R_EARTH_KM };
})();

if (typeof module !== 'undefined') module.exports = Eclipse;
