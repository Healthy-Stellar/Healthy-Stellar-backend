export type UserRole = 'PATIENT' | 'DOCTOR' | 'HOSPITAL' | 'ADMIN';

export interface User {
  id: string;
  address: string; // Stellar public key
  role: UserRole;
  name: string;
}