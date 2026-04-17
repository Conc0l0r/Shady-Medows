# Shady Meadows B&B — Bugs & Fixes
## Lab Exercise 3 — CST8334 Software Development

---

## CSS Fixes — `10y2dlg~w2h~y.css`

| # | Bug | Fix Applied |
|---|---|---|
| 1 | `.success` had invalid `margin-left:\"10px\"` with escaped quotes | Changed to `margin-left:10px` |
| 2 | No mobile responsive breakpoints | Added `@media (max-width:768px)` rules |
| 3 | `.booking-card` had `margin-top:-100px` breaking mobile layout | Set to `margin-top:0` on mobile |
| 4 | `.dateWrapper` used `display:block!important` overriding Bootstrap | Removed `!important` |
| 5 | `.hero` had no background-color fallback | Added `background-color:var(--primary)` |

---

## HTML Fixes — `Restful-booker-platform demo.html`

| # | Bug | Fix Applied |
|---|---|---|
| 6 | Hero background image broken locally (absolute server path) | Changed to relative local path |
| 7 | All navbar links pointed to live server URL | Changed to relative anchor links (#rooms, #booking etc.) |
| 8 | Hero "Book Now" button pointed to live server | Changed to `href="#booking"` |
| 9 | Room "Book now" buttons pointed to live server | Changed to `href="#contact"` |
| 10 | Contact form action pointed to live server | Changed to `action="#"` with JS handler |
| 11 | Submit button was `type="button"` — never submitted | Changed to `type="submit"` |
| 12 | No `required` attributes on contact form fields | Added `required`, `minlength`, `pattern`, `placeholder` to all fields |
| 13 | Date inputs were `type="text"` — no date validation | Changed to `type="date"` with dynamic min date |
| 14 | "Check Availability" button had no JS handler | Added `checkAvailability()` with full date validation |
| 15 | Admin panel linked publicly in navbar and footer | Removed admin links from both locations |
| 16 | Fake email `fake@fakeemail.com` exposed | Replaced with `contact@shadymeadowsbnb.com` |
| 17 | Footer social links were dead (`#`) | Left as placeholder (noted as known issue) |
| 18 | No CSRF token, no success/error feedback on contact form | Added CSRF token, success/error alert divs, JS validation |

---

## Files Changed
- `Restful-booker-platform demo_FIXED.html` — fixed HTML
- `Restful-booker-platform demo_files/10y2dlg~w2h~y.css` — fixed CSS

## How to Test
1. Open `Restful-booker-platform demo_FIXED.html` in Chrome
2. Test contact form with empty fields — should show validation errors
3. Test date picker — should not allow past dates
4. Test Check Availability — should validate dates before proceeding
5. Check navbar links — should scroll to sections on the page
6. Check hero image — should load from local files folder
