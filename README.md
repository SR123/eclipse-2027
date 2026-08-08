# Total Solar Eclipse — 2 August 2027 · Interactive Explorer

A separate, local-first interactive web app for exploring the **total solar eclipse of
2 August 2027**, with a particular focus on **southern Spain**. Click anywhere on the map
to calculate local eclipse circumstances, or animate the Moon's shadow along the path.

## Published project

- Repository: <https://github.com/SR123/eclipse-2027>
- GitHub Pages: <https://sr123.github.io/eclipse-2027/>

The existing `eclipse-2026` project is not modified by this app.

## Features

- Interactive Leaflet map with the computed totality band, central line, umbra and penumbra.
- Quick picks and featured locations in Cádiz and Málaga provinces, Gibraltar, Ceuta,
  Morocco, Algeria and Egypt, plus partial-eclipse reference markers for Pamplona,
  London and Copenhagen.
- Local C1, C2, maximum, C3 and C4 times; totality duration; obscuration and magnitude.
- Sun altitude and direction at maximum eclipse.
- Scrubbable, to-scale Sun/Moon disk view.
- Display time zones for Spain, Portugal/Morocco, Algeria/Tunisia and Egypt/Arabia.

## Astronomy model

The browser calculates circumstances from the official NASA/GSFC Besselian elements for
the 2 August 2027 eclipse. The reference epoch is 10:00:00 TDT and ΔT is 71.7 seconds.
The same forward model drives the map path and all location read-outs.

NASA reports greatest eclipse at 10:06:37.7 UT, magnitude 1.0790, and a greatest duration
of 6m 23.2s. Values at the very edge of the totality path are especially sensitive to
coordinates and to the limits of polynomial-element calculations, so critical travel
plans should always be checked against an official source.

## Running locally

There is no build step. From this folder, run:

```bash
python3 -m http.server 8128
```

Then open <http://localhost:8128/>.

## Files

| File | Purpose |
|---|---|
| `index.html` | 2027 page structure and southern-Spain location controls |
| `styles-2027.css` | Distinct 2027 visual theme |
| `eclipse-2027.js` | Besselian-element eclipse calculations |
| `app-2027.js` | Map, animation, interaction and sky view |
| `tests.test.js` | Model and project-separation checks |

## Credits and data

- [NASA/GSFC Besselian elements](https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2027Aug02Tbeselm.html)
- [NASA/GSFC path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html)
- Map tiles: © OpenStreetMap contributors, © CARTO
- Map library: [Leaflet](https://leafletjs.com/)

## License

MIT — see [LICENSE](LICENSE).
