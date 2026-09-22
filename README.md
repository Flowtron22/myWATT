# myWATT???

An interactive household electricity-planning sandbox by Ureka Games for Peninsular Malaysia. Configure appliances and routines, simulate a billing month, compare Domestic General with Time of Use, and explore how usage changes the estimated bill.

## Run locally

The current browser build is in `dist/` and has no compilation step.

```powershell
python -m http.server 8080 --directory dist
```

Then open `http://localhost:8080`.

## Deploy on Vercel

Import this GitHub repository into Vercel. The included `vercel.json` sets `dist/` as the static output directory, so the Framework Preset can remain **Other** and no build command is required.

See [`updates.md`](updates.md) for the current feature summary.
