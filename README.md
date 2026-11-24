# Daily Ledger — Personal Expense & Credit Tracker

A mobile-friendly, private expense tracker that runs directly in Chrome and can be hosted on **GitHub Pages**. No server, subscription, account, or external library is required.

## Features

- Track money **spent** and **received**, including the date, name/place, Cash or GPay, category, and an optional note.
- Browse by month, search your entries, and edit or delete past entries.
- Monthly income, spending, net movement, category breakdown, and recent activity.
- **Credits:** separately track money you lent or borrowed, including partial repayments and remaining balances.
- Download **one Excel workbook per year**, with an Overview tab, 12 monthly tabs (January–December), a Credits tab, and a Repayments tab. The `.xlsx` file is generated locally in the browser.
- Export and import a full `.json` backup. Switch displayed currency between INR, AUD, and USD (no currency conversion).
- Mobile-responsive dark theme, inspired by the supplied reference.

## Quick start

1. Download and unzip `daily-ledger-github-pages.zip`.
2. Open `index.html` in Chrome (or another modern browser). Add an entry.
3. Use **Excel & backup** to download a spreadsheet or back up the app.

## Hosting on GitHub Pages

1. Sign in at https://github.com and create a new repository (for example, `daily-ledger`).
2. Upload all four files (`index.html`, `styles.css`, `app.js`, `xlsx-lite.js`) to the repository's **root**, not a folder. `README.md` is optional.
3. Go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. After publishing, the URL should look like `https://YOUR-USERNAME.github.io/daily-ledger/`.

For a repository named `YOUR-USERNAME.github.io`, the URL can be `https://YOUR-USERNAME.github.io/` instead.

## Important privacy and storage details

**All records stay in the browser's `localStorage` for the exact website address.** GitHub Pages only serves the application files; it does not store or synchronize the entries.

- Your records are not automatically shared with GitHub, other browsers, your laptop, or a different phone.
- A private/incognito tab, clearing browser/site data, or changing your site URL can make saved data unavailable.
- Regularly download the full `.json` backup and keep it somewhere safe.
- To transfer data, open the app on the new device, select **Excel & backup → Restore from a backup**, and choose the `.json` file. Restoring replaces existing browser data.
- **Excel export is for reporting; JSON backup is for restoring the app.** Excel files cannot be re-imported.
- Credits are excluded from the ordinary income/expense/net calculations to avoid counting loans as earnings or purchases. They appear in dedicated Excel tabs.
- Currency selection changes labels and symbols only. It does not exchange or convert values.

## Files

- `index.html` — app structure.
- `styles.css` — responsive styles.
- `app.js` — app logic, browser storage, and interface.
- `xlsx-lite.js` — self-contained Excel writer (Office Open XML `.xlsx`; no CDN dependency).

## Notes

- Best used through a hosted HTTPS URL; works on Chrome for desktop and mobile.
- This static GitHub Pages version is intended for one browser/device at a time. Cross-device automatic synchronization would require a database and authentication service.
- No financial information is sent to any external server by the app.
