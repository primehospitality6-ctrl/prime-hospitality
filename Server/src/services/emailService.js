/**
 * Guest confirmation email, sent once after payment succeeds.
 * SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (MAIL_* aliases work too).
 */

const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const { getSite, findUnit } = require('../lib/cmsStore');
const { RATE_PLANS, countryName } = require('../lib/pms');

const INK = '#231F20';
const GOLD = '#8C704D';
const GOLD_SOFT = '#BBA27C';
const MUTED = '#6D6E71';
const LINE = '#E6E4E1';
const MIST = '#F4F3F1';
const WHITE = '#FFFFFF';
const FONT = "'Montserrat','Noto Kufi Arabic',Arial,Helvetica,sans-serif";

let transporter;
let warnedMissing = false;

const COPY = {
  en: {
    subject: 'Your stay is confirmed',
    title: "You're booked",
    dear: (name) => `Dear ${name},`,
    lede: 'Your stay with Prime Hospitality is confirmed. We have your dates and look forward to welcoming you.',
    confirmation: 'Confirmation no.',
    preheader: (voucher, arrival) => `Confirmed${voucher ? ` ${voucher}` : ''}. Arrival ${arrival}.`,
    yourStay: 'Your stay',
    property: 'Property',
    destination: 'Destination',
    unit: 'Unit type',
    arrival: 'Arrival',
    departure: 'Departure',
    nights: 'Nights',
    guests: 'Guests',
    guestNames: 'Other guests',
    nationality: 'Nationality',
    rate: 'Rate',
    requests: 'Special requests',
    stayTotal: 'Stay total',
    cardCharged: 'Charged to card',
    houseRules: 'House rules',
    regulations: 'Guest regulations',
    before: 'Before you arrive',
    from: 'from',
    by: 'by',
    adults: (n) => `${n} adult${n === 1 ? '' : 's'}`,
    children: (n) => `${n} child${n === 1 ? '' : 'ren'}`,
    nightCount: (n) => `${n} night${n === 1 ? '' : 's'}`,
    late: 'Check-in is from 3:00 PM and check-out is by 12:00 PM. Any lateness might cause extra charges.',
    id: 'Please bring a valid national ID or passport for every adult guest.',
    freeCancel: 'This rate includes free cancellation. To change or cancel, reply to this email.',
    nonRefund: 'This rate is non-refundable.',
    refundTitle: 'Refund policy',
    refundLink: 'Read the refund policy',
    viewStay: 'View your stay',
    directions: 'Directions',
    address: 'Address',
    questions: 'Questions? Reply to this email',
    orCall: 'or call',
    tagline: 'Prime stays for Prime customers',
  },
  ar: {
    subject: 'تم تأكيد إقامتك',
    title: 'تم الحجز',
    dear: (name) => `عزيزي ${name}،`,
    lede: 'إقامتكم مع برايم هوسبيتاليتي مؤكدة. التواريخ محجوزة ويسعدنا استقبالكم.',
    confirmation: 'رقم التأكيد',
    preheader: (voucher, arrival) => `تم التأكيد${voucher ? ` ${voucher}` : ''}. الوصول ${arrival}.`,
    yourStay: 'تفاصيل الإقامة',
    property: 'العقار',
    destination: 'الوجهة',
    unit: 'نوع الوحدة',
    arrival: 'الوصول',
    departure: 'المغادرة',
    nights: 'الليالي',
    guests: 'الضيوف',
    guestNames: 'أسماء الضيوف الآخرين',
    nationality: 'الجنسية',
    rate: 'التعرفة',
    requests: 'طلبات خاصة',
    stayTotal: 'إجمالي الإقامة',
    cardCharged: 'المبلغ المحصل على البطاقة',
    houseRules: 'قواعد المنزل',
    regulations: 'لائحة الضيوف',
    before: 'قبل الوصول',
    from: 'من',
    by: 'حتى',
    adults: (n) => (n === 1 ? 'بالغ واحد' : `${n} بالغين`),
    children: (n) => (n === 1 ? 'طفل واحد' : `${n} أطفال`),
    nightCount: (n) => (n === 1 ? 'ليلة واحدة' : `${n} ليالٍ`),
    late: 'تسجيل الوصول من 3:00 مساءً والمغادرة حتى 12:00 ظهرًا. أي تأخير قد يترتب عليه رسوم إضافية.',
    id: 'يرجى إحضار بطاقة رقم قومي سارية أو جواز سفر لكل نزيل بالغ.',
    freeCancel: 'هذه التعرفة تشمل إلغاءً مجانيًا. للتعديل أو الإلغاء، يرجى الرد على هذه الرسالة.',
    nonRefund: 'هذه التعرفة غير قابلة للاسترداد.',
    refundTitle: 'سياسة الاسترداد',
    refundLink: 'اقرأ سياسة الاسترداد',
    viewStay: 'عرض الإقامة',
    directions: 'الاتجاهات',
    address: 'العنوان',
    questions: 'للاستفسار، رد على هذه الرسالة',
    orCall: 'أو اتصل على',
    tagline: 'إقامات برايم لعملاء برايم',
  },
};

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
    pool: true,
    maxConnections: 2,
  });
  return transporter;
}

