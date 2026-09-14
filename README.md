# نقطة البيع — Store POS IQ

Offline point-of-sale for Iraqi corner shops (دكان / ماركت). Arabic RTL interface, whole-dinar
IQD pricing, barcode scanning with on-the-spot product registration, receipt printing.
Runs on a Windows laptop with no internet; one `.exe` installer, data stored locally in SQLite.

Fork of [tngoman/Store-POS](https://github.com/tngoman/Store-POS) (Electron + React + SQLite).

## What this fork changes

| Area | Original | This fork |
|---|---|---|
| Language | English only | **Arabic (default) + English**, switchable from the sidebar; full RTL layout; bundled Cairo font |
| Currency | 2 decimals, `$`, South-African note shortcuts | **Whole dinars** (`12,500 د.ع`), Western digits, notes 250 · 500 · 1,000 · 5,000 · 10,000 · 25,000 · 50,000, a `000` key on the pad |
| Barcode | none — "scan" matched the internal ID only | **Real `barcode` column** (EAN/UPC), scanner lookup by barcode first, duplicate-barcode guard |
| Unknown barcode at the till | error | **Quick-add modal**: name + price + qty → saved and added to the cart |
| Product form | — | Barcode field first; scanner `Enter` jumps to the name field |
| Receipt | monospace `<pre>` | HTML table, 80 mm thermal layout, Arabic labels, invoice number |
| Sales history | month range | defaults to today, shows the total of the filtered sales |
| Demo data | SA groceries | Iraqi catalog in Arabic with IQD prices and demo barcodes |
| Web testing | Electron only | `npm run dev:web` runs API + UI in a normal browser |

## Quick start (development)

```bash
npm install
npm run dev:web      # API on :8001 + UI on http://127.0.0.1:5173 (browser)
npm run dev          # same, but opens the Electron window
```

Default login: **admin / admin** — change it after first login (الموظفين → تعديل).

First run opens الإعدادات: set the store name, then use «إضافة منتجات تجريبية» to try it with sample data.

## Till shortcuts

| Key | Action |
|---|---|
| **Enter** in the scan box | add scanned / searched item (a USB scanner does this for you) |
| **F2** | open payment |
| **F4** | held sales |
| **Esc** | close payment |
| **Enter** in the tendered box | confirm payment (when enough is tendered) |

## Building the Windows installer

```bash
npm run dist
```

Output: `release/نقطة البيع Setup 2.0.0.exe` (NSIS, x64). Install on the shop laptop; data lives under
`%APPDATA%\store-pos-iq\POS\` (SQLite file + product photos) — back that folder up.

## Hardware

* Any USB barcode scanner in keyboard-wedge mode (the default for almost all of them). No driver, no setup.
* Any 80 mm thermal receipt printer installed as the Windows default printer; the app calls the
  normal print dialog. Set the printer's paper size to 80 mm once.

## Operating modes

`الإعدادات → الجهاز → وضع الجهاز`. Restart after changing.

| Mode | Behavior |
|---|---|
| جهاز مستقل (Standalone) | local API + SQLite on this PC |
| الجهاز الرئيسي (Network Server) | same database, API open on the LAN so other tills can connect |
| جهاز فرعي (Network Terminal) | no local DB; connects to the server's IP |

## Project layout

```text
electron/          Main process + secure preload (window.pos)
server/            Express API, sql.js database, route modules
src/
  i18n.tsx         Arabic / English dictionary + provider (useT)
  money.ts         IQD formatting, note denominations, date formatting
  pages/           Till, Catalog, Sales, Settings, Login
  components/      Payment pad, photo picker, customer select, …
  fonts/           Cairo (bundled, works offline)
scripts/dev-api.mjs  Runs the API without Electron for browser testing
```

## Upstream

Original project and its README: https://github.com/tngoman/Store-POS
