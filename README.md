# House bookings on Cloudflare

One page (`index.html`) plus one Pages Function (`functions/api/[[path]].js`) that stores everything in a D1 database. Everyone who opens the site sees the same houses, trips, and bookings.

## Files

    index.html                  the whole app
    functions/api/[[path]].js   the shared database API (D1)

## Deploy

1. Put both files in a GitHub repository, keeping the folder layout above.
2. In the Cloudflare dashboard, go to **Workers & Pages** and create a Pages project. Choose **Connect to Git** and pick the repository. Leave the build command empty and the output directory as the repo root (`/`).
3. Create a D1 database (**Storage & databases**, then **D1**). Any name works, for example `house-bookings`. Do not create any tables. The function creates its table on the first request.
4. Open the Pages project, then **Settings**, then **Bindings**. Add a **D1 database** binding. Set the variable name to exactly `DB` and select the database you just made. Add it for Production, and for Preview too if you want preview deployments to work.
5. Redeploy (Deployments, then Retry deployment, or push a commit). Bindings only apply to new deployments.

Open the site. If the grey notice about "this browser only" is gone, the database is connected.

Dashboard drag-and-drop upload cannot deploy a `functions` folder. Use the Git route above, or run `npx wrangler pages deploy .` from this folder.

## Notes

- Nothing requires a sign-in. Anyone with the site address can add, change, and delete data, which matches the earlier version. If you want a gate, Cloudflare Access can sit in front of the Pages project without any code changes.
- Opening `index.html` straight from your computer, or hosting it somewhere without the function (GitHub Pages, for example), still works, but saves only in that browser.
- The page re-checks the database every 15 seconds, and again just before saving a booking.
