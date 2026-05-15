const fallbackComplaints = [
  {
    id: 'demo-8924',
    title: 'Deep Pothole on Main Road',
    description: 'A large pothole is slowing traffic near the market signal.',
    category: 'Roads',
    status: 'In Progress',
    urgency_level: 'High',
    priority_score: 8,
    progress_percentage: 45,
    address: 'MP Nagar Zone 2',
    department_id: 'PWD',
    assigned_officer_name: 'Rajesh Kumar',
    is_fake: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    expected_completion_date: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    media_urls: [],
    work_updates: JSON.stringify([
      { timestamp: new Date(Date.now() - 3600000).toISOString(), progress: 25, text: 'Field team arrived and surveyed the pothole.', media: null },
      { timestamp: new Date(Date.now() - 1800000).toISOString(), progress: 45, text: 'Filling compound applied. Compaction in progress.', media: null },
    ])
  },
  {
    id: 'demo-8923',
    title: 'Streetlight Not Working',
    description: 'The streetlight near the school lane has been off since yesterday.',
    category: 'Electricity',
    status: 'Resolved',
    urgency_level: 'Low',
    priority_score: 3,
    progress_percentage: 100,
    address: 'Habibganj Main Road',
    department_id: 'Electricity Board',
    assigned_officer_name: 'Suresh Yadav',
    is_fake: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    expected_completion_date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    media_urls: [],
    work_updates: JSON.stringify([])
  }
];
import { API_BASE } from './config';

export async function fetchComplaints(query = '') {
  try {
    const response = await fetch(`${API_BASE}/api/complaints${query}`);
    if (!response.ok) throw new Error('Unable to load complaints');
    const data = await response.json();
    return data.length ? data : fallbackComplaints;
  } catch (error) {
    console.warn(error);
    return fallbackComplaints;
  }
}

export async function fetchComplaint(id) {
  if (id?.startsWith('demo-')) {
    return fallbackComplaints.find((item) => item.id === id) || fallbackComplaints[0];
  }
  try {
    const response = await fetch(`${API_BASE}/api/complaints/${id}`);
    if (!response.ok) throw new Error('Complaint not found');
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallbackComplaints[0];
  }
}

export async function updateProgress(id, progress_percentage, status, work_update_text) {
  const response = await fetch(`${API_BASE}/api/complaints/${id}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress_percentage, status, work_update_text }),
  });
  return response.json();
}

export async function escalateComplaint(id, reason, target_level) {
  const response = await fetch(`${API_BASE}/api/complaints/${id}/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, target_level }),
  });
  return response.json();
}

export function formatRelativeTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function statusColor(status = '') {
  const normalized = status.toLowerCase();
  if (normalized.includes('resolve') || normalized.includes('complete')) return 'bg-accent/20 text-accent';
  if (normalized.includes('progress') || normalized.includes('assign')) return 'bg-primary/20 text-primary';
  if (normalized.includes('escalat')) return 'bg-danger/20 text-danger';
  return 'bg-warning/20 text-warning';
}

export function urgencyColor(urgency = '') {
  if (urgency === 'Emergency') return 'bg-danger/20 text-danger';
  if (urgency === 'High') return 'bg-warning/20 text-warning';
  if (urgency === 'Medium') return 'bg-primary/20 text-primary';
  return 'bg-accent/20 text-accent';
}

export function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // Ensure no double slashes between API_BASE and the url
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE}${cleanUrl}`;
}

/** Open an address or lat/lng in Google Maps in a new tab */
export function openInGoogleMaps(address, lat, lng) {
  if (lat && lng) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  } else if (address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }
}
