import { FormEvent, useEffect, useState } from 'react';
import { Newspaper, FileText, Plus, Trash2, Edit3, Save, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SitePost = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string;
  status: string;
  published_at: string;
  created_at: string;
};

type ContentRow = {
  id: string;
  section_key: string;
  content_value: string;
  updated_at: string;
};

const CONTENT_LABELS: Record<string, string> = {
  hero_kicker: 'Hero badge text',
  hero_title: 'Hero headline',
  hero_lead: 'Hero description',
  about_summary: 'About summary',
  about_detail: 'About detail paragraph',
  contact_phone_1: 'Primary phone number',
  contact_phone_2: 'Secondary phone number',
  contact_email: 'Contact email',
  contact_address: 'Office address',
};

type Tab = 'posts' | 'content';

export default function SiteManager() {
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<SitePost[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPost, setEditingPost] = useState<SitePost | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [editingContentKey, setEditingContentKey] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    const [postsRes, contentRes] = await Promise.all([
      supabase.from('site_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('site_content').select('*').order('section_key'),
    ]);
    if (postsRes.error) setError(postsRes.error.message);
    if (contentRes.error && !error) setError(contentRes.error.message);
    setPosts((postsRes.data as SitePost[]) ?? []);
    setContent((contentRes.data as ContentRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    const { error: delError } = await supabase.from('site_posts').delete().eq('id', id);
    if (delError) { setError(delError.message); return; }
    setPosts((current) => current.filter((p) => p.id !== id));
  };

  const togglePublish = async (post: SitePost) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    const { error: updateError } = await supabase
      .from('site_posts').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', post.id);
    if (updateError) { setError(updateError.message); return; }
    setPosts((current) => current.map((p) => p.id === post.id ? { ...p, status: newStatus } : p));
  };

  const saveContent = async (key: string) => {
    setSavingContent(true);
    const { error: upsertError } = await supabase
      .from('site_content').update({ content_value: contentDraft, updated_at: new Date().toISOString() }).eq('section_key', key);
    if (upsertError) { setError(upsertError.message); setSavingContent(false); return; }
    setContent((current) => current.map((c) => c.section_key === key ? { ...c, content_value: contentDraft } : c));
    setEditingContentKey(null);
    setSavingContent(false);
  };

  if (loading) return <section className="workspace-content"><div className="workspace-loading">Loading site management…</div></section>;

  return (
    <section className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="red-kicker">CONTENT MANAGEMENT</p>
          <h2>Manage website</h2>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="site-manager-tabs">
        <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
          <Newspaper size={15} /> News &amp; updates
        </button>
        <button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>
          <FileText size={15} /> Edit website text
        </button>
      </div>

      {tab === 'posts' && (
        <div className="site-manager-section">
          <div className="site-manager-toolbar">
            <p>Publish news and updates that appear automatically on your public website.</p>
            <button className="primary-button" onClick={() => setShowNewPost(true)}>
              <Plus size={15} /> New post
            </button>
          </div>

          {showNewPost && (
            <PostEditor
              onClose={() => setShowNewPost(false)}
              onSaved={(post) => { setPosts((current) => [post, ...current]); setShowNewPost(false); }}
            />
          )}

          {editingPost && (
            <PostEditor
              existing={editingPost}
              onClose={() => setEditingPost(null)}
              onSaved={(post) => {
                setPosts((current) => current.map((p) => p.id === post.id ? post : p));
                setEditingPost(null);
              }}
            />
          )}

          <div className="site-posts-list">
            {posts.length ? posts.map((post) => (
              <div key={post.id} className="site-post-card">
                <div className="site-post-info">
                  <div className="site-post-title-row">
                    <strong>{post.title}</strong>
                    <span className={`post-status ${post.status}`}>{post.status}</span>
                  </div>
                  <p className="site-post-excerpt">{post.excerpt || post.body.slice(0, 120)}</p>
                  <small>{post.category} · {new Date(post.published_at).toLocaleDateString()}</small>
                </div>
                <div className="site-post-actions">
                  <button onClick={() => togglePublish(post)}>
                    {post.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => setEditingPost(post)}><Edit3 size={13} /> Edit</button>
                  <button className="delete" onClick={() => deletePost(post.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )) : <div className="empty-workspace">No posts yet. Create your first news update.</div>}
          </div>
        </div>
      )}

      {tab === 'content' && (
        <div className="site-manager-section">
          <p className="site-manager-hint">Edit the text that appears on your public website. Changes go live immediately.</p>
          <div className="content-edit-list">
            {content.map((row) => (
              <div key={row.id} className="content-edit-row">
                <div className="content-edit-label">
                  <strong>{CONTENT_LABELS[row.section_key] || row.section_key}</strong>
                  <small>{row.section_key}</small>
                </div>
                {editingContentKey === row.section_key ? (
                  <div className="content-edit-form">
                    {row.content_value.length > 80 ? (
                      <textarea value={contentDraft} onChange={(e) => setContentDraft(e.target.value)} rows={4} />
                    ) : (
                      <input value={contentDraft} onChange={(e) => setContentDraft(e.target.value)} />
                    )}
                    <div className="content-edit-buttons">
                      <button className="primary-button" onClick={() => saveContent(row.section_key)} disabled={savingContent}>
                        <Save size={14} /> {savingContent ? 'Saving…' : 'Save'}
                      </button>
                      <button className="secondary-button" onClick={() => setEditingContentKey(null)}>
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="content-edit-display">
                    <p>{row.content_value}</p>
                    <button onClick={() => { setEditingContentKey(row.section_key); setContentDraft(row.content_value); }}>
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PostEditor({ existing, onClose, onSaved }: {
  existing?: SitePost;
  onClose: () => void;
  onSaved: (post: SitePost) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'News');
  const [status, setStatus] = useState(existing?.status ?? 'published');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      body: body.trim(),
      category: category.trim() || 'News',
      status,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { data, error: updateError } = await supabase
        .from('site_posts').update(payload).eq('id', existing.id).select('*').single();
      if (updateError) { setError(updateError.message); setSaving(false); return; }
      onSaved(data as SitePost);
    } else {
      const { data, error: insertError } = await supabase
        .from('site_posts').insert({ ...payload, published_at: new Date().toISOString() }).select('*').single();
      if (insertError) { setError(insertError.message); setSaving(false); return; }
      onSaved(data as SitePost);
    }
    setSaving(false);
  };

  return (
    <div className="post-editor-overlay">
      <form className="post-editor-card" onSubmit={submit}>
        <div className="post-editor-header">
          <h3>{existing ? 'Edit post' : 'Create a news post'}</h3>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Post title" /></label>
        <label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="News, Announcement, Update" /></label>
        <label>Short summary<input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="One-line summary shown in the news list" /></label>
        <label>Full content<textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={6} placeholder="Write the full post content here" /></label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="published">Published (visible on website)</option>
            <option value="draft">Draft (hidden from website)</option>
          </select>
        </label>
        {error && <p className="auth-error">{error}</p>}
        <div className="post-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save post'}</button>
        </div>
      </form>
    </div>
  );
}
