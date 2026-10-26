/**
 * Guest email — confirmation when a reservation is fully paid/confirmed.
 * Configure SMTP via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (or MAIL_*).
 */

const nodemailer = require('nodemailer');
const { getSite } = require('../lib/cmsStore');

let transporter;
let warnedMissing = false;

function env(name, ...aliases) {
  for (const key of [name, ...aliases]) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function isConfigured() {
  return Boolean(env('SMTP_HOST', 'MAIL_HOST') && env('SMTP_FROM', 'MAIL_FROM', 'SMTP_USER', 'MAIL_USER'));
}

function getTransporter() {
  if (transporter) return transporter;
  const host = env('SMTP_HOST', 'MAIL_HOST');
  if (!host) return null;
  const port = Number(env('SMTP_PORT', 'MAIL_PORT') || 587);
  const user = env('SMTP_USER', 'MAIL_USER');
  const pass = env('SMTP_PASS', 'MAIL_PASS', 'SMTP_PASSWORD', 'MAIL_PASSWORD');
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
  return transporter;
}

function money(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
  } catch {
    return `${n} ${currency || ''}`.trim();
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildConfirmationHtml(booking, business = {}) {
  const name = escapeHtml(booking.primaryGuestName || 'Guest');
  const property = escapeHtml(booking.property || booking.listingTitle || 'Prime stay');
  const destination = escapeHtml(booking.destination || '');
  const room = escapeHtml(booking.roomType || '');
  const rate = escapeHtml(booking.ratePlanName || '');
  const voucher = escapeHtml(booking.voucherNumber || '');
  const brandName = escapeHtml(business.name || 'Prime Hospitality');
  const phone = escapeHtml(business.phoneDisplay || business.phone || '');
  const supportEmail = escapeHtml(business.email || env('SMTP_FROM', 'MAIL_FROM'));
  const total = money(booking.rateAmount ?? booking.amount, booking.rateCurrency || booking.currency);
  const checkIn = booking.checkInTime || '15:00';
  const checkOut = booking.checkOutTime || '12:00';
  const guests = [
    booking.adults ? `${booking.adults} adult${booking.adults === 1 ? '' : 's'}` : null,
    booking.children ? `${booking.children} child${booking.children === 1 ? '' : 'ren'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows = [
    ['Property', property],
    destination ? ['Destination', destination] : null,
    room ? ['Unit type', room] : null,
    ['Arrival', `${formatDate(booking.arrivalDate)} · from ${checkIn}`],
    ['Departure', `${formatDate(booking.departureDate)} · by ${checkOut}`],
    booking.nights ? ['Nights', String(booking.nights)] : null,
    guests ? ['Guests', guests] : null,
    rate ? ['Rate', rate] : null,
    ['Total paid', total],
    voucher ? ['Confirmation no.', voucher] : null,
  ].filter(Boolean);

  const detailRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #E8E2D9;color:#8A8278;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;width:42%;">${label}</td>
        <td style="padding:12px 0;border-bottom:1px solid #E8E2D9;color:#231F20;font-size:15px;text-align:right;font-weight:500;">${value}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Booking confirmed — ${brandName}</title>
</head>
<body style="margin:0;padding:0;background:#F4F0EA;font-family:Georgia,'Times New Roman',serif;color:#231F20;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0EA;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#FFFEFB;border:1px solid #E8E2D9;">
          <tr>
            <td style="background:#231F20;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#C4A574;">Prime Hospitality</p>
              <p style="margin:14px 0 0;font-size:28px;line-height:1.2;color:#FFFEFB;font-weight:400;">You’re booked</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:17px;line-height:1.5;">Dear ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#5C564E;">
                Your stay with ${brandName} is confirmed. We’ve reserved your dates and look forward to welcoming you.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${detailRows}</table>
              <p style="margin:24px 0 0;padding:14px 16px;background:#F7F3ED;border-left:3px solid #C4A574;font-size:13px;line-height:1.55;color:#5C564E;">
                Check-in is from <strong style="color:#231F20;">3:00 PM</strong> and check-out is by <strong style="color:#231F20;">12:00 PM</strong>.
                Any lateness might cause extra charges.
              </p>
              <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#8A8278;">
                Questions? Reply to this email${phone ? ` or call ${phone}` : ''}${supportEmail ? ` · ${supportEmail}` : ''}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#231F20;padding:18px 32px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4A574;">
                Prime stays for Prime customers
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildConfirmationText(booking, business = {}) {
  const brandName = business.name || 'Prime Hospitality';
  return [
    `Dear ${booking.primaryGuestName || 'Guest'},`,
    '',
    `Your stay with ${brandName} is confirmed.`,
    '',
    `Property: ${booking.property || booking.listingTitle || ''}`,
    `Arrival: ${booking.arrivalDate} from ${booking.checkInTime || '15:00'}`,
    `Departure: ${booking.departureDate} by ${booking.checkOutTime || '12:00'}`,
    `Guests: ${booking.adults || 0} adults${booking.children ? `, ${booking.children} children` : ''}`,
    `Stay total: ${money(booking.rateAmount ?? booking.amount, booking.rateCurrency || booking.currency)}`,
    booking.chargeAmount
      ? `Charged: ${money(booking.chargeAmount, booking.chargeCurrency || 'EGP')} at Kwentra's rate (${booking.fxRate})`
      : '',
    booking.voucherNumber ? `Confirmation no.: ${booking.voucherNumber}` : '',
    '',
    'Check-in 3:00 PM · Check-out 12:00 PM. Any lateness might cause extra charges.',
    '',
    '— Prime Hospitality',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Send the branded confirmation email once the booking is fully confirmed (paid).
 * Safe to call repeatedly — skips if SMTP is not configured or email is missing.
 */
async function sendBookingConfirmation(booking) {
  if (!booking?.email) return { sent: false, reason: 'no_email' };
  if (booking.paymentStatus && booking.paymentStatus !== 'paid' && booking.status !== 'confirmed') {
    return { sent: false, reason: 'not_confirmed' };
  }
  if (!isConfigured()) {
    if (!warnedMissing) {
      console.warn('[email] SMTP not configured — guest confirmation emails are skipped');
      warnedMissing = true;
    }
    return { sent: false, reason: 'not_configured' };
  }

  const site = await getSite().catch(() => null);
  const business = site?.business || {};
  const from = env('SMTP_FROM', 'MAIL_FROM') || env('SMTP_USER', 'MAIL_USER');
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: 'no_transport' };

  const subject = `Booking confirmed — ${booking.property || booking.listingTitle || 'Prime Hospitality'}`;
  await transport.sendMail({
    from: `"${business.name || 'Prime Hospitality'}" <${from}>`,
    to: booking.email,
    subject,
    text: buildConfirmationText(booking, business),
    html: buildConfirmationHtml(booking, business),
  });
  return { sent: true };
}

module.exports = {
  isConfigured,
  sendBookingConfirmation,
  buildConfirmationHtml,
};
