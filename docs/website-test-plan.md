# Prime Hospitality — full site test plan

Run this against the local site (`http://localhost:5173`, API on port 5080) after restarting the API so the latest server code is loaded. Repeat the guest paths on the live site once the API is deployed and `VITE_API_URL` points at it.

Use a short stay (2–3 nights) at least 30 days ahead. Cancel every test reservation in Kwentra when you finish. Do not leave a hold on production tenant 87.

Payment is still mock until the Paymob Integration ID is set and `PAYMENT_PROVIDER=paymob`. A mock payment must still walk the same screens.

## 1. Catalog comes from the Kwentra room rack

- [ ] Open `/search`. Count the stays. Only room types that are on the Kwentra room rack are public. Inventory-only types stay hidden (Superior 1 Bedroom, Superior 1 Bedroom Deluxe, 2 Bedroom Apartment Deluxe).
- [ ] Each card shows a title, property, guest count, and a photo. A type with no rate shows no invented price.
- [ ] Open Admin → Sync. Run a sync. The status line reports availability as refreshed room types over expected room types, and it is not zero when Kwentra is up.
- [ ] After the sync, reload `/search`. A type that is on the rack is still listed. A type that is not on the rack is still absent.
- [ ] Home featured stays are a subset of those same public types, in the homepage order, not a different set of units.

## 2. Availability

- [ ] Open a type that Kwentra still has rooms for (for example 1 bedroom Apartment). The calendar loads. Nights with rooms left can be selected. They are not hatched.
- [ ] Open a type that is sold out on known nights (1 bedroom Deluxe Apt. Double has been sold out on short near-term windows). Those nights are hatched and cannot be the check-in, and a range that includes one of them cannot be confirmed.
- [ ] Checkout morning of a sold-out night is allowed when the previous night is free. The guest is not charged for the departure morning.
- [ ] The calendar covers the coming 12 months, not only the next few weeks.
- [ ] Change nothing and wait. A second look at the same listing does not blank the calendar if Kwentra is slow. Previously loaded blocked nights stay until a newer answer arrives.
- [ ] After a successful hold, those nights close for the next guest (hatched, or the booking is refused). Cancel the hold in Kwentra and confirm the nights open again after the next sync, or immediately if the webhook fires.

## 3. Prices and guest counts

- [ ] Nightly prices in the calendar match the Kwentra website rate for 2 adults. A night with no rate row has no price, and the booking must not invent one.
- [ ] The guest stepper only offers adult/child pairs Kwentra allows for that room type. A pair that is not in the occupancy set cannot be submitted.
- [ ] Adding a child changes the quote when the rate grid has a child amount. It does not change which nights are blocked.
- [ ] A type whose card price is $0 (no 2-adult row) can still be opened. Choosing dates must not produce a payable total out of nothing. The stay is refused or the price stays empty.

## 4. Search, home, and listing

- [ ] Home hero advances slides. Search from the hero opens `/search` with the destination, dates, and guests you entered.
- [ ] Filter by destination, then by property. The list shrinks to that property. Clear filters and the full rack list returns.
- [ ] Sort by price and by bedrooms. The order changes. Recommended puts featured stays first.
- [ ] Guest filter hides types whose maximum is below the party size.
- [ ] Open a stay from a card. The title, gallery, amenities, map (only after “show map”), and similar stays for the same property render.
- [ ] Hover a card on desktop, then click it. The listing appears without a long blank wait. The calendar and price still load from the API, not from a stale copy of another unit.
- [ ] Wishlist saves and removes a stay, and `/wishlist` shows it after refresh.
- [ ] Arabic toggle flips the page to RTL. Arabic text uses the Kufi font. Switch back to English. Layout returns to LTR.
- [ ] On a narrow window, the listing page shows the bottom book bar. Book opens the same popup as the desktop button.

## 5. Reservation — happy path

Do this on one bookable type that has a real nightly price and free nights.

