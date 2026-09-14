import { useEffect, useRef, useState } from 'react';
import { api, Category, Product, getUploadsBase } from '../api/client';
import PhotoPicker from '../components/PhotoPicker';
import { useT } from '../i18n';
import { formatMoney, formatNumber, parseMoney } from '../money';

type Props = {
  products: Product[];
  categories: Category[];
  symbol: string;
  canProducts: boolean;
  canCategories: boolean;
  onChanged: () => Promise<void>;
};

const emptyProduct = {
  id: '',
  name: '',
  barcode: '',
  price: '',
  category: '',
  quantity: '0',
  trackStock: true,
  img: '',
};

export default function CatalogView({
  products,
  categories,
  symbol,
  canProducts,
  canCategories,
  onChanged,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<'products' | 'categories'>(
    canProducts ? 'products' : 'categories'
  );
  const [list, setList] = useState(products);
  const [cats, setCats] = useState(categories);
  const [form, setForm] = useState(emptyProduct);
  const [catName, setCatName] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const uploads = getUploadsBase();

  useEffect(() => {
    setList(products);
    setCats(categories);
    setSelected((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products, categories]);

  const saveProduct = async () => {
    if (!form.name.trim()) {
      setError(t('cat.nameRequired'));
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append('id', form.id);
    fd.append('name', form.name.trim());
    fd.append('barcode', form.barcode.trim());
    fd.append('price', String(parseMoney(form.price)));
    fd.append('category', form.category);
    fd.append('quantity', form.quantity || '0');
    fd.append('stock', form.trackStock ? '1' : 'on');
    fd.append('img', form.img);
    try {
      await api.saveProduct(fd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('BARCODE_TAKEN:')) {
        setError(t('cat.barcodeTaken', { name: msg.slice('BARCODE_TAKEN:'.length) }));
      } else {
        setError(msg || t('team.saveFailed'));
      }
      return;
    }
    setForm(emptyProduct);
    await onChanged();
    // Back to the barcode box: stocking a shelf is scan → name → price → Enter, repeat.
    barcodeRef.current?.focus();
  };

  const editProduct = (p: Product) => {
    setForm({
      id: String(p.id),
      name: p.name,
      barcode: p.barcode || '',
      price: String(Math.round(Number(p.price))),
      category: p.category,
      quantity: String(p.quantity),
      trackStock: !!p.stock,
      img: p.img || '',
    });
    setTab('products');
  };

  const removeProduct = async (id: number) => {
    if (!confirm(t('cat.deleteProduct'))) return;
    await api.deleteProduct(id);
    await onChanged();
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const f = filter.trim().toLowerCase();
  const visible = list.filter(
    (p) =>
      !f ||
      p.name.toLowerCase().includes(f) ||
      (p.category || '').toLowerCase().includes(f) ||
      (p.barcode || '').includes(f) ||
      String(p.id) === f
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.includes(p.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map((p) => p.id));
      setSelected((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...visible.map((p) => p.id)])));
    }
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!confirm(t('cat.deleteMany', { n: selected.length }))) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProducts(selected);
      setSelected([]);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cat.bulkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const seedDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.seedDemo();
      await onChanged();
      setNotice(
        t('cat.seeded', {
          p: result.productsAdded,
          c: result.categoriesAdded,
          u: result.customersAdded,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cat.seedFailed'));
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    if (editCatId) {
      await api.updateCategory({ id: editCatId, name: catName.trim() });
    } else {
      await api.saveCategory({ name: catName.trim() });
    }
    setCatName('');
    setEditCatId(null);
    await onChanged();
  };

  const removeCategory = async (id: number) => {
    if (!confirm(t('cat.deleteCategory'))) return;
    await api.deleteCategory(id);
    await onChanged();
  };

  return (
    <div>
      <div className="chips" style={{ paddingInlineStart: 0, border: 0, marginBottom: '1rem' }}>
        {canProducts && (
          <button
            type="button"
            className={`chip ${tab === 'products' ? 'active' : ''}`}
            onClick={() => setTab('products')}
          >
            {t('cat.products')}
          </button>
        )}
        {canCategories && (
          <button
            type="button"
            className={`chip ${tab === 'categories' ? 'active' : ''}`}
            onClick={() => setTab('categories')}
          >
            {t('cat.categories')}
          </button>
        )}
        {canProducts && (
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="btn" disabled={busy} onClick={seedDemo}>
              {t('cat.seed')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || !selected.length}
              onClick={bulkDelete}
            >
              {t('cat.deleteSelected', { n: selected.length })}
            </button>
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {notice && (
        <div className="notice">
          {notice}{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setNotice(null)}>
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {tab === 'products' && canProducts && (
        <div className="page-grid">
          <div className="panel" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{form.id ? t('cat.editProduct') : t('cat.newProduct')}</h3>
            <div className="field">
              <label>{t('cat.barcode')}</label>
              <input
                ref={barcodeRef}
                className="barcode"
                value={form.barcode}
                inputMode="numeric"
                placeholder={t('cat.barcodePlaceholder')}
                onChange={(e) => setForm({ ...form, barcode: e.target.value.replace(/\s/g, '') })}
                onKeyDown={(e) => {
                  // A scanner sends the digits then Enter — jump to the name field.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    nameRef.current?.focus();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="field">
              <label>{t('common.name')}</label>
              <input
                ref={nameRef}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t('cat.price', { symbol })}</label>
              <input
                inputMode="numeric"
                className="num-ltr"
                value={form.price ? formatNumber(parseMoney(form.price)) : ''}
                onChange={(e) => setForm({ ...form, price: String(parseMoney(e.target.value) || '') })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveProduct();
                }}
              />
            </div>
            <div className="field">
              <label>{t('cat.category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">{t('common.none')}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <input
                type="checkbox"
                checked={form.trackStock}
                onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
              />
              {t('cat.trackStock')}
            </label>
            {form.trackStock && (
              <div className="field">
                <label>{t('cat.qty')}</label>
                <input
                  type="number"
                  min={0}
                  className="num-ltr"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            )}
            <PhotoPicker
              value={form.img}
              onChange={(img) => setForm({ ...form, img })}
              suggestedQuery={form.name || form.category}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={saveProduct}>
                {form.id ? t('cat.updateProduct') : t('cat.addProduct')}
              </button>
              {form.id && (
                <button type="button" className="btn" onClick={() => setForm(emptyProduct)}>
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </div>

          <div className="panel" style={{ padding: '1rem' }}>
            <div className="field">
              <label>{t('cat.search')}</label>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('cat.searchPlaceholder')}
              />
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      title={t('cat.selectAll')}
                      aria-label={t('cat.selectAll')}
                    />
                  </th>
                  <th />
                  <th>{t('cat.colName')}</th>
                  <th>{t('cat.colBarcode')}</th>
                  <th>{t('cat.colPrice')}</th>
                  <th>{t('cat.colStock')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        aria-label={p.name}
                      />
                    </td>
                    <td>
                      {p.img ? (
                        <img
                          src={`${uploads}/${p.img}`}
                          alt=""
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: 'cover',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                          }}
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div>{p.name}</div>
                      <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                        {p.category || t('cat.uncategorized')}
                      </div>
                    </td>
                    <td className="barcode muted">{p.barcode || '—'}</td>
                    <td className="money">{formatMoney(p.price, symbol)}</td>
                    <td className="num-ltr">{p.stock ? p.quantity : '—'}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => editProduct(p)}>
                        {t('common.edit')}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeProduct(p.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <div className="empty">{t('cat.empty')}</div>}
          </div>
        </div>
      )}

      {tab === 'categories' && canCategories && (
        <div className="page-grid">
          <div className="panel" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{editCatId ? t('cat.editCategory') : t('cat.newCategory')}</h3>
            <div className="field">
              <label>{t('common.name')}</label>
              <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCategory();
                }}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={saveCategory}>
              {editCatId ? t('cat.updateCategory') : t('cat.addCategory')}
            </button>
          </div>
          <div className="panel" style={{ padding: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditCatId(c.id);
                          setCatName(c.name);
                        }}
                      >
                        {t('common.edit')}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeCategory(c.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
