require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'KártyaD <noreply@kartyad.hu>';

const PDF_DIR = path.join(__dirname, 'pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);

app.use('/pdfs', express.static(PDF_DIR));

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `NVJ-${year}-${rand}`;
}

function buildConfirmationEmail({ orderNumber, firstName, lastName, shippingZip, shippingCity, shippingAddress, quantity, totalAmountHuf, cardName }) {
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 5);
  const deliveryStr = deliveryDate.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#7c73e6;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:1px;">KártyaD</h1>
          <p style="margin:6px 0 0;color:#e0e0ff;font-size:13px;">Prémium névjegykártyák</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#e0e0ff;margin:0 0 8px;">Sikeres rendelés! ✓</h2>
          <p style="color:#a0a0cc;margin:0 0 24px;font-size:14px;">Köszönjük megrendelését, <strong style="color:#e0e0ff;">${lastName} ${firstName}</strong>! Hamarosan elkészítjük kártyáit.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d1a;border-radius:8px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:6px 0;border-bottom:1px solid #2a2a4e;">
              <span style="color:#7c73e6;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Rendelésszám</span><br>
              <span style="color:#e0e0ff;font-weight:bold;font-size:16px;">${orderNumber}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a4e;">
              <span style="color:#a0a0cc;font-size:13px;">Kártya neve</span><br>
              <span style="color:#e0e0ff;">${cardName}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a4e;">
              <span style="color:#a0a0cc;font-size:13px;">Darabszám</span><br>
              <span style="color:#e0e0ff;">${quantity} db</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a4e;">
              <span style="color:#a0a0cc;font-size:13px;">Szállítási cím</span><br>
              <span style="color:#e0e0ff;">${shippingZip} ${shippingCity}, ${shippingAddress}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #2a2a4e;">
              <span style="color:#a0a0cc;font-size:13px;">Várható szállítás</span><br>
              <span style="color:#e0e0ff;">~ ${deliveryStr}</span>
            </td></tr>
            <tr><td style="padding:8px 0;">
              <span style="color:#a0a0cc;font-size:13px;">Fizetett összeg</span><br>
              <span style="color:#f0c040;font-weight:bold;font-size:18px;">${totalAmountHuf.toLocaleString('hu-HU')} Ft</span>
            </td></tr>
          </table>

          <p style="color:#a0a0cc;font-size:13px;margin:0;">Ha kérdése van, írjon nekünk: <a href="mailto:info@kartyad.hu" style="color:#7c73e6;">info@kartyad.hu</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;text-align:center;border-top:1px solid #2a2a4e;">
          <p style="color:#4a4a6a;font-size:11px;margin:0;">© ${new Date().getFullYear()} KártyaD — kartyad.hu</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// POST /api/orders — rendelés mentése
app.post('/api/orders', async (req, res) => {
  const {
    billingLastName, billingFirstName, billingEmail, billingPhone,
    billingCompany, billingTaxId,
    shippingAddress, shippingZip, shippingCity,
    quantity, unitPriceHuf, totalAmountHuf,
    cardName, cardTitle, cardCompany, cardPhone, cardEmail, cardWeb, cardAddress,
    cardDesign, logoUrl, pdfBase64,
  } = req.body;

  if (!billingLastName || !billingFirstName || !billingEmail || !billingPhone ||
      !shippingAddress || !shippingZip || !shippingCity ||
      !quantity || !unitPriceHuf || !totalAmountHuf || !cardName || !cardDesign) {
    return res.status(400).json({ error: 'Hiányzó kötelező mezők.' });
  }

  const orderNumber = generateOrderNumber();

  // Save PDF to disk
  let pdfPath = null;
  if (pdfBase64) {
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const filename = `${orderNumber}.pdf`;
    fs.writeFileSync(path.join(PDF_DIR, filename), Buffer.from(base64Data, 'base64'));
    pdfPath = `/pdfs/${filename}`;
  }

  try {
    const result = await pool.query(
      `INSERT INTO business_card_order (
        order_number, billing_last_name, billing_first_name, billing_email, billing_phone,
        billing_company, billing_tax_id,
        shipping_address, shipping_zip, shipping_city,
        quantity, unit_price_huf, total_amount_huf,
        card_name, card_title, card_company, card_phone, card_email, card_web, card_address,
        card_design, logo_url, pdf_path
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      ) RETURNING id, order_number, created_at`,
      [
        orderNumber, billingLastName, billingFirstName, billingEmail, billingPhone,
        billingCompany || null, billingTaxId || null,
        shippingAddress, shippingZip, shippingCity,
        quantity, unitPriceHuf, totalAmountHuf,
        cardName, cardTitle || null, cardCompany || null, cardPhone || null,
        cardEmail || null, cardWeb || null, cardAddress || null,
        JSON.stringify(cardDesign), logoUrl || null, pdfPath,
      ]
    );

    // Send confirmation email (fire and forget)
    if (process.env.RESEND_API_KEY) {
      resend.emails.send({
        from: EMAIL_FROM,
        to: billingEmail,
        subject: `Rendelés visszaigazolás – ${orderNumber}`,
        html: buildConfirmationEmail({
          orderNumber,
          firstName: billingFirstName,
          lastName: billingLastName,
          shippingZip, shippingCity, shippingAddress,
          quantity, totalAmountHuf, cardName,
        }),
      }).catch(err => console.warn('Email küldés sikertelen:', err.message));
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ error: 'Adatbázis hiba.' });
  }
});

app.use(express.static('.'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
