# The Marbling Atelier

A paper-marbling simulator set in a bookbinder's atelier. You float colours on a bath of size, draw them through with stylus and comb, then lay down a sheet. Methods and patterns follow the Suminagashi, Ebru and European marblers.

Everything is in a single HTML page with no build step to run it. Open `index.html` in a current browser with WebGL 2 (Chrome, Firefox, Edge or Safari 15+).

## What you can do

- **Work the bath by hand.** Seven tools: drop brush, whisk, stylus, combs, curl, fan (breath) and turpentine. Hold the drop brush down and the drop spreads wider.
- **Choose from a rack of nine combs.** Nonpareil (3 mm), fine, Dutch wide, rake, single tine, bouquet rake, serpentine, bird-wing, and one you set yourself (spacing, reach, waves, tines evenly spaced, in pairs or in threes). Hovering shows where the comb will start and stop. Click to pull it, or drag to pull it by hand.
- **Mix colours from historical palettes.** Eight suites with period pigment names, plus clear water and bronze. You can grind your own colours.
- **Change the conditions.** Ox gall and the body of the size affect your next pass. Edge pooling and grain change the bath straight away. The sheet settings (laid, wove, kozo or blue sugar paper; alum; the Spanish shift; drag on lifting; air pockets; age and foxing; burnishing) show in the proof.
- **Work a pattern from the book.** 25 recipes, each worked step by step with captions:
  - **Japan:** Suminagashi.
  - **Persia and the Ottomans:** Abrī, Battal, Gelgit, Taraklı, Şal, Bülbül yuvası, Hatip, Papatya.
  - **Europe:** Turkish, Old Dutch, Nonpareil, Bouquet, Peacock, French Curl, Spanish, French Shell, Stormont, Gloster, Italian, Gold Vein, Zebra, Fountain, Serpentine, Schrottel, Antique Spot.
- **Generate a random plate**, or enter your own bath in the pattern book under a name.
- **Step through history.** A slider steps back through every pass, with undo and redo along it. Starting work from an earlier point sets the later passes aside.
- **Lay down a sheet.** It hangs on a drying line. Open it to see it bound as half-leather book boards, save it as a 2400 × 1600 PNG, or return that bath to the trough.
- **Studio mode** (`F`) fills the screen with the bath.
- **A guided first plate** walks through throwing, gel-git, combing, laying down and binding.

### Keyboard

| Keys | Action |
| --- | --- |
| `D` `W` `S` `C` `R` `B` `T` | Drop brush, whisk, stylus, combs, curl, fan, turpentine |
| `1`–`9`, `0` | Colour pots in order; `0` is clear water |
| Arrow keys | Turn the comb |
| `Ctrl`/`Cmd` + `Z`, with `Shift` | Undo, redo |
| `[` `]` | Step back and forward through history |
| `P` | Switch between the bath and the proof |
| `F`, `Esc` | Enter and leave studio mode |
| `L` | Lay down a sheet |

## How the bath works

The simulation follows *Mathematical Marbling* by Shufeng Lu, Aubrey Jaffer and colleagues (IEEE Computer Graphics and Applications, 2012). Every action on the bath is a map of the plane that can be undone exactly:

- **Drop** of radius *r* at *C*: each point *P* moves to *C* + (*P* − *C*)·√(1 + *r*² / |*P* − *C*|²).
- **Tine line**: points move along the line by *z*·*u*<sup>*d*</sup>, where *d* is the distance from the line. A comb sums the nearest tines. A waved comb wraps the tine map in a sine shear, which keeps it exactly invertible.
- **Curl**: a rotation whose angle falls off with distance from the centre.
- **Stylus and fan**: the wake of a pin, modelled as a divergence-free dipole so colour flows around the pin instead of piling up. It is inverted by fixed-point iteration.

A WebGL 2 fragment shader traces each pixel backwards through the stored history until it lands inside the drop that put colour there. Lines stay sharp however often they are combed, and undo is exact. Long histories are baked into a texture in chunks so drawing stays fast.

## Project layout

```
index.html              the standalone page (built)
dist/artifact.html      the same page as published as a Claude artifact (built)
build.py                assembles both from src/
src/head.html           title and fonts
src/page.css            styles
src/page.html           markup
src/js/01-engine.js     the bath: stroke records, shader, renderer, history
src/js/02-recipes.js    colour suites, the pattern book, random plates
src/js/03-bench.js      pots, bench tabs, sliders, views, studio mode
src/js/04-player-history.js   working recipes step by step, undo, redo, history slider
src/js/05-tools.js      the tools, the comb rack, pointer handling, previews
src/js/06-sheets-book-guide.js   laying down sheets, specimens, the pattern book, keys, the guided plate
```

Edit the files in `src/`, then rebuild:

```bash
python3 build.py
```

Sheets on the drying line and your own recipes are kept in the browser's local storage, so they stay on the device where you made them.

## Sources

- Richard J. Wolfe, *Marbled Paper: Its History, Techniques and Patterns*, University of Pennsylvania Press, 1990
- Einen Miura, *The Art of Marbled Paper*, 1989
- Shufeng Lu, Aubrey Jaffer et al., *Mathematical Marbling*, IEEE CG&A, 2012
- [Aubrey Jaffer, Mathematics of Marbling](https://people.csail.mit.edu/jaffer/Marbling/Mathematics)
- [University of Washington Libraries, Decorated Paper: marbled patterns](https://content.lib.washington.edu/dpweb/patterns.html)
- [Paper marbling, Wikipedia](https://en.wikipedia.org/wiki/Paper_marbling)

## Licence

MIT. See [LICENSE](LICENSE).
