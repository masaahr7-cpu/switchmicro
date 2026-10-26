import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isAdminRole, type StaffRole } from '@/config/roles';

type LoanProduct = {
  id: string;
  name: string;
  category: string;
  interest_rate: number;
  term_months: number;
  repayment_frequency: string;
  minimum_amount: number;
  maximum_amount: number;
  status: string;
};

const formatMoney = (value: number) => new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(value);

export default function LoanProductsPanel({ role, products, onReload }: { role: StaffRole; products: LoanProduct[]; onReload: () => void }) {
  const admin = isAdminRole(role);
  const [editing, setEditing] = useState<LoanProduct | null>(null);
  const [adding, setAdding] = useState(false);

  return <section className="workspace-content">
    <div className="workspace-heading">
      <div><p className="red-kicker">PRODUCT CATALOGUE</p><h2>Loan products</h2></div>
      <div className="workspace-stats">
        <span><strong>{products.length}</strong> products</span>
        {admin && <button className="register-button" onClick={() => setAdding(true)}><Plus size={15} /> Add product</button>}
      </div>
    </div>
    <div className="workspace-table">
      <div className="table-head"><span>Product</span><span>Category</span><span>Rate / term</span><span>Limit</span><span>Status</span>{admin && <span>Action</span>}</div>
      {products.map((product) => <div className="table-row" key={product.id}>
        <strong>{product.name}</strong>
        <span>{product.category}</span>
        <span>{product.interest_rate}% · {product.term_months} months</span>
        <span>{formatMoney(product.minimum_amount)} – {formatMoney(product.maximum_amount)}</span>
        <span className={`stage ${product.status === 'Active' ? 'approved' : 'overdue'}`}>{product.status}</span>
        {admin && <span className="row-actions">
          <button className="row-edit" onClick={() => setEditing(product)}><Pencil size={13} /> Edit</button>
          <button className="row-delete" onClick={() => void deleteProduct(product, onReload)}><Trash2 size={13} /> Delete</button>
        </span>}
      </div>)}
    </div>
    {!admin && <p className="workspace-note">Only the CEO / MD can add, edit or delete loan products.</p>}
    {adding && <ProductDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onReload(); }} />}
    {editing && <ProductDialog product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onReload(); }} />}
  </section>;
}

async function deleteProduct(product: LoanProduct, onReload: () => void) {
  if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
  const { error } = await supabase.rpc('delete_loan_product', { p_id: product.id });
  if (error) window.alert('Could not delete this product.');
  else onReload();
}

function ProductDialog({ product, onClose, onSaved }: { product?: LoanProduct; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    category: product?.category ?? '',
    interest_rate: String(product?.interest_rate ?? 18),
    term_months: String(product?.term_months ?? 12),
    repayment_frequency: product?.repayment_frequency ?? 'Monthly',
    minimum_amount: String(product?.minimum_amount ?? 500000),
    maximum_amount: String(product?.maximum_amount ?? 25000000),
    status: product?.status ?? 'Active',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (!form.name.trim() || !form.category.trim()) { setError('Name and category are required.'); return; }
    if (Number(form.interest_rate) < 0 || Number(form.term_months) <= 0) { setError('Interest rate and term must be valid.'); return; }
    if (Number(form.minimum_amount) < 0 || Number(form.maximum_amount) < Number(form.minimum_amount)) { setError('Amount limits are invalid.'); return; }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('upsert_loan_product', {
      p_id: product?.id ?? null,
      p_name: form.name, p_category: form.category,
      p_interest_rate: Number(form.interest_rate), p_term_months: Number(form.term_months),
      p_repayment_frequency: form.repayment_frequency,
      p_minimum_amount: Number(form.minimum_amount), p_maximum_amount: Number(form.maximum_amount),
      p_status: form.status,
    });
    if (rpcError) setError(rpcError.message.includes('CEO') ? 'Only the CEO / MD can manage products.' : 'Could not save this product.');
    else onSaved();
    setSaving(false);
  };

  return <div className="registration-overlay"><form className="registration-card" onSubmit={submit}>
    <div className="registration-heading"><div><p className="red-kicker">{product ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</p><h2>{product ? 'Edit loan product' : 'Add loan product'}</h2></div><button type="button" onClick={onClose}><X size={18} /></button></div>
    <label>Product name<input value={form.name} onChange={(e) => setField('name', e.target.value)} required /></label>
    <label>Category<input value={form.category} onChange={(e) => setField('category', e.target.value)} required placeholder="Microloan, Business, Farmer" /></label>
    <div className="form-grid">
      <label>Interest rate %<input type="number" min="0" step="0.1" value={form.interest_rate} onChange={(e) => setField('interest_rate', e.target.value)} required /></label>
      <label>Term (months)<input type="number" min="1" value={form.term_months} onChange={(e) => setField('term_months', e.target.value)} required /></label>
      <label>Min amount<input type="number" min="0" value={form.minimum_amount} onChange={(e) => setField('minimum_amount', e.target.value)} required /></label>
      <label>Max amount<input type="number" min="0" value={form.maximum_amount} onChange={(e) => setField('maximum_amount', e.target.value)} required /></label>
      <label>Repayment frequency<select value={form.repayment_frequency} onChange={(e) => setField('repayment_frequency', e.target.value)}><option>Monthly</option><option>Weekly</option><option>Bi-weekly</option></select></label>
      <label>Status<select value={form.status} onChange={(e) => setField('status', e.target.value)}><option>Active</option><option>Inactive</option></select></label>
    </div>
    {error && <p className="auth-error">{error}</p>}
    <div className="registration-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save product'} <CheckCircle2 size={15} /></button></div>
  </form></div>;
}
