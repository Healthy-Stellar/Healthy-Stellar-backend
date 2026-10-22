export class DepartmentDto {
  id: string;
  name: string;
  code: string;
  description: string;
  headOfDepartment: string;
  contactNumber: string;
  location: LocationDto;
  operatingHours: OperatingHoursDto;
  capacity: number;
  specializations: string[];
}

export class LocationDto {
  building: string;
  floor: number;
  wing: string;
  roomNumbers: string[];
}

export class OperatingHoursDto {
  monday: TimeSlotDto;
  tuesday: TimeSlotDto;
  wednesday: TimeSlotDto;
  thursday: TimeSlotDto;
  friday: TimeSlotDto;
  saturday: TimeSlotDto;
  sunday: TimeSlotDto;
  is24x7: boolean;
}

export class TimeSlotDto {
  open: string;
  close: string;
  isOpen: boolean;
}
