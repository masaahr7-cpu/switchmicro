import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isAdminRole, type StaffRole } from '@/config/roles';

type PendingClient = {
  id: string;
  full_name: string;
  customer_number: string;
  phone: string;
  occupation: string | null;
  kyc_status: string;
  created_at: string;
};

export default function ClientApprovals({ role }: { role: StaffRole }) {
  const admin = isAdminRole(role);
  const [pending, setPending] = useState<PendingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('customers')
      .select('id,full_name,customer_number,phone,occupation,kyc_status,created_at')
      .eq('kyc_status', 'Pending')
      .order('created_at', { ascending: false });
    if (loadError) setError('Could not load pending clients.');
    setPending((data as PendingClient[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const approve = async (clientId: string, name: string) => {
    setBusy(clientId); setError('');
    const { error: rpcError } = await supabase.rpc('approve_customer_kyc', { p_customer_id: clientId });
    if (rpcError) setError(rpcError.message.includes('CEO') ? 'Only the CEO / MD can approve clients.' : 'Could not approve this client.');
    else setPending((current) => current.filter((client) => client.id !== clientId));
    setBusy('');
  };

  if (loading) return <div className="workspace-loading">Loading pending approvals…</div>;

  return <section className="workspace-content">
    <div className="workspace-heading">
      <div><p className="red-kicker">CLIENT APPROVALS</p><h2>Pending KYC approvals</h2></div>
      <span className="workspace-count">{pending.length} pending</span>
    </div>
    {error && <p className="auth-error">{error}</p>}
    {pending.length === 0 ? (
      <div className="empty-workspace">No clients are waiting for approval.</div>
    ) : (
      <div className="workspace-table">
        <div className="table-head"><span>Client</span><span>Number</span><span>Phone</span><span>Occupation</span><span>Registered</span><span>Action</span></div>
        {pending.map((client) => <div className="table-row" key={client.id}>
          <strong>{client.full_name}</strong>
          <span>{client.customer_number}</span>
          <span>{client.phone}</span>
          <span>{client.occupation ?? '—'}</span>
          <time>{new Date(client.created_at).toLocaleDateString()}</time>
          {admin
            ? <button className="row-approve" disabled={busy === client.id} onClick={() => void approve(client.id, client.full_name)}><CheckCircle2 size={14} /> {busy === client.id ? 'Approving…' : 'Approve'}</button>
            : <span className="stage overdue"><Clock3 size={12} /> Awaiting CEO</span>}
        </div>)}
      </div>
    )}
    {!admin && <p className="workspace-note"><ShieldCheck size={14} /> Only the CEO / MD can approve new clients. Registered clients remain pending until approved.</p>}
  </section>;
}
