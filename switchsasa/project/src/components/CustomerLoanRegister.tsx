import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Plus, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type CustomerLoan = {
  id: string;
  customer_number: string;
  customer_name: string | null;
  phone_no: string | null;
  dis_date: string | null;
  amount: number | null;
  late: number | null;
  interest: number | null;
  total_amount: number | null;
  payment: number | null;
  balance: number | null;
  pay_date: string | null;
  location: string | null;
  dhamana: string | null;
  occupation: string | null;
  mdhamini: string | null;
  mdhamini_no: string | null;
};

type PaymentDialogProps = { customer: CustomerLoan; onClose: () => void; onSaved: () => void };

const today = new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(value);
const normalizePhone = (value: string) => value.replace(/\s+/g, '').trim();
const genericError = 'Could not save this record. Please check the details and try again.';

export default function CustomerLoanRegister() {
  const [customers, setCustomers] = useState<CustomerLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'owing' | 'paid'>('all');
  const [showRegistration, setShowRegistration] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<CustomerLoan | null>(null);
  const [error, setError] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('customers')
      .select('id,customer_number,customer_name,phone_no,dis_date,amount,late,interest,total_amount,payment,balance,pay_date,location,dhamana,occupation,mdhamini,mdhamini_no')
      .not('amount', 'is', null)
      .order('created_at', { ascending: false });
    if (loadError) setError('Could not load the customer register.');
    setCustomers((data as CustomerLoan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void loadCustomers(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesText = !normalized || [customer.customer_name, customer.phone_no, customer.location]
        .some((value) => value?.toLowerCase().includes(normalized));
      const matchesFilter = filter === 'all' || (filter === 'owing' ? Number(customer.balance) > 0 : Number(customer.balance) === 0);
      return matchesText && matchesFilter;
    });
  }, [customers, filter, query]);

  const totals = useMemo(() => customers.reduce((result, customer) => ({
    disbursed: result.disbursed + Number(customer.amount ?? 0),
    collected: result.collected + Number(customer.payment ?? 0),
    balance: result.balance + Number(customer.balance ?? 0),
  }), { disbursed: 0, collected: 0, balance: 0 }), [customers]);

  return <section className="workspace-content loan-register-content">
    <div className="workspace-heading register-heading">
      <div><p className="red-kicker">TAARIFA ZA WATEJA NA MIKOPO</p><h2>Customer loan register</h2></div>
      <button className="register-button" onClick={() => { setError(''); setShowRegistration(true); }}><Plus size={15} /> Register customer</button>
    </div>
    {error && <p className="register-error"><AlertTriangle size={15} /> {error}</p>}
    <div className="register-metrics">
      <div><span>Total disbursed</span><strong>TZS {money(totals.disbursed)}</strong></div>
      <div><span>Total collected</span><strong>TZS {money(totals.collected)}</strong></div>
      <div><span>Total balance</span><strong>TZS {money(totals.balance)}</strong></div>
    </div>
    <div className="register-toolbar">
      <label className="register-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or location" /></label>
      <div className="register-filters" role="group" aria-label="Balance filter">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'owing' ? 'active' : ''} onClick={() => setFilter('owing')}>Wadaiwa</button>
        <button className={filter === 'paid' ? 'active' : ''} onClick={() => setFilter('paid')}>Wamelipa</button>
      </div>
    </div>
    <div className="loan-register-table">
      <table><thead><tr><th>NO</th><th>Customer name</th><th>Phone no</th><th>Dis date</th><th>Amount</th><th>Late</th><th>Interest</th><th>Total amount</th><th>Payment</th><th>Balance</th><th>Pay date</th><th>Location</th><th>Dhamana</th><th>Occupation</th><th>Mdhamini</th><th>Mdhamini no</th><th>Action</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={17} className="register-empty">Loading customer records…</td></tr> : filtered.length === 0 ? <tr><td colSpan={17} className="register-empty">No customer records match your search.</td></tr> : filtered.map((customer) => <tr key={customer.id}>
          <td className="number-cell">{customer.customer_number}</td><td className="name-cell">{customer.customer_name ?? '—'}</td><td>{customer.phone_no ?? '—'}</td><td>{customer.dis_date ?? '—'}</td><td>TZS {money(Number(customer.amount ?? 0))}</td><td>TZS {money(Number(customer.late ?? 0))}</td><td>TZS {money(Number(customer.interest ?? 0))}</td><td className="total-cell">TZS {money(Number(customer.total_amount ?? 0))}</td><td>TZS {money(Number(customer.payment ?? 0))}</td><td className={Number(customer.balance) > 0 ? 'balance-cell owing' : 'balance-cell paid'}>TZS {money(Number(customer.balance ?? 0))}{Number(customer.payment ?? 0) > Number(customer.total_amount ?? 0) && <small> OVERPAID</small>}</td><td>{customer.pay_date ?? '—'}</td><td>{customer.location ?? '—'}</td><td>{customer.dhamana ?? '—'}</td><td>{customer.occupation ?? '—'}</td><td>{customer.mdhamini ?? '—'}</td><td>{customer.mdhamini_no ?? '—'}</td><td><button className="pay-button" onClick={() => setPayingCustomer(customer)}><CreditCard size={14} /> Pay</button></td>
        </tr>)}</tbody></table>
    </div>
    {showRegistration && <RegistrationDialog onClose={() => setShowRegistration(false)} onSaved={() => { setShowRegistration(false); void loadCustomers(); }} />}
    {payingCustomer && <PaymentDialog customer={payingCustomer} onClose={() => setPayingCustomer(null)} onSaved={() => { setPayingCustomer(null); void loadCustomers(); }} />}
  </section>;
}

function RegistrationDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customerName: '', phoneNo: '', location: '', occupation: '', disDate: today, amount: '', late: '0', interest: '0', dhamana: '', mdhamini: '', mdhaminiNo: '' });
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [saving, setSaving] = useState(false);
  const total = Number(form.amount || 0) + Number(form.late || 0) + Number(form.interest || 0);
  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setWarning('');
    const phone = normalizePhone(form.phoneNo);
    if (!/^(0[67][0-9]{8}|\+255[67][0-9]{8})$/.test(phone)) { setError('Use a Tanzanian phone number such as 0712345678 or +255712345678.'); return; }
    if (form.disDate > today) { setError('Disbursement date cannot be in the future.'); return; }
    if (Number(form.amount) <= 0 || Number(form.late) < 0 || Number(form.interest) < 0) { setError('Amount must be greater than zero and fees cannot be negative.'); return; }
    const duplicate = await supabase.from('customers').select('id').eq('phone_no', phone).maybeSingle();
    if (duplicate.data) { setWarning('This phone number is already registered. Check the number before continuing.'); return; }
    setSaving(true);
    const result = await supabase.rpc('register_customer_loan', { p_customer_name: form.customerName, p_phone_no: phone, p_dis_date: form.disDate, p_amount: Number(form.amount), p_late: Number(form.late || 0), p_interest: Number(form.interest || 0), p_location: form.location, p_dhamana: form.dhamana, p_occupation: form.occupation, p_mdhamini: form.mdhamini, p_mdhamini_no: normalizePhone(form.mdhaminiNo) });
    if (result.error) setError(result.error.code === '23505' ? 'This phone number is already registered.' : genericError); else onSaved();
    setSaving(false);
  };
  return <div className="registration-overlay"><form className="registration-card loan-registration-card" onSubmit={submit}><div className="registration-heading"><div><p className="red-kicker">CUSTOMER REGISTRATION</p><h2>Register customer and loan</h2><p>Complete the customer, loan and guarantor details.</p></div><button type="button" onClick={onClose}><X size={18} /></button></div><div className="form-section"><h3>A · Taarifa za Mteja</h3><div className="form-grid"><label>Customer name<input value={form.customerName} onChange={(event) => setField('customerName', event.target.value)} required /></label><label>Phone no<input value={form.phoneNo} onChange={(event) => setField('phoneNo', event.target.value)} required placeholder="0712345678" /></label><label>Location<input value={form.location} onChange={(event) => setField('location', event.target.value)} placeholder="Mbagala, Kariakoo" /></label><label>Occupation<input value={form.occupation} onChange={(event) => setField('occupation', event.target.value)} /></label></div></div><div className="form-section"><h3>B · Taarifa za Mkopo</h3><div className="form-grid"><label>Dis date<input type="date" max={today} value={form.disDate} onChange={(event) => setField('disDate', event.target.value)} required /></label><label>Amount<input type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} required /></label><label>Late<input type="number" min="0" step="0.01" value={form.late} onChange={(event) => setField('late', event.target.value)} /></label><label>Interest<input type="number" min="0" step="0.01" value={form.interest} onChange={(event) => setField('interest', event.target.value)} /></label><label className="calculated-field">Total amount<strong>TZS {money(total)}</strong></label><label>Dhamana<input value={form.dhamana} onChange={(event) => setField('dhamana', event.target.value)} placeholder="Collateral / guarantor asset" /></label></div></div><div className="form-section"><h3>C · Mdhamini</h3><div className="form-grid"><label>Mdhamini<input value={form.mdhamini} onChange={(event) => setField('mdhamini', event.target.value)} /></label><label>Mdhamini no<input value={form.mdhaminiNo} onChange={(event) => setField('mdhaminiNo', event.target.value)} placeholder="0712345678" /></label></div></div>{warning && <p className="register-warning"><AlertTriangle size={15} /> {warning}</p>}{error && <p className="auth-error">{error}</p>}<div className="registration-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save customer'} <CheckCircle2 size={15} /></button></div></form></div>;
}

function PaymentDialog({ customer, onClose, onSaved }: PaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [payDate, setPayDate] = useState(today);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (Number(amount) <= 0 || payDate > today) { setError('Enter a positive amount and a payment date that is not in the future.'); return; }
    setSaving(true);
    const result = await supabase.rpc('record_customer_payment', { p_customer_id: customer.id, p_amount_paid: Number(amount), p_pay_date: payDate });
    if (result.error) setError(genericError); else onSaved();
    setSaving(false);
  };
  return <div className="registration-overlay"><form className="registration-card payment-card" onSubmit={submit}><div className="registration-heading"><div><p className="red-kicker">PAYMENT</p><h2>Record payment</h2><p>{customer.customer_name} · Current balance TZS {money(Number(customer.balance ?? 0))}</p></div><button type="button" onClick={onClose}><X size={18} /></button></div><label>Payment amount<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required autoFocus /></label><label>Pay date<input type="date" max={today} value={payDate} onChange={(event) => setPayDate(event.target.value)} required /></label>{error && <p className="auth-error">{error}</p>}<div className="registration-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save payment'} <CheckCircle2 size={15} /></button></div></form></div>;
}
