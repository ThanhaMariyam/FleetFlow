export interface Driver {
  id: string;
  name: string;
  phoneNumber?: string;
}

export interface Vehicle {
  id: string;
  name: string;
}

export interface Trip {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleName: string;
  status: 'waiting_service' | 'service_completed' | 'active' | 'completed';
  condition: 'ok' | 'not_ok';
  serviceNeeded: boolean;
  checklist?: Record<string, boolean>;
  remarks?: string;
  startTime?: number;
  endTime?: number;
  duration?: number; // in milliseconds
  endCondition?: 'ok' | 'not_ok';
  endChecklist?: Record<string, boolean>;
  endRemarks?: string;
  endServiceNeeded?: boolean;
  serviceCost?: number;
  serviceLocation?: string;
  serviceType?: 'performed' | 'no_service';
  billImage?: string; // Base64 Receipt URI
  resolvedAt?: number;
}
