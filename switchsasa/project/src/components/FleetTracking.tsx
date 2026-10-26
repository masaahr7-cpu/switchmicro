import { useEffect, useState } from 'react';
import { MapPin, Navigation, AlertTriangle, Truck, Gauge, User, Loader2 } from 'lucide-react';

type Device = {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate?: string;
  category?: string;
};

type Position = {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  altitude: number;
  fixTime: string;
  attributes?: Record<string, unknown>;
};

const TRACCAR_API = 'https://eqjagobmirujkmlqopbm.supabase.co/functions/v1/traccar-proxy';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxamFnb2JtaXJ1amttbHFvcGJtIiwiaWF0IjoxNzkyOTQ5MzM2LCJleHAiOjIxMDg1MjUzMzN9.WP92WFtVJHis1EtsgfwG8STlAjD3NjwZ9igvdrf8VUE';

type TraccarCredentials = { email: string; password: string };

function traccarFetch(action: string, credentials: TraccarCredentials) {
  return fetch(TRACCAR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ action, email: credentials.email, password: credentials.password }),
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Traccar service unavailable.');
    return data;
  });
}

export default function FleetTracking() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<TraccarCredentials | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError('');
    try {
      const creds = { email: email.trim(), password };
      await traccarFetch('session', creds);
      setCredentials(creds);
      setConnected(true);
      await loadFleet(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to tracking server.');
    } finally {
      setConnecting(false);
    }
  };

  const loadFleet = async (creds: TraccarCredentials) => {
    setRefreshing(true);
    try {
      const [devs, pos] = await Promise.all([
        traccarFetch('devices', creds),
        traccarFetch('positions', creds),
      ]);
      setDevices(Array.isArray(devs) ? devs : []);
      setPositions(Array.isArray(pos) ? pos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fleet data.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!credentials) return;
    const interval = setInterval(() => loadFleet(credentials), 15000);
    return () => clearInterval(interval);
  }, [credentials]);

  const positionMap = new Map(positions.map((p) => [p.deviceId, p]));
  const moving = positions.filter((p) => p.speed > 1).length;
  const alerts = devices.filter((d) => d.status === 'offline').length;

  if (!connected) {
    return (
      <section className="workspace-content">
        <div className="workspace-heading">
          <div>
            <p className="red-kicker">FLEET MANAGEMENT</p>
            <h2>Live vehicle tracking</h2>
          </div>
        </div>
        <form className="traccar-login-card" onSubmit={handleConnect}>
          <div className="traccar-login-header">
            <Truck size={22} />
            <div>
              <strong>Connect to Traccar</strong>
              <p>Sign in with your Traccar GPS tracking account to view live fleet positions.</p>
            </div>
          </div>
          <label>Traccar email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="admin@switchmicrofinance.co.tz" /></label>
          <label>Traccar password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Your tracking password" /></label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button full-button" disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect to tracking server'}
          </button>
        </form>
      </section>
    );
  }

  const selectedPos = selectedDevice ? positionMap.get(selectedDevice) : null;
  const selectedDev = selectedDevice ? devices.find((d) => d.id === selectedDevice) : null;

  return (
    <section className="workspace-content">
      <div className="workspace-heading">
        <div>
          <p className="red-kicker">FLEET MANAGEMENT</p>
          <h2>Live vehicle tracking</h2>
        </div>
        <button className="secondary-button" onClick={() => credentials && loadFleet(credentials)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="fleet-stats">
        <div className="fleet-stat-card"><Truck size={18} /><strong>{devices.length}</strong><span>Devices</span></div>
        <div className="fleet-stat-card"><Navigation size={18} /><strong>{moving}</strong><span>Moving now</span></div>
        <div className="fleet-stat-card"><AlertTriangle size={18} /><strong>{alerts}</strong><span>Offline alerts</span></div>
        <div className="fleet-stat-card"><Gauge size={18} /><strong>{positions.length ? Math.round(positions.reduce((s, p) => s + p.speed, 0) / positions.length) : 0}</strong><span>Avg km/h</span></div>
      </div>

      <div className="fleet-map-wrap">
        <iframe
          src="http://84.247.172.135:8082/"
          className="fleet-map-iframe"
          title="Traccar Live Map"
        />
      </div>

      <div className="fleet-device-list">
        <div className="table-head">
          <span>Vehicle</span>
          <span>Status</span>
          <span>Speed</span>
          <span>Last update</span>
        </div>
        {devices.length ? devices.map((device) => {
          const pos = positionMap.get(device.id);
          return (
            <button
              key={device.id}
              className={`fleet-device-row ${selectedDevice === device.id ? 'active' : ''}`}
              onClick={() => setSelectedDevice(device.id)}
            >
              <div className="fleet-device-name">
                <Truck size={16} />
                <strong>{device.name}</strong>
                <small>{device.uniqueId}</small>
              </div>
              <span className={`fleet-status ${(pos?.speed ?? 0) > 1 ? 'moving' : device.status === 'online' ? 'idle' : 'offline'}`}>
                {(pos?.speed ?? 0) > 1 ? 'Moving' : device.status === 'online' ? 'Idle' : 'Offline'}
              </span>
              <span>{pos ? `${Math.round(pos.speed)} km/h` : '—'}</span>
              <span>{device.lastUpdate ? new Date(device.lastUpdate).toLocaleString() : '—'}</span>
            </button>
          );
        }) : <div className="empty-workspace">No devices registered in your Traccar account.</div>}
      </div>

      {selectedDev && selectedPos && (
        <div className="fleet-detail-panel">
          <div className="fleet-detail-header">
            <Truck size={20} />
            <strong>{selectedDev.name}</strong>
            <span>{selectedDev.uniqueId}</span>
          </div>
          <div className="fleet-detail-grid">
            <div><MapPin size={15} /><span>Coordinates</span><strong>{selectedPos.latitude.toFixed(5)}, {selectedPos.longitude.toFixed(5)}</strong></div>
            <div><Gauge size={15} /><span>Speed</span><strong>{Math.round(selectedPos.speed)} km/h</strong></div>
            <div><Navigation size={15} /><span>Heading</span><strong>{Math.round(selectedPos.course)}°</strong></div>
            <div><User size={15} /><span>Last seen</span><strong>{new Date(selectedPos.fixTime).toLocaleString()}</strong></div>
          </div>
          <a
            href={`https://www.google.com/maps?q=${selectedPos.latitude},${selectedPos.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="primary-button"
          >
            Open in Google Maps
          </a>
        </div>
      )}
    </section>
  );
}
