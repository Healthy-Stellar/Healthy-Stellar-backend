export class MedicalEquipmentDto {
  id: string;
  name: string;
  equipmentType: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  departmentId: string;
  location: LocationDto;
  status: "available" | "in-use" | "maintenance" | "out-of-service";
  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;
  calibrationDate: Date;
  quantity: number;
  assignedTo?: string;
}

export class ResourceDto {
  id: string;
  resourceType: "bed" | "ventilator" | "monitor" | "wheelchair" | "other";
  totalCount: number;
  availableCount: number;
  departmentId: string;
  location: LocationDto;
  lastUpdated: Date;
}
