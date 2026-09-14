import { useRef } from 'react';
import { formatNumber, IQD_NOTES, parseMoney } from '../money';
import { useT } from '../i18n';

type Props = {
  value: string;
  onChange: (value: string) => void;
  due: number;
  symbol: string;
};

/**
 * Cash pad for whole-dinar amounts. The value is kept as a plain digit string
 * ("12500"); formatting happens in the display. There is no decimal key — instead a
 * "000" key, because Iraqi prices are almost always round thousands.
 */
export default function PaymentPad({ value, onChange, due }: Props) {
  const { t } = useT();
  // After Exact / note pick, the next digit replaces instead of appending.
  const replaceNext = useRef(false);

  const setAmount = (amount: number) => {
    onChange(String(Math.round(amount)));
    replaceNext.current = true;
  };

  const append = (key: string) => {
    if (key === 'C') {
      onChange('');
      replaceNext.current = false;
      return;
    }
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      replaceNext.current = false;
      return;
    }
    if (replaceNext.current || value === '' || value === '0') {
      onChange(key === '000' ? '' : key);
      replaceNext.current = false;
      return;
    }
    const next = value + key;
    if (next.length > 9) return; // 999,999,999 IQD is plenty for a till
    onChange(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];
  const current = parseMoney(value);

  return (
    <>
      <div className="quick-cash">
        <button type="button" className="btn btn-primary" onClick={() => setAmount(due)}>
          {t('pay.exact')}
        </button>
        {IQD_NOTES.map((note) => (
          <button
            key={note}
            type="button"
            className="btn"
            // Tapping a note adds it to what's already tendered, so 25,000 + 5,000 works
            // the way a cashier counts notes on the counter.
            onClick={() => {
              const base = replaceNext.current || !value ? 0 : current;
              onChange(String(base + note));
              replaceNext.current = false;
            }}
          >
            <span className="money">{formatNumber(note)}</span>
          </button>
        ))}
      </div>
      <div className="numpad">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className={k === '000' ? 'wide-key' : ''}
            onClick={() => append(k)}
          >
            {k}
          </button>
        ))}
        <button type="button" className="numpad-clear" onClick={() => append('C')}>
          {t('pay.clear')}
        </button>
      </div>
    </>
  );
}
