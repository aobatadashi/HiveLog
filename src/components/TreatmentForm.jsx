import { useState } from 'react';

const COMMON_PRODUCTS = [
  { label: 'Apivar', value: 'Apivar' },
  { label: 'Apiguard', value: 'Apiguard' },
  { label: 'Formic Pro', value: 'Formic Pro' },
  { label: 'OAV', value: 'Oxalic Acid Vaporization' },
];

const APPLICATION_METHODS = [
  'Strips',
  'Drizzle',
  'Sublimation',
  'Dusting',
  'Spray',
  'Other',
];

export default function TreatmentForm({ value, onChange }) {
  const [customProduct, setCustomProduct] = useState(
    value?.product_name && !COMMON_PRODUCTS.some((p) => p.value === value.product_name)
      ? value.product_name
      : ''
  );

  function update(field, val) {
    onChange({ ...value, [field]: val });
  }

  const selectedProduct = value?.product_name || '';

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '2px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md)',
      marginBottom: 'var(--space-lg)',
    }}>
      <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
        Treatment Details
      </h3>

      {/* Product quick-select */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
        Product *
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
        {COMMON_PRODUCTS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              update('product_name', p.value);
              setCustomProduct('');
            }}
            style={{
              minHeight: 'var(--touch-min)',
              borderRadius: 'var(--radius-sm)',
              border: selectedProduct === p.value ? '3px solid var(--color-accent)' : '2px solid var(--color-border)',
              backgroundColor: selectedProduct === p.value ? 'var(--color-accent)' : 'var(--color-surface)',
              color: selectedProduct === p.value ? 'var(--color-accent-text)' : 'var(--color-text)',
              fontWeight: 600,
              fontSize: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Or type product name..."
        value={customProduct}
        onChange={(e) => {
          setCustomProduct(e.target.value);
          update('product_name', e.target.value.trim());
        }}
        style={{ marginBottom: 'var(--space-lg)' }}
      />

      {/* Dosage */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
        Dosage
      </label>
      <input
        type="text"
        placeholder="e.g. 2 strips, 50ml"
        value={value?.dosage || ''}
        onChange={(e) => update('dosage', e.target.value)}
        style={{ marginBottom: 'var(--space-lg)' }}
      />

      {/* Application Method */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
        Application Method
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        {APPLICATION_METHODS.map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => update('application_method', value?.application_method === method ? null : method)}
            style={{
              minHeight: 56,
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              border: value?.application_method === method ? '3px solid var(--color-accent)' : '2px solid var(--color-border)',
              backgroundColor: value?.application_method === method ? 'var(--color-accent)' : 'var(--color-surface)',
              color: value?.application_method === method ? 'var(--color-accent-text)' : 'var(--color-text)',
              fontWeight: 600,
              fontSize: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {method}
          </button>
        ))}
      </div>

      {/* Withdrawal Period */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
        Withdrawal Period (days)
      </label>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        placeholder="e.g. 42"
        value={value?.withdrawal_period_days ?? ''}
        onChange={(e) => update('withdrawal_period_days', e.target.value ? parseInt(e.target.value, 10) : null)}
        style={{ marginBottom: 'var(--space-lg)', maxWidth: '150px' }}
      />

      {/* Lot Number */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
        Lot Number
      </label>
      <input
        type="text"
        placeholder="Optional"
        value={value?.lot_number || ''}
        onChange={(e) => update('lot_number', e.target.value)}
      />
    </div>
  );
}
