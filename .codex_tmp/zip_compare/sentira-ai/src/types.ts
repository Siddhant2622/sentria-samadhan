export type Role = 'citizen' | 'admin' | 'officer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: Role;
  createdAt: string;
}

export type Urgency = 'low' | 'medium' | 'high' | 'emergency';
export type ComplaintStatus = 'submitted' | 'assigned' | 'in_progress' | 'completed' | 'delayed' | 'escalated';

export interface Complaint {
  id?: string;
  citizenId: string;
  title: string;
  description: string;
  category: string;
  urgency: Urgency;
  severity: number;
  location: {
    lat: number;
    lng: number;
    address: string;
    landmarks?: string[];
    ward?: string;
    zone?: string;
  };
  media: {
    type: 'image' | 'video';
    url: string;
  };
  status: ComplaintStatus;
  officerId?: string;
  departmentId?: string;
  createdAt: string;
  updatedAt: string;
  expectedCompletionDate?: string;
}

export interface Department {
  id: string;
  name: string;
  responsibleFor: string[];
}
