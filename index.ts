export type AddressType = "HOME" | "OFFICE" | "OTHER";

export type OrderStatus =
  | "PENDING"
  | "PRESCRIPTION_VERIFIED"
  | "PROCESSING"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  landmark?: string;
  addressType: AddressType;
  isDefault: boolean;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressInput {
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  landmark?: string;
  addressType?: AddressType;
  isDefault?: boolean;
}

export interface UpdateAddressInput extends Partial<CreateAddressInput> {
  isActive?: boolean;
}

export interface PrescribedMedicine {
  id: string;
  prescriptionId: string;
  name: string;
  dosage: string;
  form?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  instructions?: string;
}

export interface Prescription {
  id: string;
  userId: string;
  doctorName: string;
  hospitalName?: string;
  issuedAt: string;
  expiresAt?: string;
  imageUrl?: string;
  isVerified: boolean;
  medicines: PrescribedMedicine[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  prescribedMedicineId: string;
  medicine: PrescribedMedicine;
  quantityOrdered: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderStatusLog {
  id: string;
  orderId: string;
  status: OrderStatus;
  message?: string;
  timestamp: string;
  updatedBy?: string;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  userId: string;
  prescriptionId: string;
  prescription: Prescription;
  addressId: string;
  address: Address;
  status: OrderStatus;
  deliverySlot: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  agentName?: string;
  agentPhone?: string;
  totalAmount: number;
  deliveryFee: number;
  isPaid: boolean;
  estimatedETA?: string;
  deliveredAt?: string;
  notes?: string;
  items: OrderItem[];
  statusHistory: OrderStatusLog[];
  createdAt: string;
}

export interface CreateOrderInput {
  prescriptionId: string;
  addressId: string;
  deliverySlot: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  items: {
    prescribedMedicineId: string;
    quantityOrdered: number;
  }[];
  notes?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DeliverySlot {
  id: string;
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}
