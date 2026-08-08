/* app-2027.js — map, animation, interaction, sky view */
(() => {
  const T_START = -2.5, T_END = 2.5;            // animation window (TDT hours from t0)
  const $ = (id) => document.getElementById(id);

  /* ---------- map ---------- */
  const map = L.map('map', { worldCopyJump: true, minZoom: 2 })
    .setView([33, 3], 4);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 12
  }).addTo(map);

  /* ---------- draw path of totality (built from the forward model) ---------- */
  const band = Eclipse.pathBand(1.5);
  if (band.center.length) {
    L.polygon(band.north.concat(band.south.slice().reverse()), {
      color: '#ff6b6b', weight: 1, fillColor: '#ff6b6b', fillOpacity: 0.18
    }).addTo(map).bindTooltip('Path of totality — anywhere inside sees a TOTAL eclipse', { sticky: true });
    L.polyline(band.center.map(p => [p.lat, p.lon]),
      { color: '#ffd9a0', weight: 1.5, dashArray: '4 5' }).addTo(map)
      .bindTooltip('Central line — longest totality', { sticky: true });
  }

  /* ---------- moving shadow ---------- */
  const umbra = L.circle([0, 0], { radius: 1, color: '#ff5252', weight: 2,
    fillColor: '#1a0000', fillOpacity: 0.55, interactive: false });
  const penumbra = L.circle([0, 0], { radius: 1, color: '#5b8cff', weight: 1,
    fillColor: '#5b8cff', fillOpacity: 0.07, interactive: false });

  function drawShadow(t) {
    const c = Eclipse.shadowCenterAt(t);
    if (c && c.sunAlt > -2) {
      penumbra.setLatLng([c.lat, c.lon]).setRadius(Math.min(c.penumbraRadiusKm, 4000) * 1000).addTo(map);
      umbra.setLatLng([c.lat, c.lon]).setRadius(Math.max(8, Math.min(c.umbraRadiusKm, 400)) * 1000).addTo(map);
    } else {
      map.removeLayer(umbra); map.removeLayer(penumbra);
    }
  }

  /* ---------- clock ---------- */
  function utcMsFromT(t) { return Eclipse.t0UTCms + (t * 3600 - Eclipse.DELTA_T) * 1000; }
  function tzOffset() { return parseFloat($('tz').value) || 0; }
  function tzName() { const o = $('tz').selectedOptions[0]; return o.dataset.name || 'UTC'; }
  const hhmm = (d) => d.toUTCString().slice(17, 22);
  function fmtTime(date, withSec) {
    if (!date) return '—';
    const d = new Date(date.getTime() + tzOffset() * 3600000);
    const s = d.toUTCString().slice(17, withSec ? 25 : 22);
    return s;
  }
  function updateClock(t) {
    const d = new Date(utcMsFromT(t));
    $('clockUTC').textContent = hhmm(d);
    const loc = new Date(d.getTime() + tzOffset() * 3600000);
    $('clockLocal').textContent = hhmm(loc) + ' ' + tzName();
  }

  /* ---------- animation ---------- */
  let cur = 0.11, playing = false, last = 0;
  function setT(t, fromSlider) {
    cur = Math.max(T_START, Math.min(T_END, t));
    if (!fromSlider) $('timeSlider').value = Math.round((cur - T_START) / (T_END - T_START) * 1000);
    drawShadow(cur);
    updateClock(cur);
  }
  function frame(ts) {
    if (!playing) return;
    if (!last) last = ts;
    const dtReal = (ts - last) / 1000; last = ts;
    const speed = parseFloat($('speed').value);     // eclipse-seconds per real-second
    let nt = cur + speed * dtReal / 3600;
    if (nt >= T_END) { nt = T_START; }
    setT(nt);
    requestAnimationFrame(frame);
  }
  $('playBtn').onclick = () => {
    playing = !playing;
    $('playBtn').textContent = playing ? '❚❚' : '▶';
    $('playBtn').classList.toggle('playing', playing);
    $('playBtn').setAttribute('aria-pressed', String(playing));
    $('playBtn').setAttribute('aria-label', playing ? 'Pause eclipse animation' : 'Play eclipse animation');
    last = 0;
    if (playing) requestAnimationFrame(frame);
  };
  $('timeSlider').oninput = (e) => {
    if (playing) $('playBtn').click();
    setT(T_START + e.target.value / 1000 * (T_END - T_START), true);
  };
  $('speed').onchange = () => { last = 0; };

  /* ---------- location selection ---------- */
  let marker = null, sunArrow = null, selected = null, skyRange = null;
  const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const compass16 = (deg) => COMPASS[Math.round(deg / 22.5) % 16];

  function drawSunArrow(lat, lon, c) {
    if (sunArrow) { sunArrow.remove(); sunArrow = null; }
    if (!c) return;
    const az = c.sunAzMax, faded = c.sunUp ? '' : ' faded';
    const icon = L.divIcon({
      className: '', iconSize: [0, 0], iconAnchor: [0, 0],
      html: `<div class="sunarrow${faded}" style="transform:rotate(${az}deg)">` +
            `<div class="sa-line"></div><div class="sa-head"></div>` +
            `<div class="sa-sun">☀</div></div>`
    });
    sunArrow = L.marker([lat, lon], { icon, interactive: true, keyboard: false })
      .addTo(map)
      .bindTooltip(`Sun is ${compass16(az)} (${az.toFixed(0)}°), ${c.sunAltMax.toFixed(0)}° up` +
                   (c.sunUp ? '' : ' — below horizon'), { direction: 'top', offset: [0, -10] });
  }
  function autoTz(lat, lon) {                 // pick a sensible display timezone
    let idx = 0;                              // UTC
    if ((lat > 35 && lat < 44.5 && lon > -10 && lon < 5) ||
        (lat > 54 && lat < 58.5 && lon > 7 && lon < 16)) idx = 1;        // Spain/Denmark CEST +02
    else if (lat > 49 && lat < 61 && lon > -11 && lon < 3) idx = 2;     // UK BST +01
    else if (lat > 20 && lat < 37.5 && lon > -18 && lon < -1) idx = 3;  // Portugal/Morocco +01
    else if (lat > 18 && lat < 38 && lon >= -1 && lon < 20) idx = 4;    // Algeria/Tunisia +01
    else if (lat > 10 && lat < 34 && lon >= 20 && lon < 58) idx = 5;    // Egypt/Arabia +03
    $('tz').selectedIndex = idx;
  }
  function selectLocation(lat, lon, name) {
    lat = +lat; lon = +lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      $('loc-name').textContent = 'Enter valid coordinates';
      return false;
    }
    autoTz(lat, lon);
    $('latIn').value = lat.toFixed(3); $('lonIn').value = lon.toFixed(3);
    $('loc-name').textContent = name || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    if (marker) marker.remove();
    marker = L.marker([lat, lon]).addTo(map);

    const c = Eclipse.localCircumstances(lat, lon);
    selected = { lat, lon, c };
    renderInfo(c);
    drawSunArrow(lat, lon, c);
    marker.bindPopup(popupHTML(name, c)).openPopup();

    // sky slider range: partial window if available
    if (c && c.c1UTC && c.c4UTC) {
      skyRange = [c.c1UTC.getTime(), c.c4UTC.getTime()];
      $('skySlider').value = 500; renderSky();
    } else { skyRange = null; drawSkyEmpty(); }
    updateClock(cur);                 // refresh master clock label for new tz
    return true;
  }

  function renderInfo(c) {
    const v = $('verdict');
    if (!c) {
      v.className = 'verdict none';
      v.innerHTML = 'No eclipse is visible from this location.';
      ['obsc','mag','c1','c2','max','c3','c4','dur','alt','az'].forEach(k => $('r-' + k).textContent = '—');
      if (sunArrow) { sunArrow.remove(); sunArrow = null; }
      return;
    }
    const pct = (c.obscuration * 100);
    if (c.isTotal) {
      v.className = 'verdict total';
      v.innerHTML = `<span class="big">🌑 TOTAL eclipse</span>` +
        `The Sun is <strong>100% covered</strong> for ` +
        `<strong>${fmtDur(c.totalityDurationSec)}</strong> of totality.` +
        (c.sunUp ? '' : ' <em>(Sun below horizon — not visible here.)</em>');
    } else {
      v.className = 'verdict partial';
      v.innerHTML = `<span class="big">${pct.toFixed(1)}% partial</span>` +
        `A partial eclipse — at maximum the Moon covers <strong>${pct.toFixed(1)}%</strong> of the Sun's area.` +
        (c.sunUp ? '' : ' <em>(Sun below horizon — not visible here.)</em>');
    }
    $('r-obsc').textContent = pct.toFixed(1) + '%';
    $('r-mag').textContent = c.magnitude.toFixed(3);
    $('r-c1').textContent = fmtTime(c.c1UTC);
    $('r-c2').textContent = c.c2UTC ? fmtTime(c.c2UTC, true) : '—';
    $('r-max').textContent = fmtTime(c.tMaxUTC, true);
    $('r-c3').textContent = c.c3UTC ? fmtTime(c.c3UTC, true) : '—';
    $('r-c4').textContent = fmtTime(c.c4UTC);
    $('r-dur').textContent = c.isTotal ? fmtDur(c.totalityDurationSec) : '— (partial only)';
    $('r-alt').textContent = c.sunAltMax.toFixed(1) + '°' + (c.sunUp ? '' : ' (below horizon)');
    $('r-az').textContent = `${compass16(c.sunAzMax)} (${c.sunAzMax.toFixed(0)}°)`;
  }

  function popupHTML(name, c) {
    if (!c) return `<b>${name || 'Location'}</b><br>No eclipse visible.`;
    if (c.isTotal)
      return `<b>${name || 'Location'}</b><br>🌑 <b>Total eclipse</b><br>` +
        `Totality begins: <b>${fmtTime(c.c2UTC, true)}</b><br>` +
        `Duration: <b>${fmtDur(c.totalityDurationSec)}</b><br>` +
        `Partial starts ${fmtTime(c.c1UTC)} · ends ${fmtTime(c.c4UTC)}`;
    return `<b>${name || 'Location'}</b><br>🌒 <b>${(c.obscuration*100).toFixed(1)}% partial</b><br>` +
      `Max eclipse: <b>${fmtTime(c.tMaxUTC, true)}</b><br>` +
      `Partial starts ${fmtTime(c.c1UTC)} · ends ${fmtTime(c.c4UTC)}`;
  }

  const fmtDur = (s) => {
    s = Math.round(s); const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
  };

  /* ---------- sky view ---------- */
  const cv = $('sky'), cx = cv.getContext('2d');
  function drawSkyEmpty() {
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.font = '13px sans-serif';
    cx.fillStyle = '#8a96b4'; cx.textAlign = 'center';
    cx.fillText('Select a location', cv.width / 2, cv.height / 2);
    $('sky-time').textContent = '—'; $('sky-cov').textContent = '—';
  }
  function renderSky() {
    if (!selected || !selected.c || !skyRange) return drawSkyEmpty();
    const tms = skyRange[0] + ($('skySlider').value / 1000) * (skyRange[1] - skyRange[0]);
    const g = Eclipse.skyGeometry(selected.lat, selected.lon, tms);
    const W = cv.width, H = cv.height, cxp = W / 2, cyp = H / 2;
    cx.clearRect(0, 0, W, H);

    // darkness of sky scales with coverage
    const dark = g.obscuration;
    cx.fillStyle = `rgba(2,4,10,${0.2 + 0.8 * dark})`;
    cx.fillRect(0, 0, W, H);

    const scale = 95 / g.Rsun;          // px per Earth-radius unit
    const sunR = 95, moonR = g.Rmoon * scale;
    const mx = cxp + g.u * scale, my = cyp - g.v * scale;

    // corona hint near/at totality
    if (g.obscuration > 0.97) {
      const cr = cx.createRadialGradient(cxp, cyp, sunR * 0.9, cxp, cyp, sunR * 2.2);
      cr.addColorStop(0, 'rgba(255,250,235,0.55)'); cr.addColorStop(1, 'rgba(255,250,235,0)');
      cx.fillStyle = cr; cx.beginPath(); cx.arc(cxp, cyp, sunR * 2.2, 0, 7); cx.fill();
    }
    // Sun
    const sg = cx.createRadialGradient(cxp, cyp, 10, cxp, cyp, sunR);
    sg.addColorStop(0, '#fff7e0'); sg.addColorStop(.7, '#ffcf52'); sg.addColorStop(1, '#ff9d2e');
    cx.fillStyle = sg; cx.beginPath(); cx.arc(cxp, cyp, sunR, 0, 7); cx.fill();
    // Moon
    cx.fillStyle = '#05070f'; cx.beginPath(); cx.arc(mx, my, moonR, 0, 7); cx.fill();

    const d = new Date(tms + tzOffset() * 3600000);
    $('sky-time').textContent = d.toUTCString().slice(17, 25) + ' ' + tzName();
    $('sky-cov').textContent = g.sunAlt < 0 ? 'Sun below horizon'
      : (g.obscuration * 100).toFixed(1) + '% covered';
  }
  $('skySlider').oninput = renderSky;

  /* ---------- wire up controls ---------- */
  map.on('click', (e) => selectLocation(e.latlng.lat, e.latlng.lng));
  $('goBtn').onclick = () => selectLocation($('latIn').value, $('lonIn').value);
  document.querySelectorAll('.quick button').forEach(b =>
    b.onclick = () => { selectLocation(b.dataset.lat, b.dataset.lon, b.dataset.name);
      map.setView([+b.dataset.lat, +b.dataset.lon], 6); });
  $('tz').onchange = () => { if (selected) renderInfo(selected.c); updateClock(cur); renderSky(); };

  /* ---------- featured totality locations ---------- */
  // Starting points for exploration; durations are computed live by the model.
  // These are not endorsements—access, safety, horizon and forecasts must be checked.
  const FEATURED_SITES_2027 = [
    { n: 'Tarifa (Cádiz)', la: 36.014, lo: -5.605, note: 'Southern-Spain base near the Strait; check local access and horizon' },
    { n: 'Gibraltar', la: 36.141, lo: -5.354, note: 'Inside the totality path; check local access and viewing arrangements' },
    { n: 'Algeciras (Cádiz)', la: 36.141, lo: -5.456, note: 'Bay of Gibraltar city; check horizon, access and forecast' },
    { n: 'Cádiz', la: 36.527, lo: -6.289, note: 'Coastal city within the totality band' },
    { n: 'Estepona (Málaga)', la: 36.428, lo: -5.146, note: 'Costa del Sol location within the totality band' },
    { n: 'Marbella (Málaga)', la: 36.510, lo: -4.886, note: 'Costa del Sol location within the totality band' },
    { n: 'Málaga', la: 36.721, lo: -4.422, note: 'Close to the northern limit; duration is highly location-sensitive' },
    { n: 'Ceuta', la: 35.889, lo: -5.321, note: 'Near the central path on the North African coast' },
    { n: 'Tangier (Morocco)', la: 35.759, lo: -5.834, note: 'Near the central path across the Strait' },
    { n: 'Oran (Algeria)', la: 35.697, lo: -0.633, note: 'Near the central path in north-west Algeria' },
    { n: 'Luxor (Egypt)', la: 25.687, lo: 32.640, note: 'Near the global maximum-duration region' }
  ];
  const bestLayer = L.layerGroup().addTo(map);
  const chipRow = $('bestChips');
  FEATURED_SITES_2027.forEach(s => {
    const c = Eclipse.localCircumstances(s.la, s.lo);
    const dur = c && c.isTotal ? fmtDur(c.totalityDurationSec) : '—';
    const nameStar = s.n;
    const go = () => { selectLocation(s.la, s.lo, nameStar); map.setView([s.la, s.lo], 9); };
    L.marker([s.la, s.lo], {
      title: `Featured eclipse location: ${s.n}`,
      alt: `Featured eclipse location: ${s.n}`,
      icon: L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<div class="site-star">★</div>' })
    }).addTo(bestLayer)
      .bindTooltip(`★ <b>${nameStar}</b> — ${dur} totality<br><span style="color:#8a96b4">${s.note}</span>`,
                   { direction: 'top', offset: [0, -6] })
      .on('click', go);
    const b = document.createElement('button');
    b.textContent = s.n.replace(/\s*\(.*\)/, '');
    b.title = `${s.note} · ${dur} totality`;
    b.onclick = go;
    chipRow.appendChild(b);
  });
  $('bestToggle').onchange = (e) => { e.target.checked ? bestLayer.addTo(map) : bestLayer.remove(); };

  /* ---------- partial-eclipse reference cities ---------- */
  const REFERENCE_CITIES_2027 = [
    { n: 'Pamplona, Spain', la: 42.8125, lo: -1.6458 },
    { n: 'London, UK', la: 51.5074, lo: -0.1278 },
    { n: 'Copenhagen, Denmark', la: 55.6761, lo: 12.5683 }
  ];
  const referenceLayer = L.layerGroup().addTo(map);
  REFERENCE_CITIES_2027.forEach(city => {
    const c = Eclipse.localCircumstances(city.la, city.lo);
    const summary = c ? `${(c.obscuration * 100).toFixed(1)}% of the Sun covered at maximum` : 'Eclipse not visible';
    const go = () => { selectLocation(city.la, city.lo, city.n); map.setView([city.la, city.lo], 6); };
    L.marker([city.la, city.lo], {
      title: `Partial-eclipse reference city: ${city.n}`,
      alt: `Partial-eclipse reference city: ${city.n}`,
      icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8],
        html: '<div class="city-dot"></div>' })
    }).addTo(referenceLayer)
      .bindTooltip(`<b>${city.n}</b><br><span style="color:#8a96b4">${summary}</span>`,
                   { direction: 'top', offset: [0, -6] })
      .on('click', go);
  });

  /* ---------- start ---------- */
  drawSkyEmpty();
  setT(0.11);
  selectLocation(36.014, -5.605, 'Tarifa, Spain');
})();
