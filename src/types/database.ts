// Database types for Pilnak

export type AppRole = 'admin' | 'customer' | 'driver';
export type DriverType = 'cargo_van' | 'box_truck' | 'dry_van' | 'flatbed' | 'reefer' | 'power_only' | 'auto_transport';
export type DriverStatus = 'pending_verification' | 'approved' | 'suspended' | 'rejected';
export type DeliveryStatus = 'pending' | 'admin_review' | 'negotiating_price' | 'price_set' | 'payment_pending' | 'customer_confirmed' | 'driver_assigned' | 'driver_accepted' | 'in_progress' | 'arrived' | 'awaiting_signature' | 'completed' | 'cancelled';
export type GenderType = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type GovernmentIdType = 'drivers_license' | 'national_id' | 'passport' | 'voters_card';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  date_of_birth?: string;
  age?: number;
  gender?: GenderType;
  home_address?: string;
  city?: string;
  state?: string;
  country?: string;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  driver_type: DriverType;
  years_of_experience?: number;
  government_id_type?: GovernmentIdType;
  government_id_number?: string;
  government_id_expiry?: string;
  selfie_url?: string;
  status: DriverStatus;
  is_online: boolean;
  current_latitude?: number;
  current_longitude?: number;
  last_location_update?: string;
  average_rating?: number;
  total_deliveries?: number;
  total_earnings?: number;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  vehicle_type: string;
  brand?: string;
  model?: string;
  plate_number: string;
  color?: string;
  year?: number;
  insurance_document_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverImage {
  id: string;
  driver_id: string;
  vehicle_id?: string;
  image_type: string;
  image_url: string;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  saved_addresses?: unknown[];
  favorite_drivers?: string[];
  wallet_balance?: number;
  total_deliveries?: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRequest {
  id: string;
  customer_id: string;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  dropoff_address: string;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  item_description?: string;
  item_weight?: string;
  item_size?: string;
  item_photos?: string[];
  preferred_vehicle_type?: DriverType;
  is_scheduled: boolean;
  scheduled_time?: string;
  status: DeliveryStatus;
  estimated_price?: number;
  final_price?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  request_id: string;
  driver_id: string;
  assigned_by?: string;
  assigned_at: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  driver_accepted?: boolean;
  customer_confirmed: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  data?: Record<string, unknown> | null;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  read_by?: string[];
  created_at: string;
}

export interface Review {
  id: string;
  request_id?: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export type BroadcastStatus = 'active' | 'fulfilled' | 'expired' | 'cancelled';
export type BroadcastResponseType = 'interested' | 'counter_offer';

export interface DeliveryBroadcastDoc {
  customerId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  transportType: string;
  estimatedPrice: number;
  distanceKm: number;
  allowNegotiation: boolean;
  itemDescription?: string | null;
  itemSize?: string | null;
  packagePhotoUrl?: string | null;
  status: BroadcastStatus;
  expiresAt: unknown;
  createdAt: unknown;
  selectedDriverId?: string | null;
  deliveryRequestId?: string | null;
}

export interface BroadcastResponseDoc {
  broadcastId: string;
  driverId: string;
  responseType: BroadcastResponseType;
  counterOfferPrice?: number | null;
  status: 'pending' | 'selected' | 'dismissed';
  assignmentId?: string | null;
  requestId?: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}
