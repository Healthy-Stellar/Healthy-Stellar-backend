use soroban_sdk::{contracttype, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DischargeMedication {
    pub medication_name_hash: BytesN<32>,
    pub dosage: u32,
    pub frequency_per_day: u32,
    pub duration_days: u32,
    pub prescriber_id: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FollowUpAppointment {
    pub provider_id: BytesN<32>,
    pub specialty: u32, // 0=PrimaryCare, 1=Cardiology, 2=Surgery, 3=Other
    pub scheduled_time: u64,
    pub location_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReadinessScore {
    pub discharge_plan_id: u64,
    pub medical_stability_score: u32,
    pub functional_status_score: u32,
    pub support_system_score: u32,
    pub education_completion_score: u32,
    pub total_score: u32,
    pub is_ready: bool,
    pub assessed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DischargePlan {
    pub patient_id: BytesN<32>,
    pub admission_date: u64,
    pub expected_discharge_date: u64,
    pub discharge_destination: u32,
    pub created_at: u64,
    pub is_completed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DischargeOrder {
    pub order_type: u32,
    pub order_details_hash: BytesN<32>,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HomeHealthArrangement {
    pub agency_id: BytesN<32>,
    pub service_type: u32,
    pub frequency_per_week: u32,
    pub duration_weeks: u32,
    pub arranged_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DmeOrder {
    pub equipment_type: u32,
    pub supplier_id: BytesN<32>,
    pub delivery_date: u64,
    pub ordered_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EducationRecord {
    pub education_topic: u32,
    pub materials_hash: BytesN<32>,
    pub completed: bool,
    pub provided_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SnfCoordination {
    pub snf_id: BytesN<32>,
    pub bed_reserved: bool,
    pub transfer_date: u64,
    pub medical_summary_hash: BytesN<32>,
    pub coordinated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReadmissionRisk {
    pub risk_factors: u32,
    pub risk_score: u32,
    pub tracked_at: u64,
}
