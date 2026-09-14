import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAnyPerm } from '../auth.js';

const router = Router();

const DEMO_CATEGORIES = ['مشروبات', 'حلويات وشيبس', 'ألبان', 'خبز ومعجنات', 'منظفات', 'دخان'];

// Prices in IQD (whole dinars). Barcodes are 13-digit EAN-style demo codes.
const DEMO_PRODUCTS = [
  { name: 'بيبسي 330 مل', price: 500, category: 'مشروبات', quantity: 48, barcode: '6281006612541' },
  { name: 'سفن أب 330 مل', price: 500, category: 'مشروبات', quantity: 36, barcode: '6281006612558' },
  { name: 'ماء 500 مل', price: 250, category: 'مشروبات', quantity: 96, barcode: '6281100600014' },
  { name: 'عصير راني 240 مل', price: 750, category: 'مشروبات', quantity: 40, barcode: '6291003000185' },
  { name: 'شيبس ليز 40 غم', price: 500, category: 'حلويات وشيبس', quantity: 60, barcode: '6291100010025' },
  { name: 'كيت كات 4 أصابع', price: 1000, category: 'حلويات وشيبس', quantity: 45, barcode: '7613034626844' },
  { name: 'علكة اكسترا', price: 500, category: 'حلويات وشيبس', quantity: 80, barcode: '4009900484473' },
  { name: 'حليب المراعي 1 لتر', price: 2500, category: 'ألبان', quantity: 24, barcode: '6281007000010' },
  { name: 'لبن 1 كغم', price: 2000, category: 'ألبان', quantity: 18, barcode: '6281007000027' },
  { name: 'جبن كيري 6 قطع', price: 3000, category: 'ألبان', quantity: 15, barcode: '3073780875059' },
  { name: 'بيض 30 حبة', price: 6000, category: 'ألبان', quantity: 10, barcode: '' },
  { name: 'صمون (5 حبات)', price: 1000, category: 'خبز ومعجنات', quantity: 0, barcode: '' , noStock: true },
  { name: 'كيك بيتي فور', price: 1500, category: 'خبز ومعجنات', quantity: 20, barcode: '6281008010013' },
  { name: 'فيري سائل جلي 1 لتر', price: 4000, category: 'منظفات', quantity: 12, barcode: '5413149263352' },
  { name: 'تايد 1.5 كغم', price: 7500, category: 'منظفات', quantity: 8, barcode: '8001090790682' },
  { name: 'كلينكس مناديل', price: 1500, category: 'منظفات', quantity: 30, barcode: '6281002100014' },
  { name: 'ولاعة', price: 500, category: 'دخان', quantity: 40, barcode: '' },
];

const DEMO_CUSTOMERS = [
  { name: 'أبو علي', phone: '07701234567', email: '', address: 'الدورة' },
  { name: 'أم حسين', phone: '07812345678', email: '', address: 'السيدية' },
  { name: 'حيدر كريم', phone: '07901234567', email: '', address: 'المنصور' },
];

router.post('/seed', requireAnyPerm('perm_products', 'perm_settings'), (_req, res) => {
  const db = getDb();

  const result = db.transaction(() => {
    let categoriesAdded = 0;
    let productsAdded = 0;
    let customersAdded = 0;

    for (const name of DEMO_CATEGORIES) {
      const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
      if (!existing) {
        db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
        categoriesAdded += 1;
      }
    }

    const insertProduct = db.prepare(
      `INSERT INTO products (name, price, category, quantity, stock, img, barcode)
       VALUES (?, ?, ?, ?, ?, '', ?)`
    );
    for (const p of DEMO_PRODUCTS) {
      const existing = db.prepare('SELECT id FROM products WHERE name = ?').get(p.name);
      if (!existing) {
        insertProduct.run(p.name, p.price, p.category, p.quantity, p.noStock ? 0 : 1, p.barcode || '');
        productsAdded += 1;
      }
    }

    const insertCustomer = db.prepare(
      `INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)`
    );
    for (const c of DEMO_CUSTOMERS) {
      const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(c.name);
      if (!existing) {
        insertCustomer.run(c.name, c.phone, c.email, c.address);
        customersAdded += 1;
      }
    }

    return { categoriesAdded, productsAdded, customersAdded };
  })();

  res.json({
    ok: true,
    ...result,
    message: `Added ${result.productsAdded} products, ${result.categoriesAdded} categories, ${result.customersAdded} customers`,
  });
});

router.post('/clear', requireAnyPerm('perm_products', 'perm_settings'), (req, res) => {
  const body = req.body || {};
  const clearProducts = body.products !== false;
  const clearCategories = body.categories !== false;
  const clearCustomers = body.customers !== false;
  const clearTransactions = body.transactions !== false;

  const db = getDb();
  const counts = db.transaction(() => {
    const out = {
      products: 0,
      categories: 0,
      customers: 0,
      transactions: 0,
    };

    if (clearTransactions) {
      const r = db.prepare('DELETE FROM transactions').run();
      out.transactions = r.changes || 0;
    }
    if (clearProducts) {
      const r = db.prepare('DELETE FROM products').run();
      out.products = r.changes || 0;
    }
    if (clearCategories) {
      const r = db.prepare('DELETE FROM categories').run();
      out.categories = r.changes || 0;
    }
    if (clearCustomers) {
      const r = db
        .prepare("DELETE FROM customers WHERE name != 'Walk-in Customer'")
        .run();
      out.customers = r.changes || 0;
    }

    return out;
  })();

  // sql.js wrapper may not expose changes reliably — recount deleted via before if needed
  res.json({
    ok: true,
    deleted: counts,
    message: 'Catalog and related demo data cleared',
  });
});

export default router;
