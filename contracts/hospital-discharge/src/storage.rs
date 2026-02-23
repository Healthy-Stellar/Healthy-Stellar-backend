use soroban_sdk::{contracttype, Env, BytesN, Vec};
use crate::types::*;

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Counter,
    AppointmentCounter,
    Plan(u64),
    Readiness(u64),
    Orders(u64),
    HomeHealth(u64),
    Dme(u64),
    Appointments(u64),
    Education(u64),
    SnfCoord(u64),
    Completed(u64),
    Risk(u64),
}

pub struct Storage;

impl Storage {
    const DAY_IN_LEDGERS: u32 = 17280; // ~1 day
    const YEAR_IN_LEDGERS: u32 = 6_307_200; // ~365 days

    pub fn get_and_increment_counter(env: &Env) -> u64 {
        let key = StorageKey::Counter;
        let counter: u64 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(counter + 1));
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
        counter
    }

    pub fn get_and_increment_appointment_counter(env: &Env) -> u64 {
        let key = StorageKey::AppointmentCounter;
        let counter: u64 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(counter + 1));
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
        counter
    }

    pub fn save_discharge_plan(
        env: &Env,
        discharge_plan_id: u64,
        patient_id: &BytesN<32>,
        admission_date: u64,
        expected_discharge_date: u64,
        discharge_destination: u32,
    ) {
        let plan = DischargePlan {
            patient_id: patient_id.clone(),
            admission_date,
            expected_discharge_date,
            discharge_destination,
            created_at: env.ledger().timestamp(),
            is_completed: false,
        };
        let key = StorageKey::Plan(discharge_plan_id);
        env.storage().persistent().set(&key, &plan);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn discharge_plan_exists(env: &Env, discharge_plan_id: u64) -> bool {
        let key = StorageKey::Plan(discharge_plan_id);
        env.storage().persistent().has(&key)
    }

    pub fn save_readiness_assessment(
        env: &Env,
        discharge_plan_id: u64,
        readiness: &ReadinessScore,
    ) {
        let key = StorageKey::Readiness(discharge_plan_id);
        env.storage().persistent().set(&key, readiness);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn add_discharge_order(
        env: &Env,
        discharge_plan_id: u64,
        order_type: u32,
        order_details_hash: &BytesN<32>,
    ) {
        let order = DischargeOrder {
            order_type,
            order_details_hash: order_details_hash.clone(),
            created_at: env.ledger().timestamp(),
        };

        let key = StorageKey::Orders(discharge_plan_id);
        let mut orders: Vec<DischargeOrder> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        orders.push_back(order);
        env.storage().persistent().set(&key, &orders);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn save_home_health_arrangement(
        env: &Env,
        discharge_plan_id: u64,
        agency_id: &BytesN<32>,
        service_type: u32,
        frequency_per_week: u32,
        duration_weeks: u32,
    ) {
        let arrangement = HomeHealthArrangement {
            agency_id: agency_id.clone(),
            service_type,
            frequency_per_week,
            duration_weeks,
            arranged_at: env.ledger().timestamp(),
        };
        let key = StorageKey::HomeHealth(discharge_plan_id);
        env.storage().persistent().set(&key, &arrangement);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn save_dme_order(
        env: &Env,
        discharge_plan_id: u64,
        equipment_type: u32,
        supplier_id: &BytesN<32>,
        delivery_date: u64,
    ) {
        let dme = DmeOrder {
            equipment_type,
            supplier_id: supplier_id.clone(),
            delivery_date,
            ordered_at: env.ledger().timestamp(),
        };
        let key = StorageKey::Dme(discharge_plan_id);
        let mut dme_orders: Vec<DmeOrder> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        dme_orders.push_back(dme);
        env.storage().persistent().set(&key, &dme_orders);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn save_followup_appointment(
        env: &Env,
        discharge_plan_id: u64,
        _appointment_id: u64,
        appointment: &FollowUpAppointment,
    ) {
        let key = StorageKey::Appointments(discharge_plan_id);
        let mut appointments: Vec<FollowUpAppointment> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        appointments.push_back(appointment.clone());
        env.storage().persistent().set(&key, &appointments);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn save_education_record(
        env: &Env,
        discharge_plan_id: u64,
        education_topic: u32,
        materials_hash: &BytesN<32>,
        completed: bool,
    ) {
        let record = EducationRecord {
            education_topic,
            materials_hash: materials_hash.clone(),
            completed,
            provided_at: env.ledger().timestamp(),
        };
        let key = StorageKey::Education(discharge_plan_id);
        let mut records: Vec<EducationRecord> = env.storage().persistent().get(&key).unwrap_or(Vec::new(env));
        records.push_back(record);
        env.storage().persistent().set(&key, &records);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn save_snf_coordination(
        env: &Env,
        discharge_plan_id: u64,
        snf_id: &BytesN<32>,
        bed_reserved: bool,
        transfer_date: u64,
        medical_summary_hash: &BytesN<32>,
    ) {
        let coordination = SnfCoordination {
            snf_id: snf_id.clone(),
            bed_reserved,
            transfer_date,
            medical_summary_hash: medical_summary_hash.clone(),
            coordinated_at: env.ledger().timestamp(),
        };
        let key = StorageKey::SnfCoord(discharge_plan_id);
        env.storage().persistent().set(&key, &coordination);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn mark_discharge_completed(
        env: &Env,
        discharge_plan_id: u64,
        actual_discharge_date: u64,
        discharge_summary_hash: &BytesN<32>,
    ) {
        // Update the plan to mark as completed
        let plan_key = StorageKey::Plan(discharge_plan_id);
        if let Some(mut plan) = env.storage().persistent().get::<StorageKey, DischargePlan>(&plan_key) {
            plan.is_completed = true;
            env.storage().persistent().set(&plan_key, &plan);
        }

        // Store completion details
        let key = StorageKey::Completed(discharge_plan_id);
        let completion_data = (actual_discharge_date, discharge_summary_hash.clone());
        env.storage().persistent().set(&key, &completion_data);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }

    pub fn is_discharge_completed(env: &Env, discharge_plan_id: u64) -> bool {
        let key = StorageKey::Plan(discharge_plan_id);
        if let Some(plan) = env.storage().persistent().get::<StorageKey, DischargePlan>(&key) {
            plan.is_completed
        } else {
            false
        }
    }

    pub fn save_readmission_risk(
        env: &Env,
        discharge_plan_id: u64,
        risk_factors: u32,
        risk_score: u32,
    ) {
        let risk = ReadmissionRisk {
            risk_factors,
            risk_score,
            tracked_at: env.ledger().timestamp(),
        };
        let key = StorageKey::Risk(discharge_plan_id);
        env.storage().persistent().set(&key, &risk);
        env.storage().persistent().extend_ttl(&key, Self::YEAR_IN_LEDGERS, Self::YEAR_IN_LEDGERS);
    }
}