- [ ] Book now. The popup steps are stay → rate → guests → review → pay. You can move back without losing the dates.
- [ ] Blocked nights cannot be selected. A stay shorter than the rate’s minimum is rejected on the rate step.
- [ ] Guest step requires a name, email, and phone. The agreement must be ticked before review can submit.
- [ ] Submit. Kwentra accepts the stay before any payment screen. The reservation in Kwentra is ON_HOLD when hold-until-paid is on, and it is not confirmed yet.
- [ ] The payment step stays inside the popup. The guest is not sent to another website.
- [ ] With the mock provider, complete payment. The success page shows the voucher number. Kwentra then shows the reservation confirmed, and the payment is posted on the cash department for the rate currency (tenant 87: USD department 3, EGP department 2). No card number is stored.
- [ ] Close the popup after the hold is created and before paying, then open Book again on the same listing. The unpaid hold resumes. A second hold is not created.
- [ ] Cancel this reservation in Kwentra when the check is done.

## 6. Reservation — Kwentra says no

- [ ] Pick nights that are already occupied, or a party Kwentra will not accept. Submit. The payment step does not open.
- [ ] The popup shows the problem message and a WhatsApp link that includes the unit and the dates.
- [ ] If the refusal is a date conflict, the calendar refetches and those nights are hatched.
- [ ] No new Kwentra reservation remains for that attempt. If one was created and then rejected, cancel it.

## 7. Payments and the EGP charge

Paymob charges Egyptian pounds only. The stay is still priced in USD. The EGP amount is the USD total multiplied by Kwentra’s USD factor, read again when the booking is created.

- [ ] The header currency control lists the currencies Kwentra returned (EGP, USD, and the others on the currency screen). Switching it changes card prices, the listing price, calendar prices, and the booking total. It does not change which nights are free.
- [ ] A USD price times Kwentra’s USD factor matches the EGP price on screen. Example: if the factor is 56.2, 100 USD displays as 5,620 EGP.
- [ ] On the pay step, the amount to pay is the EGP figure from that booking’s own rate read, with the USD stay total shown beside it. It is not a rate from the browser cache or from another website.
- [ ] After a test booking, the Kwentra payment comment includes the EGP charged and the factor. The folio amount itself stays in the rate currency (USD on the USD cash department).
- [ ] `GET /api/health` reports `paymentProvider`. While the Integration ID is missing, that value is `mock`.
- [ ] Mock pay never redirects. Success still confirms the booking and opens the success page.
- [ ] An abandoned mock payment leaves the hold unpaid. It must not be confirmed.
- [ ] When Paymob is switched on later: the card form loads inside the popup, a declined card does not confirm the stay, and a successful callback to `/api/webhooks/paymob` confirms it once. Repeating the callback does not post a second Kwentra payment.

## 8. Sync and webhooks

- [ ] With the API running, wait for one automatic sync (about 3.5 minutes) without clicking Sync. The log shows availability for the rack room types.
- [ ] Stop Kwentra from being reachable (or use a listing during a failed read). The public calendar keeps the last good blocked nights instead of showing every night as free.
- [ ] Admin sync still pulls units, occupancy, rates, and availability. A failure in one of those does not skip availability.
- [ ] A Kwentra webhook to `/api/webhooks/kwentra` with the configured basic auth updates the affected unit. A request without that auth is rejected.

## 9. Pages that must still work

- [ ] `/`, `/search`, `/compounds`, `/about`, `/faq`, `/contact`, `/owners`, `/careers`, `/terms`, `/privacy`, `/refund-policy`.
- [ ] Contact and partner forms submit and show success, and they do not create a reservation.
- [ ] `/checkout?slug=A_REAL_SLUG&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=2` lands on that listing with the booking popup open and those dates filled in.
- [ ] `/checkout` with no slug goes to search.
- [ ] Admin login, units, bookings list, and the sync page load. Guest pages do not show admin data.

## 10. Load and speed checks

These confirm the smoothness work without changing results.

- [ ] Reload `/search` twice within a few seconds. Both responses list the same stays. A type unpublished in admin can take up to about 15 seconds to leave the public list, then it is gone.
- [ ] Open the same listing twice within a minute. The second open still shows the same blocked nights and the same allowed guest pairs.
- [ ] English homepage does not download the Arabic font files. After switching to Arabic, those files load and the headings render.
- [ ] Book stays inside the popup on a throttled network. The listing itself paints before the payment step code finishes loading.