function warm() {
  const transport = getTransporter();
  if (!transport?.verify) return;
  transport.verify().catch((err) => console.warn('[email] mailbox not ready:', err.message));
}

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://prime-hospitality-omega.vercel.app').replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${String(currency || 'USD').toUpperCase()}`;
}

function clock(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

function formatDate(iso, locale) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function imageUrl(listing) {
  for (const image of listing?.images || []) {
    const url = typeof image === 'string' ? image : image?.url || image?.src || '';
    if (/^https:\/\//i.test(url)) return url;
  }
  return '';
}

function ruleLines(rules, locale, maxGuests) {
  return (rules || [])
    .map((rule) => (locale === 'ar' && rule.ar) || rule.en || rule.ar || '')
    .map((text) => String(text).trim())
    .filter((text) => text && (maxGuests || !text.includes('{guests}')))
    .map((text) => text.replace(/\{guests\}/g, String(maxGuests || '')));
}

function plainParagraphs(value) {
  const text = String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function sectionTitle(label, align) {
  return `
    <p style="margin:32px 0 14px;font-family:${FONT};font-size:11px;font-weight:500;letter-spacing:${align === 'right' ? '0' : '0.28em'};text-transform:uppercase;color:${GOLD};text-align:${align};">${escapeHtml(label)}</p>`;
}

function detailRows(rows, align, valueAlign) {
  return rows
    .filter((row) => row && row[1])
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:13px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:12px;font-weight:500;letter-spacing:${align === 'right' ? '0' : '0.08em'};text-transform:uppercase;color:${MUTED};width:42%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:13px 0 13px 16px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;font-weight:400;line-height:1.45;color:${INK};text-align:${valueAlign};vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`
    )
    .join('');
}

function bulletList(items, align) {
  return items
    .map(
      (item) => `
      <tr>
        <td style="width:18px;padding:0 0 12px;vertical-align:top;">
          <div style="width:7px;height:7px;margin-top:7px;background:${GOLD};"></div>
        </td>
        <td style="padding:0 0 12px;font-family:${FONT};font-size:14px;font-weight:400;line-height:1.6;color:${INK};text-align:${align};">${escapeHtml(item)}</td>
      </tr>`
    )
    .join('');
}

function button(href, label, locale) {
  if (!href) return '';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 0;">
      <tr>
        <td bgcolor="${GOLD}" style="background:${GOLD};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:11px;font-weight:500;letter-spacing:${locale === 'ar' ? '0' : '0.22em'};text-transform:uppercase;color:${WHITE};text-decoration:none;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function stayBand(copy, booking, locale) {
  const cells = [
    [copy.arrival, formatDate(booking.arrivalDate, locale), `${copy.from} ${clock(booking.checkInTime || '15:00')}`],
    [copy.nights, booking.nights ? String(booking.nights) : '', ''],
    [copy.departure, formatDate(booking.departureDate, locale), `${copy.by} ${clock(booking.checkOutTime || '12:00')}`],
  ];
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;background:${INK};">
      <tr>
        ${cells
          .map(
            ([label, value, note], index) => `
          <td width="33%" style="padding:18px 10px;text-align:center;${index ? `border-${locale === 'ar' ? 'right' : 'left'}:1px solid rgba(255,255,255,0.12);` : ''}">
            <p style="margin:0;font-family:${FONT};font-size:10px;font-weight:500;letter-spacing:${locale === 'ar' ? '0' : '0.18em'};text-transform:uppercase;color:${GOLD_SOFT};">${escapeHtml(label)}</p>
            <p style="margin:8px 0 0;font-family:${FONT};font-size:16px;font-weight:500;line-height:1.3;color:${WHITE};">${escapeHtml(value)}</p>
            ${note ? `<p style="margin:4px 0 0;font-family:${FONT};font-size:12px;font-weight:300;color:rgba(255,255,255,0.62);">${escapeHtml(note)}</p>` : ''}
          </td>`
          )
          .join('')}
      </tr>
    </table>`;
}

function buildConfirmationHtml(booking, context) {
  const locale = booking.locale === 'ar' ? 'ar' : 'en';
  const copy = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = locale === 'ar' ? 'right' : 'left';
  const valueAlign = locale === 'ar' ? 'left' : 'right';
  const business = context.business || {};
  const name = booking.primaryGuestName || (locale === 'ar' ? 'ضيفنا' : 'Guest');
  const checkIn = clock(booking.checkInTime || '15:00');
  const checkOut = clock(booking.checkOutTime || '12:00');
  const guests = [booking.adults ? copy.adults(Number(booking.adults)) : null, booking.children ? copy.children(Number(booking.children)) : null]
    .filter(Boolean)
    .join(locale === 'ar' ? ' · ' : ' · ');
  const others = (booking.otherGuestNames || []).filter(Boolean).join(locale === 'ar' ? '، ' : ', ');
  const plan = RATE_PLANS.find((item) => item.code === booking.ratePlanCode);
  const rateLabel = [booking.ratePlanName || (locale === 'ar' ? plan?.nameAr : plan?.name), locale === 'ar' ? plan?.descriptionAr : plan?.description]
    .filter(Boolean)
    .join(' — ');
  const stayTotal = money(booking.rateAmount ?? booking.amount, booking.rateCurrency || booking.currency || 'USD');
  const charged = booking.chargeAmount ? money(booking.chargeAmount, booking.chargeCurrency || 'EGP') : '';
  const rows = [
    ['property', booking.property || booking.listingTitle],
    ['destination', booking.destination],
    ['unit', booking.roomType && booking.roomType !== booking.property ? booking.roomType : ''],
    ['arrival', [formatDate(booking.arrivalDate, locale), checkIn ? `${copy.from} ${checkIn}` : ''].filter(Boolean).join(' · ')],
    ['departure', [formatDate(booking.departureDate, locale), checkOut ? `${copy.by} ${checkOut}` : ''].filter(Boolean).join(' · ')],
    ['nights', booking.nights ? copy.nightCount(Number(booking.nights)) : ''],
    ['guests', guests],
    ['guestNames', others],
    ['nationality', countryName(booking.nationality) || booking.nationality],
    ['rate', rateLabel],
    ['requests', booking.notes],
    ['stayTotal', stayTotal],
    ['cardCharged', charged],
  ].map(([key, value]) => [copy[key], value]);

  const phone = business.phoneDisplay || business.phone || '';
  const supportEmail = business.email || 'hello@primehospitality.com';
  const listingHref = booking.slug ? `${siteUrl()}/listings/${encodeURIComponent(booking.slug)}` : '';
  const refundHref = `${siteUrl()}/refund-policy`;
  const photo = context.image || '';
  const rules = context.houseRules || [];
  const regulations = context.guestRegulations || [];
  const refund = context.refundParagraphs || [];
  const cancelLine = plan && plan.refundable === false ? copy.nonRefund : copy.freeCancel;

  const detail = rows.filter((row) => row[1] && ![copy.arrival, copy.departure, copy.nights].includes(row[0]));
  const logo = `${siteUrl()}/brand/logo-light.png`;
  const where = [booking.property, booking.destination, business.address].filter(Boolean).join(', ');
  const mapHref = where ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}` : '';
  const preheader = copy.preheader(booking.voucherNumber || '', formatDate(booking.arrivalDate, locale));

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&family=Noto+Kufi+Arabic:wght@300;400;500&display=swap" rel="stylesheet" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${MIST};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MIST};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${WHITE};border:1px solid ${LINE};">
          <tr>
            <td bgcolor="${INK}" style="background:${INK};padding:36px 32px 32px;text-align:center;">
              <img src="${escapeHtml(logo)}" alt="Prime Hospitality" width="196" style="display:block;width:196px;max-width:70%;height:auto;margin:0 auto;border:0;" />
              <div style="width:42px;height:1px;margin:22px auto 0;background:${GOLD};"></div>
              <p style="margin:18px 0 0;font-family:${FONT};font-size:32px;font-weight:300;line-height:1.2;color:${WHITE};">${escapeHtml(copy.title)}</p>
              <p style="margin:8px 0 0;font-family:${FONT};font-size:14px;font-weight:300;color:rgba(255,255,255,0.7);">${escapeHtml(name)}</p>
            </td>
          </tr>
          ${
            booking.voucherNumber
              ? `<tr>
            <td style="padding:26px 32px 0;text-align:center;">
              <p style="margin:0;font-family:${FONT};font-size:11px;font-weight:500;letter-spacing:${locale === 'ar' ? '0' : '0.32em'};text-transform:uppercase;color:${MUTED};">${escapeHtml(copy.confirmation)}</p>
              <p style="margin:10px 0 0;font-family:${FONT};font-size:30px;font-weight:300;letter-spacing:${locale === 'ar' ? '0' : '0.06em'};color:${GOLD};">${escapeHtml(booking.voucherNumber)}</p>
            </td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding:0 20px;">
              ${stayBand(copy, booking, locale)}
            </td>
          </tr>
          ${
            photo
              ? `<tr><td style="padding:22px 20px 0;line-height:0;"><img src="${escapeHtml(photo)}" alt="${escapeHtml(booking.roomType || booking.property || 'Prime Hospitality')}" width="560" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
              : ''
          }
          <tr>
            <td style="padding:8px 32px 32px;text-align:${align};">
              <p style="margin:26px 0 0;font-family:${FONT};font-size:15px;font-weight:300;line-height:1.7;color:#58595B;text-align:${align};">${escapeHtml(copy.lede)}</p>
              ${listingHref ? button(listingHref, copy.viewStay, locale) : ''}
              ${sectionTitle(copy.yourStay, align)}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${detailRows(detail, align, valueAlign)}</table>
              ${
                where
                  ? `<p style="margin:18px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;text-align:${align};"><span style="color:${MUTED};">${escapeHtml(copy.address)}</span><br/>${escapeHtml(where)}${mapHref ? `<br/><a href="${escapeHtml(mapHref)}" style="color:${GOLD};text-decoration:none;">${escapeHtml(copy.directions)}</a>` : ''}</p>`
                  : ''
              }
              ${
                rules.length
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;background:${MIST};"><tr><td style="padding:22px 20px;text-align:${align};">${sectionTitle(copy.houseRules, align).replace('margin:32px 0 14px', 'margin:0 0 14px')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${bulletList(rules, align)}</table></td></tr></table>`
                  : ''
              }
              ${
                regulations.length
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;background:${MIST};"><tr><td style="padding:22px 20px;text-align:${align};">${sectionTitle(copy.regulations, align).replace('margin:32px 0 14px', 'margin:0 0 14px')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${bulletList(regulations, align)}</table></td></tr></table>`
                  : ''
              }
              ${sectionTitle(copy.before, align)}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${bulletList([copy.late, copy.id, cancelLine], align)}</table>
              ${
                refund.length
                  ? `${sectionTitle(copy.refundTitle, align)}${refund
                      .map(
                        (paragraph) =>
                          `<p style="margin:0 0 12px;font-family:${FONT};font-size:14px;font-weight:300;line-height:1.7;color:#58595B;text-align:${align};">${escapeHtml(paragraph)}</p>`
                      )
                      .join('')}`
                  : ''
              }
              <p style="margin:8px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;text-align:${align};">
                <a href="${escapeHtml(refundHref)}" style="color:${GOLD};text-decoration:none;">${escapeHtml(copy.refundLink)}</a>
              </p>
              <p style="margin:28px 0 0;font-family:${FONT};font-size:13px;font-weight:300;line-height:1.6;color:${MUTED};text-align:${align};">
                ${escapeHtml(copy.questions)}${phone ? ` ${escapeHtml(copy.orCall)} ${escapeHtml(phone)}` : ''} · ${escapeHtml(supportEmail)}
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${INK}" style="background:${INK};padding:22px 32px;text-align:center;">
              <p style="margin:0;font-family:${FONT};font-size:10px;font-weight:500;letter-spacing:${locale === 'ar' ? '0' : '0.22em'};text-transform:uppercase;color:${GOLD_SOFT};">${escapeHtml(copy.tagline)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildConfirmationText(booking, context) {
  const locale = booking.locale === 'ar' ? 'ar' : 'en';
  const copy = COPY[locale];
  const lines = [
    copy.dear(booking.primaryGuestName || ''),
    '',
    copy.lede,
    '',
    booking.voucherNumber ? `${copy.confirmation}: ${booking.voucherNumber}` : '',
    `${copy.property}: ${booking.property || booking.listingTitle || ''}`,
    booking.destination ? `${copy.destination}: ${booking.destination}` : '',
    booking.roomType ? `${copy.unit}: ${booking.roomType}` : '',
    `${copy.arrival}: ${booking.arrivalDate} ${copy.from} ${clock(booking.checkInTime || '15:00')}`,
    `${copy.departure}: ${booking.departureDate} ${copy.by} ${clock(booking.checkOutTime || '12:00')}`,
    `${copy.stayTotal}: ${money(booking.rateAmount ?? booking.amount, booking.rateCurrency || 'USD')}`,
    booking.chargeAmount ? `${copy.cardCharged}: ${money(booking.chargeAmount, booking.chargeCurrency || 'EGP')}` : '',
    '',
    context.houseRules?.length ? `${copy.houseRules}:` : '',
    ...(context.houseRules || []).map((rule) => `- ${rule}`),
    context.guestRegulations?.length ? `${copy.regulations}:` : '',
    ...(context.guestRegulations || []).map((rule) => `- ${rule}`),
    '',
    copy.late,
    copy.id,
    context.planRefundable === false ? copy.nonRefund : copy.freeCancel,
    ...(context.refundParagraphs || []),
    '',
    `${copy.refundLink}: ${siteUrl()}/refund-policy`,
    '— Prime Hospitality',
  ];
  return lines.filter((line) => line !== '').join('\n');
}

async function claimSend(booking) {
  if (!booking?.id) return true;
  if (booking.confirmationEmailSentAt) return false;
  const result = await query(
    `update bookings set confirmation_email_sent_at = now()
     where id = $1 and confirmation_email_sent_at is null
     returning id`,
    [booking.id]
  );
  return result.rowCount > 0;
}

async function releaseSend(booking) {
  if (!booking?.id) return;
  await query('update bookings set confirmation_email_sent_at = null where id = $1', [booking.id]).catch(() => {});
}

async function confirmationContext(booking) {
  const site = await getSite().catch(() => null);
  const listing = booking.slug || booking.listingId ? await findUnit(booking.slug || booking.listingId).catch(() => null) : null;
  const locale = booking.locale === 'ar' ? 'ar' : 'en';
  const business = site?.business || {};
  const legal = site?.pages?.legal?.refund || {};
  const refundSource = (locale === 'ar' && legal.ar) || legal.en || '';
  const plan = RATE_PLANS.find((item) => item.code === booking.ratePlanCode);
  const maxGuests = Number(listing?.maxGuests) || 0;
  return {
    business,
    image: imageUrl(listing),
    houseRules: ruleLines(business.houseRules, locale, maxGuests),
    guestRegulations: ruleLines(business.guestRegulations, locale, maxGuests),
    refundParagraphs: plainParagraphs(refundSource),
    planRefundable: plan ? plan.refundable !== false : true,
  };
}

/**
 * Send once the booking is paid. A second call for the same booking does nothing.
 */
async function sendBookingConfirmation(booking) {
  if (!booking?.email) return { sent: false, reason: 'no_email' };
  if (booking.paymentStatus !== 'paid') return { sent: false, reason: 'not_confirmed' };
  if (!isConfigured()) {
    if (!warnedMissing) {
      console.warn('[email] SMTP not configured — guest confirmation emails are skipped');
      warnedMissing = true;
    }
    return { sent: false, reason: 'not_configured' };
  }

  let claimed = false;
  try {
    claimed = await claimSend(booking);
  } catch (err) {
    console.warn('[email] could not record confirmation send:', err.message);
    claimed = !booking.confirmationEmailSentAt;
  }
  if (!claimed) return { sent: false, reason: 'already_sent' };

  try {
    const context = await confirmationContext(booking);
    const from = env('SMTP_FROM', 'MAIL_FROM') || env('SMTP_USER', 'MAIL_USER');
    const transport = getTransporter();
    if (!transport) {
      await releaseSend(booking);
      return { sent: false, reason: 'no_transport' };
    }
    const locale = booking.locale === 'ar' ? 'ar' : 'en';
    const brandName = context.business.name || 'Prime Hospitality';
    const subject = booking.voucherNumber
      ? `${COPY[locale].subject} — ${booking.property || booking.listingTitle || 'Prime Hospitality'} — ${booking.voucherNumber}`
      : COPY[locale].subject;
    await transport.sendMail({
      from: `"${brandName}" <${from}>`,
      replyTo: context.business.email || undefined,
      to: booking.email,
      subject,
      text: buildConfirmationText(booking, context),
      html: buildConfirmationHtml(booking, context),
    });
    return { sent: true };
  } catch (err) {
    await releaseSend(booking);
    throw err;
  }
}

module.exports = {
  isConfigured,
  warm,
  sendBookingConfirmation,
  buildConfirmationHtml,
  confirmationContext,
};
