import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, Printer, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FormType = 'loan_application' | 'guarantor' | 'loan_agreement';
type FieldMap = Record<string, string>;

type ClientFormsProps = {
  onClose: () => void;
};

const today = new Date().toISOString().slice(0, 10);
const formNames: Record<FormType, string> = {
  loan_application: 'Fomu ya Maombi ya Mkopo',
  guarantor: 'Fomu ya Udhamini',
  loan_agreement: 'Mkataba wa Kukopesha Fedha',
};

function downloadPrintable(type: FormType) {
  const blob = new Blob([printableDownload(type)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${formNames[type].toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

const initialValues: Record<FormType, FieldMap> = {
  loan_application: { jina: '', umri: '', makazi: '', email: '', kiasi: '', madhumuni: '', guarantorName: '', guarantorPhone: '', guarantorJob: '', guarantorSignature: '', date: today, officerName: '', officerDetails: '', officerWitness: '', officerSignature: '' },
  guarantor: { jina: '', jinsia: '', umri: '', makazi: '', simu: '', kitambulisho: '', borrowerName: '', borrowerAmount: '', borrowerMonths: '', witnessName: '', witnessDetails: '', witnessSignature: '', guarantorSignature: '', date: today },
  loan_agreement: { borrowerName: '', borrowerId: '', borrowerAddress: '', borrowerPhone: '', loanAmount: '', loanPurpose: '', loanMonths: '', startDate: today, guarantorName: '', guarantorId: '', guarantorAddress: '', collateral: '', collateralDetails: '', borrowerSignature: '', witnessSignature: '', managerSignature: '', managerName: '', date: today },
};

export default function ClientForms({ onClose }: ClientFormsProps) {
  const [activeType, setActiveType] = useState<FormType | null>(null);
  const [values, setValues] = useState<FieldMap>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const openForm = (type: FormType) => {
    setActiveType(type);
    setValues({ ...initialValues[type] });
    setSaved(false);
    setError('');
  };

  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeType) return;
    setError('');
    setSaved(false);
    const result = await supabase.from('client_form_submissions').insert({ form_type: activeType, payload: values });
    if (result.error) {
      setError('Fomu haijahifadhiwa. Tafadhali jaribu tena.');
      return;
    }
    setSaved(true);
  };

  const printForm = () => window.print();

  const downloadBlank = () => {
    if (!activeType) return;
    downloadPrintable(activeType);
  };

  if (!activeType) return <section className="client-forms-page">
    <div className="client-forms-toolbar"><button className="back-link" onClick={onClose}><ArrowLeft size={16} /> Back to client area</button><span>SWITCH MICROFINANCE LTD</span></div>
    <div className="client-forms-intro"><p className="red-kicker">CLIENT DOCUMENT CENTRE</p><h1>Official Switch forms</h1><p>Fill the official forms online exactly as printed, or download a blank copy to print and complete by hand.</p></div>
    <div className="form-choice-grid">
      <FormChoice type="loan_application" title="Fomu ya Maombi ya Mkopo" description="Loan application form for an individual borrower." onClick={openForm} />
      <FormChoice type="guarantor" title="Fomu ya Udhamini" description="Guarantor details, undertaking and witness signatures." onClick={openForm} />
      <FormChoice type="loan_agreement" title="Mkataba wa Kukopesha Fedha" description="Loan agreement, repayment terms and collateral details." onClick={openForm} />
    </div>
    <p className="forms-footnote"><FileText size={15} /> Online submissions are saved securely for the Switch Microfinance team to review.</p>
  </section>;

  return <section className="client-forms-page form-editor-page">
    <div className="client-forms-toolbar no-print"><button className="back-link" onClick={() => setActiveType(null)}><ArrowLeft size={16} /> All forms</button><span>{formNames[activeType]}</span><button className="close-form" onClick={onClose}><X size={18} /></button></div>
    <form className="official-form" onSubmit={submit}>
      <FormHeader />
      {activeType === 'loan_application' && <LoanApplicationForm values={values} update={update} />}
      {activeType === 'guarantor' && <GuarantorForm values={values} update={update} />}
      {activeType === 'loan_agreement' && <LoanAgreementForm values={values} update={update} />}
      {error && <p className="form-error no-print">{error}</p>}
      {saved && <p className="form-success no-print"><CheckCircle2 size={16} /> Fomu imehifadhiwa na imetumwa kwa Switch Microfinance.</p>}
      <div className="form-action-bar no-print"><button type="button" className="form-secondary" onClick={downloadBlank}><Download size={15} /> Download blank copy</button><button type="button" className="form-secondary" onClick={printForm}><Printer size={15} /> Print / save PDF</button><button className="form-primary"><Save size={15} /> Tuma fomu online</button></div>
    </form>
  </section>;
}

function FormChoice({ type, title, description, onClick }: { type: FormType; title: string; description: string; onClick: (type: FormType) => void }) {
  return <article className="form-choice-card"><div className={`form-choice-mark ${type}`}><FileText size={25} /></div><h2>{title}</h2><p>{description}</p><div className="form-choice-actions"><button className="form-primary" onClick={() => onClick(type)}>Fill online</button><button className="form-secondary" onClick={() => downloadPrintable(type)}><Download size={14} /> Download</button></div></article>;
}

function FormHeader() {
  return <header className="official-form-header"><div className="official-brand"><img src="/logo.png" alt="Switch Microfinance Limited" /><div><strong>SWITCH</strong><span>MICROFINANCE LIMITED</span><small>— SWITCHING LIVES FINANCIALLY —</small></div></div><div className="official-contact"><span>◯ +255 765 407 407</span><span>◯ +255 616 761 909</span><span>⌖ Soko Matola adjacent to<br />Public Service College</span></div></header>;
}

function FormTitle({ children }: { children: string }) { return <h2 className="official-form-title">{children}</h2>; }
function SectionTitle({ number, children }: { number: string; children: string }) { return <h3 className="official-section-title"><b>{number}</b>{children}</h3>; }
function LineInput({ label, value, onChange, required = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) { return <label className="line-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>; }
function BoxInput({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="box-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>; }
function SignatureLine({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="signature-line"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>; }

function LoanApplicationForm({ values, update }: { values: FieldMap; update: (key: string, value: string) => void }) {
  return <div className="official-form-body"><FormTitle>FOMU YA MAOMBI YA MKOPO</FormTitle><SectionTitle number="1.0">TAARIFA ZA MKOPAJI</SectionTitle><div className="form-two-col"><div><LineInput label="JINA:" value={values.jina} onChange={(v) => update('jina', v)} required /><LineInput label="UMRI:" value={values.umri} onChange={(v) => update('umri', v)} /><LineInput label="MAKAZI:" value={values.makazi} onChange={(v) => update('makazi', v)} /><LineInput label="EMAIL/SIMU:" value={values.email} onChange={(v) => update('email', v)} /></div><div className="photo-box">PICHA</div></div><SectionTitle number="2.0">TAMKO LA MKOPAJI</SectionTitle><p className="official-copy">Mimi, <InlineInput value={values.jina} onChange={(v) => update('jina', v)} /> mwenye taarifa tajwa hapo juu ninaomba kukupata mkopo wa Shilingi za Kitanzania <InlineInput value={values.kiasi} onChange={(v) => update('kiasi', v)} /> ninaahidi kuweka dhamana ambayo ni <InlineInput value={values.madhumuni} onChange={(v) => update('madhumuni', v)} /> na wadhamini wangu ni <InlineInput value={values.guarantorName} onChange={(v) => update('guarantorName', v)} />.</p><SectionTitle number="3.0">UTHIBITISHO WA SEREKALI</SectionTitle><div className="two-signatures"><SignatureLine label="JINA:" value={values.officerName} onChange={(v) => update('officerName', v)} /><SignatureLine label="JINA:" value={values.officerWitness} onChange={(v) => update('officerWitness', v)} /><SignatureLine label="SIMU:" value={values.guarantorPhone} onChange={(v) => update('guarantorPhone', v)} /><SignatureLine label="SAHIHI:" value={values.officerSignature} onChange={(v) => update('officerSignature', v)} /></div><SectionTitle number="4.0">UTHIBITISHO</SectionTitle><p className="official-copy">Mimi, <InlineInput value={values.jina} onChange={(v) => update('jina', v)} /> ninathibitisha kuwa taarifa nilizotoa kwenye fomu hii ni za kweli na nimekubali masharti ya mkopo.</p><div className="date-row"><span>NINATHIBITISHA hapa MBEYA leo Tarehe</span><LineInput label="" type="date" value={values.date} onChange={(v) => update('date', v)} /></div><SignatureLine label="SAHIHI YA MKOPAJI" value={values.borrowerSignature} onChange={(v) => update('borrowerSignature', v)} /><OfficerTable values={values} update={update} /></div>;
}

function GuarantorForm({ values, update }: { values: FieldMap; update: (key: string, value: string) => void }) {
  return <div className="official-form-body"><FormTitle>FOMU YA UDHAMINI</FormTitle><SectionTitle number="1.0">TAARIFA BINAFSI</SectionTitle><div className="form-two-col"><div><LineInput label="a) JINA:" value={values.jina} onChange={(v) => update('jina', v)} required /><LineInput label="b) JINSI:" value={values.jinsia} onChange={(v) => update('jinsia', v)} /><LineInput label="c) UMRI:" value={values.umri} onChange={(v) => update('umri', v)} /><LineInput label="d) MAKAZI:" value={values.makazi} onChange={(v) => update('makazi', v)} /><LineInput label="e) SIMU/ANUANI:" value={values.simu} onChange={(v) => update('simu', v)} /></div><div className="photo-box">PICHA</div></div><SectionTitle number="2.0">TAARIFA YA MKOPO</SectionTitle><p className="official-copy">Mimi <InlineInput value={values.jina} onChange={(v) => update('jina', v)} /> nikiwa na utimamu wote, ninakubali kuwa mdhamini wa <InlineInput value={values.borrowerName} onChange={(v) => update('borrowerName', v)} /> ambaye anachukua mkopo katika kampuni ya SWITCH MICROFINANCE LTD.</p><SectionTitle number="3.0">TAMKO LA UDHAMINI</SectionTitle><p className="official-copy">Mimi, <InlineInput value={values.jina} onChange={(v) => update('jina', v)} /> nikiwa na akili timamu, bila kushurutishwa na mtu yeyote ninathibitisha kuwa nitawajibika kwa deni la mkopaji endapo hataweza kulipa.</p><div className="date-row"><span>NINADHAMINI hapa MBEYA leo Tarehe</span><LineInput label="" type="date" value={values.date} onChange={(v) => update('date', v)} /></div><FormTable headers={['JINA LA OFISA', 'MAELEZO', 'UTHIBITISHO', 'SAHIHI']} rows={2} values={values} update={update} /></div>;
}

function LoanAgreementForm({ values, update }: { values: FieldMap; update: (key: string, value: string) => void }) {
  return <div className="official-form-body"><FormTitle>MKATABA WA KUKOPESHA FEDHA</FormTitle><p className="official-copy centered"><b>MAKUBALIANO</b> haya yameingiwa hapa <b>MBEYA</b> leo tarehe <InlineInput value={values.date} onChange={(v) => update('date', v)} /> mwaka 2026.</p><p className="official-copy">KATI YA <b>SWITCH MICROFINANCE LTD</b> ya SOKO MATOLA mkabala na CHUO CHA UTUMISHI WA UMMA (andani ya JILIA MBEYA - TANZANIA) mwenye simu namba +255 765 407 407 / +255 616 761 909, (hapa itajulikana kama “Mkopeshaji”) kwa upande mmoja na</p><p className="official-copy">Bw/Bi. <InlineInput value={values.borrowerName} onChange={(v) => update('borrowerName', v)} /> mwenye Namba <InlineInput value={values.borrowerId} onChange={(v) => update('borrowerId', v)} />, wa Mbeya Jiji – Tanzania (ambaye hapa anajulikana kama “Mkopaji”) kwa upande mwingine.</p><p className="official-copy">KWA MAMBO yaliyomo katika mkataba huu, Mkopeshaji amekubali kumpa Mkopaji fedha kiasi cha</p><div className="loan-summary-grid"><BoxInput label="Kiasi cha mkopo (TSh)" value={values.loanAmount} onChange={(v) => update('loanAmount', v)} required /><BoxInput label="Muda wa mkopo (miezi)" value={values.loanMonths} onChange={(v) => update('loanMonths', v)} /><BoxInput label="Madhumuni ya mkopo" value={values.loanPurpose} onChange={(v) => update('loanPurpose', v)} /><BoxInput label="Tarehe ya kuanza" value={values.startDate} onChange={(v) => update('startDate', v)} /></div><SectionTitle number="1.">MCHANGANUO WA MKOPO, RIBA NA GHARAMA ZA MCHAKATO KWA MWEZI</SectionTitle><FormTable headers={['Na.', 'ASILI YA MKOPO', 'ASILIMIA', 'KIASI (TSH)']} rows={4} values={values} update={update} /><SectionTitle number="4.">DHAMANA YA MKOPO</SectionTitle><p className="official-copy">Mkopaji anakubali kuweka dhamana ya mkopo huu kama ilivyoelezwa hapa chini.</p><div className="loan-summary-grid"><BoxInput label="Dhamana" value={values.collateral} onChange={(v) => update('collateral', v)} /><BoxInput label="Maelezo / thamani ya dhamana" value={values.collateralDetails} onChange={(v) => update('collateralDetails', v)} /><BoxInput label="Jina la mdhamini" value={values.guarantorName} onChange={(v) => update('guarantorName', v)} /><BoxInput label="Namba ya mdhamini" value={values.guarantorId} onChange={(v) => update('guarantorId', v)} /></div><h3 className="agreement-notice">KWA UTHIBITISHO WA MAKUBALIANO YALIYOTAINISHWA KWENYE MKATABA HUU, WAHUSIKA WA MKATABA WAMEWEKA SAINI ZA0 HAPA CHINI;</h3><div className="agreement-signatures"><SignatureLine label="MKOPAJI — JINA" value={values.borrowerName} onChange={(v) => update('borrowerName', v)} /><SignatureLine label="SAHIHI" value={values.borrowerSignature} onChange={(v) => update('borrowerSignature', v)} /><SignatureLine label="MDHAMINI — JINA" value={values.guarantorName} onChange={(v) => update('guarantorName', v)} /><SignatureLine label="SAHIHI" value={values.witnessSignature} onChange={(v) => update('witnessSignature', v)} /><SignatureLine label="MKOPESHAJI / CHEO" value={values.managerName} onChange={(v) => update('managerName', v)} /><SignatureLine label="SAHIHI" value={values.managerSignature} onChange={(v) => update('managerSignature', v)} /></div></div>;
}

function InlineInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input className="inline-input" value={value} onChange={(event) => onChange(event.target.value)} />; }
function OfficerTable({ values, update }: { values: FieldMap; update: (key: string, value: string) => void }) { return <FormTable headers={['JINA LA OFISA', 'MAELEZO', 'UTHIBITISHO', 'SAHIHI']} rows={2} values={values} update={update} />; }
function FormTable({ headers, rows, values, update }: { headers: string[]; rows: number; values: FieldMap; update: (key: string, value: string) => void }) { return <table className="official-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{Array.from({ length: rows }, (_, row) => <tr key={row}>{headers.map((_, column) => <td key={column}><input value={values[`table_${row}_${column}`] ?? ''} onChange={(event) => update(`table_${row}_${column}`, event.target.value)} /></td>)}</tr>)}</tbody></table>; }

function printableDownload(type: FormType) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${formNames[type]}</title><style>body{font-family:Arial,sans-serif;margin:0;color:#111}header{height:100px;background:#0A1E42;color:#fff;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:8px solid #E30613}header img{width:170px;background:#fff;padding:5px}h1{text-align:center;font-size:18px;text-decoration:underline;margin:18px}h2{font-size:14px;margin-top:22px;border-bottom:1px solid #111;padding-bottom:4px}p{font-size:12px;line-height:1.6}label{display:inline-block;width:48%;margin:9px 1%;font-size:12px;font-weight:bold}input{border:0;border-bottom:1px solid #111;width:60%;height:22px}table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #111;height:34px;padding:5px;font-size:11px}th{background:#eee}@media print{button{display:none}}</style></head><body><header><img src="/logo.png"><span>+255 765 407 407 · +255 616 761 909<br>Soko Matola, Mbeya</span></header><h1>${formNames[type]}</h1><h2>TAARIFA ZA MKOPAJI / MWOMBAJI</h2><label>JINA: <input></label><label>SIMU: <input></label><label>MAKAZI: <input></label><label>EMAIL: <input></label><h2>TAMKO NA TAARIFA ZA MKOPO</h2><label>KIASI CHA MKOPO: <input></label><label>MUDA: <input></label><label>MADHUMUNI: <input></label><p>Mimi ninathibitisha kuwa taarifa nilizotoa ni za kweli na ninakubali masharti ya Switch Microfinance Limited.</p><h2>UTHIBITISHO NA SAHIHI</h2><table><thead><tr><th>JINA</th><th>MAELEZO</th><th>UTHIBITISHO</th><th>SAHIHI</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table><p style="margin-top:50px">Tarehe: ____________________ &nbsp;&nbsp;&nbsp;&nbsp; Saini: ____________________</p></body></html>`;
}
