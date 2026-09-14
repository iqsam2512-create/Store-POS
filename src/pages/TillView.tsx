import { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  CartItem,
  Category,
  Customer,
  Product,
  Settings,
  Transaction,
  getUploadsBase,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import { formatDateTime, formatMoney, formatNumber, parseMoney, roundMoney } from '../money';
import Modal from '../components/Modal';
import PaymentPad from '../components/PaymentPad';
import CustomerSelect from '../components/CustomerSelect';

type Props = {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  settings: Settings | null;
  onRefresh: () => Promise<void>;
  holdCount: number;
  onHoldCount: (n: number) => void;
};

type ReceiptData = {
  id?: number;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  method: string;
  date: Date;
};

/** A scanned code that is not in the catalog — long digit strings are barcodes, not searches. */
const looksLikeBarcode = (code: string) => /^\d{6,}$/.test(code);

export default function TillView({
  products,
  categories,
  customers,
  settings,
  onRefresh,
  holdCount,
  onHoldCount,
}: Props) {
  const { user, apiInfo } = useAuth();
  const { t } = useT();
  const scanRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [customerId, setCustomerId] = useState('0');
  const [discount, setDiscount] = useState('');
  const [activeHoldId, setActiveHoldId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHolds, setShowHolds] = useState(false);
  const [holds, setHolds] = useState<Transaction[]>([]);
  const [showPay, setShowPay] = useState(false);
  const [paid, setPaid] = useState('');
  const [paymentType, setPaymentType] = useState(1);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Unknown-barcode quick add
  const [quick, setQuick] = useState<{ code: string } | null>(null);
  const [quickForm, setQuickForm] = useState({ name: '', price: '', quantity: '', category: '' });
  const [quickBusy, setQuickBusy] = useState(false);

  const symbol = settings?.symbol || 'د.ع';
  const taxRate = settings?.charge_tax ? Number(settings.percentage) || 0 : 0;
  const uploads = getUploadsBase();
  const money = (n: number) => formatMoney(n, symbol);

  const refreshHolds = async () => {
    const list = await api.getOnHold();
    setHolds(list);
    onHoldCount(list.length);
  };

  useEffect(() => {
    refreshHolds().catch(() => undefined);
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length) openPay();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        openHolds();
      }
      if (e.key === 'Escape' && showPay) {
        setShowPay(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, showPay]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = categoryFilter === 'all' || p.category === categoryFilter;
      if (!q) return catOk;
      return (
        catOk &&
        (p.name.toLowerCase().includes(q) ||
          String(p.id).includes(q) ||
          (p.barcode || '').includes(q))
      );
    });
  }, [products, query, categoryFilter]);

  const discountNum = parseMoney(discount);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const afterDiscount = Math.max(0, subtotal - discountNum);
  const tax = roundMoney(afterDiscount * (taxRate / 100));
  const total = roundMoney(afterDiscount + tax);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const paidNum = parseMoney(paid);

  const stockLabel = (p: Product) => {
    if (!p.stock) return { text: t('stock.noLimit'), className: 'stock-badge' };
    if (p.quantity <= 0) return { text: t('stock.out'), className: 'stock-badge out' };
    if (p.quantity <= 5) return { text: t('stock.left', { n: p.quantity }), className: 'stock-badge low' };
    return { text: t('stock.inStock', { n: p.quantity }), className: 'stock-badge' };
  };

  const addToCart = (product: Product) => {
    if (product.stock && product.quantity <= 0) {
      setError(t('till.outOfStock', { name: product.name }));
      return;
    }
    setError(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (product.stock && existing.quantity >= product.quantity) {
          setError(t('till.onlyAvailable', { n: product.quantity, name: product.name }));
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: roundMoney(product.price),
          quantity: 1,
          stock: product.quantity,
        },
      ];
    });
  };

  const setQty = (id: number, quantity: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('');
    setActiveHoldId(null);
    setCustomerId('0');
    setError(null);
    scanRef.current?.focus();
  };

  const onScan = async () => {
    const code = query.trim();
    if (!code) return;
    try {
      const product = await api.findBySku(code);
      if (product) {
        addToCart(product);
        setQuery('');
        scanRef.current?.focus();
        return;
      }
      // fallback local match by id or exact name
      const local =
        products.find((p) => String(p.id) === code) ||
        products.find((p) => p.name.toLowerCase() === code.toLowerCase());
      if (local) {
        addToCart(local);
        setQuery('');
        scanRef.current?.focus();
      } else if (looksLikeBarcode(code)) {
        // Real barcode, not in the catalog: offer to register the product right here.
        setQuickForm({ name: '', price: '', quantity: '', category: '' });
        setQuick({ code });
        setQuery('');
      } else {
        setError(t('till.noProduct', { code }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.scanFailed'));
    }
  };

  const saveQuick = async (addAfter: boolean) => {
    if (!quick) return;
    if (!quickForm.name.trim() || !quickForm.price) {
      setError(t('quick.nameRequired'));
      return;
    }
    setQuickBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('id', '');
      fd.append('name', quickForm.name.trim());
      fd.append('barcode', quick.code);
      fd.append('price', String(parseMoney(quickForm.price)));
      fd.append('category', quickForm.category);
      fd.append('quantity', quickForm.quantity || '0');
      fd.append('stock', quickForm.quantity ? '1' : 'on');
      fd.append('img', '');
      const created = (await api.saveProduct(fd)) as Product | undefined;
      await onRefresh();
      setQuick(null);
      if (addAfter && created && created.id) addToCart(created);
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.saleFailed'));
    } finally {
      setQuickBusy(false);
    }
  };

  const buildTransaction = (status: number, paidAmount: number, changeAmt: number) => {
    const customer = customers.find((c) => String(c.id) === customerId);
    return {
      ref_number: status === 0 ? `H-${Date.now().toString().slice(-6)}` : '',
      customer: customerId,
      customer_name: customer?.name || t('cust.walkIn'),
      status,
      user_id: user?._id || 0,
      user: user?.fullname || '',
      till: apiInfo?.till || settings?.till || 1,
      discount: discountNum,
      subtotal,
      tax,
      total,
      paid: paidAmount,
      change: changeAmt,
      payment_type: paymentType,
      items: cart,
      date: new Date().toISOString(),
    };
  };

  const holdSale = async () => {
    if (!cart.length) return;
    try {
      const body = buildTransaction(0, 0, 0);
      if (activeHoldId) {
        await api.updateTransaction({ ...body, _id: activeHoldId });
      } else {
        await api.createTransaction(body);
      }
      clearCart();
      await refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.holdFailed'));
    }
  };

  const openPay = () => {
    // Cash starts empty so the numpad builds the tendered amount (not appends to total).
    setPaid('');
    setPaymentType(1);
    setShowPay(true);
  };

  const completeSale = async () => {
    if (paidNum < total) {
      setError(t('till.lessThanTotal'));
      return;
    }
    const changeAmt = Math.max(0, paidNum - total);
    const body = buildTransaction(1, paidNum, changeAmt);
    try {
      let saved: { id?: number } | undefined;
      if (activeHoldId) {
        await api.updateTransaction({ ...body, _id: activeHoldId, ref_number: '' });
        saved = { id: activeHoldId };
      } else {
        saved = (await api.createTransaction(body)) as { id?: number } | undefined;
      }
      setReceipt({
        id: saved?.id,
        items: cart,
        subtotal,
        tax,
        discount: discountNum,
        total,
        paid: paidNum,
        change: changeAmt,
        method: paymentType === 3 ? t('pay.card') : t('pay.cash'),
        date: new Date(),
      });
      clearCart();
      setShowPay(false);
      await onRefresh();
      await refreshHolds();
      setTimeout(() => window.print(), 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('till.saleFailed'));
    }
  };

  const openHolds = async () => {
    await refreshHolds();
    setShowHolds(true);
  };

  const restoreHold = (order: Transaction) => {
    setCart(order.items || []);
    setCustomerId(String(order.customer || '0'));
    setDiscount(order.discount ? String(order.discount) : '');
    setActiveHoldId(order.id);
    setShowHolds(false);
    scanRef.current?.focus();
  };

  const discardHold = async (id: number) => {
    if (!confirm(t('till.deleteHeld'))) return;
    await api.deleteTransaction(id);
    await refreshHolds();
  };

  return (
    <>
      {error && (
        <div className="error">
          {error}{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setError(null)}>
            {t('common.dismiss')}
          </button>
        </div>
      )}

      <div className="till">
        <section className="panel till-left">
          <div className="scan-bar">
            <input
              ref={scanRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onScan();
              }}
              placeholder={t('till.scanPlaceholder')}
              autoFocus
            />
            <button type="button" className="btn btn-primary" onClick={onScan}>
              {t('till.add')}
            </button>
          </div>
          <div className="chips">
            <button
              type="button"
              className={`chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              {t('common.all')}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${categoryFilter === c.name ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {filteredProducts.map((p) => {
              const stock = stockLabel(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="product-tile"
                  onClick={() => addToCart(p)}
                  disabled={!!p.stock && p.quantity <= 0}
                >
                  {p.img ? (
                    <div className="product-thumb-wrap">
                      <img className="product-thumb" src={`${uploads}/${p.img}`} alt="" />
                    </div>
                  ) : (
                    <div className="product-thumb-wrap">
                      <div className="product-thumb placeholder" />
                    </div>
                  )}
                  <div className="product-tile-body">
                    <strong>{p.name}</strong>
                    <span className="price money">{money(p.price)}</span>
                    <span className={stock.className}>{stock.text}</span>
                  </div>
                </button>
              );
            })}
            {!filteredProducts.length && (
              <div className="empty">{t('till.noProducts')}</div>
            )}
          </div>
        </section>

        <section className="panel till-right">
          <div className="cart-head">
            <CustomerSelect
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCustomersChanged={onRefresh}
            />
            <button type="button" className="btn" onClick={openHolds}>
              {t('till.held')} {holdCount ? `(${holdCount})` : ''}
              <span className="kbd">F4</span>
            </button>
          </div>

          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{t('till.each', { price: money(item.price) })}</div>
                </div>
                <div className="qty">
                  <button type="button" onClick={() => setQty(item.id, item.quantity - 1)}>
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => setQty(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>
                <strong className="money">{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            {!cart.length && <div className="empty">{t('till.cartEmpty')}</div>}
          </div>

          <div className="totals">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('till.discount', { symbol })}</label>
              <input
                inputMode="numeric"
                className="num-ltr"
                value={discount ? formatNumber(discountNum) : ''}
                onChange={(e) => setDiscount(String(parseMoney(e.target.value) || ''))}
                placeholder="0"
              />
            </div>
            <div className="row">
              <span>{itemCount === 1 ? t('till.item') : t('till.items', { n: itemCount })}</span>
              <span className="money">{money(subtotal)}</span>
            </div>
            {!!taxRate && (
              <div className="row">
                <span>{t('till.tax', { rate: taxRate })}</span>
                <span className="money">{money(tax)}</span>
              </div>
            )}
            <div className="row grand">
              <span>{t('till.total')}</span>
              <span className="money">{money(total)}</span>
            </div>
          </div>

          <div className="cart-actions">
            <button type="button" className="btn" onClick={clearCart} disabled={!cart.length}>
              {t('till.clear')}
            </button>
            <button type="button" className="btn" onClick={holdSale} disabled={!cart.length}>
              {t('till.hold')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg pay"
              onClick={openPay}
              disabled={!cart.length}
            >
              {t('till.charge', { amount: money(total) })}
              <span className="kbd">F2</span>
            </button>
          </div>
        </section>
      </div>

      {/* Printed receipt (80mm). Hidden on screen, shown by the @media print rules. */}
      <div id="receipt-print" className="receipt" style={{ display: 'none' }}>
        {receipt && (
          <>
            <h2>{settings?.store || t('app.name')}</h2>
            {settings?.address_one && <p className="r-center r-muted">{settings.address_one}</p>}
            {settings?.contact && <p className="r-center r-muted num-ltr">{settings.contact}</p>}
            <hr />
            <div className="r-row r-muted">
              <span>{receipt.id ? t('receipt.no', { n: receipt.id }) : ''}</span>
              <span className="num-ltr">{formatDateTime(receipt.date)}</span>
            </div>
            <hr />
            <table>
              <thead>
                <tr>
                  <th>{t('receipt.item')}</th>
                  <th className="num">{t('receipt.qty')}</th>
                  <th className="num">{t('receipt.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td className="num">{i.quantity}</td>
                    <td className="num">{formatNumber(i.price * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr />
            {(receipt.discount > 0 || receipt.tax > 0) && (
              <div className="r-row">
                <span>{t('receipt.subtotal')}</span>
                <span className="money">{money(receipt.subtotal)}</span>
              </div>
            )}
            {receipt.discount > 0 && (
              <div className="r-row">
                <span>{t('receipt.discount')}</span>
                <span className="money">-{money(receipt.discount)}</span>
              </div>
            )}
            {receipt.tax > 0 && (
              <div className="r-row">
                <span>{t('receipt.tax', { rate: taxRate })}</span>
                <span className="money">{money(receipt.tax)}</span>
              </div>
            )}
            <div className="r-row r-total">
              <span>{t('receipt.total')}</span>
              <span className="money">{money(receipt.total)}</span>
            </div>
            <div className="r-row">
              <span>{t('receipt.paid', { method: receipt.method })}</span>
              <span className="money">{money(receipt.paid)}</span>
            </div>
            <div className="r-row">
              <span>{t('receipt.change')}</span>
              <span className="money">{money(receipt.change)}</span>
            </div>
            <hr />
            <p className="r-center r-muted">
              {t('receipt.till', { n: apiInfo?.till || 1, user: user?.fullname || '' })}
            </p>
            <p className="r-center">{settings?.footer || t('receipt.thanks')}</p>
          </>
        )}
      </div>

      <Modal
        title={t('pay.title')}
        open={showPay}
        onClose={() => setShowPay(false)}
        compact
        footer={
          <>
            <button type="button" className="btn" onClick={() => setShowPay(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={completeSale}
              disabled={paidNum < total}
            >
              {t('pay.pay')}
            </button>
          </>
        }
      >
        <div className="field">
          <label>{t('pay.method')}</label>
          <select
            value={paymentType}
            onChange={(e) => {
              const type = Number(e.target.value);
              setPaymentType(type);
              if (type === 3) setPaid(String(total));
              else setPaid('');
            }}
          >
            <option value={1}>{t('pay.cash')}</option>
            <option value={3}>{t('pay.card')}</option>
          </select>
        </div>
        <div className="pay-due money">{t('pay.due', { amount: money(total) })}</div>
        <div className="field">
          <label>{t('pay.tendered')}</label>
          <input
            className="num-ltr"
            value={paid ? formatNumber(paidNum) : ''}
            onChange={(e) => setPaid(String(parseMoney(e.target.value) || ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && paidNum >= total) completeSale();
            }}
            placeholder={paymentType === 1 ? t('pay.enterAmount') : formatNumber(total)}
            inputMode="numeric"
            autoFocus
            readOnly={paymentType === 3}
          />
        </div>
        {paymentType === 1 && (
          <PaymentPad value={paid} onChange={setPaid} due={total} symbol={symbol} />
        )}
        <p className="pay-change">
          {paidNum < total ? t('pay.stillDue') : t('pay.change')}{' '}
          <strong className="money">{money(Math.abs(paidNum - total))}</strong>
        </p>
      </Modal>

      <Modal
        title={t('quick.title')}
        open={!!quick}
        onClose={() => setQuick(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setQuick(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn" disabled={quickBusy} onClick={() => saveQuick(false)}>
              {t('quick.saveOnly')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={quickBusy}
              onClick={() => saveQuick(true)}
            >
              {t('quick.saveAndAdd')}
            </button>
          </>
        }
      >
        {quick && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              <strong className="barcode">{quick.code}</strong> — {t('quick.intro')}
            </p>
            <div className="field">
              <label>{t('quick.name')}</label>
              <input
                value={quickForm.name}
                onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label>{t('quick.price', { symbol })}</label>
              <input
                inputMode="numeric"
                className="num-ltr"
                value={quickForm.price ? formatNumber(parseMoney(quickForm.price)) : ''}
                onChange={(e) =>
                  setQuickForm({ ...quickForm, price: String(parseMoney(e.target.value) || '') })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveQuick(true);
                }}
              />
            </div>
            <div className="field">
              <label>{t('quick.qty')}</label>
              <input
                type="number"
                min={0}
                className="num-ltr"
                value={quickForm.quantity}
                onChange={(e) => setQuickForm({ ...quickForm, quantity: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t('quick.category')}</label>
              <select
                value={quickForm.category}
                onChange={(e) => setQuickForm({ ...quickForm, category: e.target.value })}
              >
                <option value="">{t('common.none')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </Modal>

      <Modal title={t('holds.title')} open={showHolds} onClose={() => setShowHolds(false)} wide>
        <table className="table">
          <thead>
            <tr>
              <th>{t('holds.ref')}</th>
              <th>{t('holds.customer')}</th>
              <th>{t('holds.items')}</th>
              <th>{t('holds.total')}</th>
              <th>{t('holds.when')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id}>
                <td>{h.ref_number || h.id}</td>
                <td>{h.customer_name}</td>
                <td>{(h.items || []).reduce((n, i) => n + i.quantity, 0)}</td>
                <td className="money">{money(Number(h.total))}</td>
                <td className="num-ltr">{formatDateTime(h.date)}</td>
                <td>
                  <button type="button" className="btn btn-primary" onClick={() => restoreHold(h)}>
                    {t('holds.resume')}
                  </button>{' '}
                  <button type="button" className="btn btn-danger" onClick={() => discardHold(h.id)}>
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!holds.length && <div className="empty">{t('holds.empty')}</div>}
      </Modal>
    </>
  );
}
