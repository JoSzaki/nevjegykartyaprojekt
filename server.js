require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `NVJ-${year}-${rand}`;
}

// POST /api/orders — rendelés mentése
app.post('/api/orders', async (req, res) => {
  const {
    billingLastName, billingFirstName, billingEmail, billingPhone,
    billingCompany, billingTaxId,
    shippingAddress, shippingZip, shippingCity,
    quantity, unitPriceHuf, totalAmountHuf,
    cardName, cardTitle, cardCompany, cardPhone, cardEmail, cardWeb, cardAddress,
    cardDesign, logoUrl,
  } = req.body;

  if (!billingLastName || !billingFirstName || !billingEmail || !billingPhone ||
      !shippingAddress || !shippingZip || !shippingCity ||
      !quantity || !unitPriceHuf || !totalAmountHuf || !cardName || !cardDesign) {
    return res.status(400).json({ error: 'Hiányzó kötelező mezők.' });
  }

  const orderNumber = generateOrderNumber();

  try {
    const result = await pool.query(
      `INSERT INTO business_card_order (
        order_number, billing_last_name, billing_first_name, billing_email, billing_phone,
        billing_company, billing_tax_id,
        shipping_address, shipping_zip, shipping_city,
        quantity, unit_price_huf, total_amount_huf,
        card_name, card_title, card_company, card_phone, card_email, card_web, card_address,
        card_design, logo_url
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      ) RETURNING id, order_number, created_at`,
      [
        orderNumber, billingLastName, billingFirstName, billingEmail, billingPhone,
        billingCompany || null, billingTaxId || null,
        shippingAddress, shippingZip, shippingCity,
        quantity, unitPriceHuf, totalAmountHuf,
        cardName, cardTitle || null, cardCompany || null, cardPhone || null,
        cardEmail || null, cardWeb || null, cardAddress || null,
        JSON.stringify(cardDesign), logoUrl || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ error: 'Adatbázis hiba.' });
  }
});

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
