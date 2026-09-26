# myWATT??? updates

Last updated: 26 September 2026

Repository: https://github.com/Flowtron22/myWATT

## Real-usage matching

- Replace the old bill comparison fields with a guided "Match my real usage" card beside the estimated bill.
- Accept either total kWh from an electricity bill or two accumulated meter readings from a smart RCCB, home monitor or utility meter.
- Compare measured and simulated energy over the same number of days, show a capped match percentage, and let the user optionally apply the household adjustment.
- Recalculate the full tariff from adjusted kWh instead of scaling the ringgit total, while keeping appliance estimates unchanged.
- Save the optional adjustment with household scenarios and label adjusted results clearly as estimates.

## Rolling energy meter

- Add a mechanical-style kWh meter to the live billing run without extra branding or explanatory text.
- Roll eight digits smoothly as simulated household energy accumulates, including two decimal places for visible low-usage movement.
- Keep the meter synchronized with the existing energy and bill calculation through pause, reset, speed changes, and run completion.
- Scale the digit display for compact phone screens without reducing leaderboard space.
- Keep the appliance catalogue header fixed while its full list scrolls independently, including on short desktop windows and phones.

## Live appliance energy ranking

- Turn the billing run into a live appliance leaderboard that accumulates kWh for every included, switched-on appliance.
- Keep the highest energy consumer at the top with proportional usage bars.
- Use red, green, and blue to distinguish the top three consumers.
- Remove repeated visible headings and explanations from the compact simulation card.
- Overlay the appliance name, accumulated kWh, and estimated RM share directly on each full-width usage bar, without rank numbers or icons.
- Stack accumulated kWh above its smaller RM-share value for faster scanning.
- Show the final appliance breakdown when the selected simulation period completes.
- Prioritize the centered simulation dashboard on small phones, with the day-and-night sky as lightweight atmosphere.

## Broader household appliance catalogue

- Add standing fans with conventional, energy-saving DC, and large-fan choices.
- Add massage chairs, hair dryers, corded and cordless vacuum cleaners, air purifiers, induction cookers, air fryers, and laptop computers.
- Give occasional-use appliances weekly session controls so their estimates reflect routines rather than implying daily continuous use.
- Keep all new appliances optional so existing household setups and bill estimates remain unchanged.

## Current release

myWATT??? is an educational household electricity planning sandbox by Ureka Games for Peninsular Malaysia. It estimates monthly energy use and the current charge using the RP4 domestic tariff model, September 2026 AFA input, and applicable protection rules.

- The header uses the dedicated circular myWATT artwork as its brand mark.
- The simulation scene reserves enough height for the complete live-billing card and its controls.
- Replace the decorative Three.js house with a lightweight day-and-night sky driven by the simulation clock, and center the live meter as the primary visual.
- Let users share or download a focused PNG of the completed meter card, without adding the wider household configuration or bill panel.
- First-time visitors see a concise notice that myWATT??? estimates and simulates energy use and is not an official TNB bill.
- The estimated total keeps a compact simulation disclaimer visible after the welcome notice is dismissed.
- Keep the simulation interface within the myWATT??? royal-blue, warm-yellow, and cream visual theme.

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
- Watch live household demand, accumulated kWh, estimated running bill, time of day, and the clock-driven sky transition.
- Use 1x, 8x, or 24x simulation speed and reset the run at any time.
- Save, reload, delete, and compare household scenarios locally in the browser.
- Compare the estimate with a real bill using actual kWh, amount paid, and billing days.
- Apply the Careful, Work from home, and Hot month presets as starting points.

## Accuracy, reliability and performance

- Use one shared calculation model for the monthly estimate, live load, and animated billing run.
- Respect each appliance's days-per-week schedule during the live simulation and split ToU energy at the exact weekday peak boundary.
- Limit elapsed animation time after a background-tab pause so returning to the page cannot create an unrealistic usage jump.
- Run animation frames only while the billing simulation is active, and resume without catching up missed time after a background-tab pause.
- Update appliance hours without rebuilding the full card grid on every slider movement.
- Show when the temporary 800 kWh protection configuration has expired instead of silently presenting it as current.
- Add automated tests for tariff thresholds, AFA rebates, schedules, overnight operation, ToU splitting, and rule expiry.

## Appliance modelling

- Appliance cards stay in a fixed order while settings are changed.
- Restore optional product-label watts and annual kWh inputs inside “Add more details” for people who know their appliance specifications.
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

The browser build is contained in `dist/` with no external rendering library or build step. Serve `dist/` with any static web server.
