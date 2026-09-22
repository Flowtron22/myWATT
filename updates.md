# myWATT??? updates

Last updated: 23 September 2026

Repository: https://github.com/Flowtron22/myWATT

## Current release

myWATT??? is an educational household electricity planning sandbox by Ureka Games for Peninsular Malaysia. It estimates monthly energy use and the current charge using the RP4 domestic tariff model, September 2026 AFA input, and applicable protection rules.

- Refresh the interface and animated house with the myWATT??? royal-blue, warm-yellow, and cream visual theme.

## Mobile household builder

- Refresh the WhatsApp and social-sharing preview with the new myWATT??? artwork.
- Remove appliances that are not part of the household without losing their previous settings.
- Add appliances back from a categorized catalogue.
- Keep duplicated units separate while letting them be removed directly.
- Show a sticky mobile summary with the current bill, monthly kWh and tariff plan.
- Jump from the mobile summary directly to the full bill breakdown.
- Share a branded link preview with editable Open Graph title and description metadata.

## Domestic Time of Use

- Switch between Domestic General and the optional TNB Domestic ToU plan.
- Split scheduled appliance energy between weekday peak hours and off-peak hours.
- Apply the official RP4 peak and off-peak energy rates for homes below or above 1,500 kWh per month.
- Treat 2 PM–10 PM on weekdays as peak; weekdays before 2 PM or after 10 PM and all weekends are off-peak.
- Compare the estimated ToU bill with the General tariff before choosing a plan.
- Use a representative 22-weekday and 8-weekend month when splitting ToU energy.

The estimate is for planning and comparison. It is not an official TNB bill.

## Planning and simulation

- Remove the unsupported RM5 minimum-charge assumption from calculations and bill explanations.
- Rename the main simulator heading to “what's your watt???” and trim two more redundant helper labels.
- Simplify the main workspace by removing repeated helper copy from the hero, simulation, appliance, scenario, and ToU areas.
- Show air-conditioner room floor area in square feet and automatically convert room sizes in older saved scenarios.
- Remove the advanced label-watts and annual-kWh override fields so appliance setup stays approachable.
- Run a visible billing simulation for any number of days at home from 0 to 30, including holidays when selected always-on appliances continue running.
- Watch live household demand, accumulated kWh, estimated running bill, time of day, and animated electricity flow.
- Use 1x, 8x, or 24x simulation speed and reset the run at any time.
- Save, reload, delete, and compare household scenarios locally in the browser.
- Compare the estimate with a real bill using actual kWh, amount paid, and billing days.
- Apply the Careful, Work from home, and Hot month presets as starting points.

## Accuracy, reliability and performance

- Use one shared calculation model for the monthly estimate, live load, and animated billing run.
- Respect each appliance's days-per-week schedule during the live simulation and split ToU energy at the exact weekday peak boundary.
- Limit elapsed animation time after a background-tab pause so returning to the page cannot create an unrealistic usage jump.
- Pause Three.js rendering while the house scene or browser tab is hidden, then resume without catching up missed time.
- Keep duplicated appliances linked to the correct house-scene control after units are added or removed.
- Update appliance hours without rebuilding the full card grid on every slider movement.
- Show when the temporary 800 kWh protection configuration has expired instead of silently presenting it as current.
- Add automated tests for tariff thresholds, AFA rebates, schedules, overnight operation, ToU splitting, and rule expiry.

## Appliance modelling

- Appliance cards stay in a fixed order while settings are changed.
- Everyday inputs include hours per day, days per week, showers per day, loads or sessions per week, and EV kilometres per month.
- Individual units can be duplicated and configured separately.
- Five-star efficiency choices are available for relevant appliances.
- Air conditioners include 1.0 to 3.0 HP sizes, inverter and non-inverter compressors, room size, thermostat setting, and star rating.
- Refrigerators and freezers include common door, capacity, format, and star-rating choices.
- Water purifiers cover passive filters, room-temperature units, cold dispensers, storage hot-and-cold dispensers, instant-heating models, and ionizers without using brand names.
- Other supported loads include water heaters, top- and front-load washing machines, dryers, televisions, fans, lighting, cooking appliances, cooker hoods, irons, routers, desktop PCs with one or two monitors, EV chargers, and background standby loads.

## Bill transparency

- The bill panel shows monthly kWh, charge components, protection status, household score, and the estimated total.
- The AFA control supports what-if testing from a rebate to a surcharge and explains that the official calculation depends on the wider generation mix, contracts, fuel costs, and foreign exchange.
- Source links and an assumptions explanation are included in the interface.

## Repository notes

The browser build is contained in `dist/` and uses Three.js from a CDN. No build step is required to inspect the current version; serve `dist/` with any static web server.
