#![no_std]

mod storage;
mod types;
mod errors;
mod events;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec, BytesN};
use types::{FollowUpAppointment, ReadinessScore};
use errors::Error;
use storage::Storage;
use events::Events;

#[contract]
pub struct HospitalDischargeContract;

#[contractimpl]
impl HospitalDischargeContract {
    /// Initialize a new discharge planning process
    pub fn initiate_discharge_planning(
        env: Env,
        caller: Address,
        patient_id: BytesN<32>,
        admission_date: u64,
        expected_discharge_date: u64,
        discharge_destination: u32, // 0=Home, 1=SNF, 2=Rehab, 3=Other
    ) -> Result<u64, Error> {
        caller.require_auth();

        if expected_discharge_date <= admission_date {
            return Err(Error::InvalidDate);
        }

        let discharge_plan_id = Storage::get_and_increment_counter(&env);
        
        Storage::save_discharge_plan(
            &env,
            discharge_plan_id,
            &patient_id,
            admission_date,
            expected_discharge_date,
            discharge_destination,
        );

        Events::emit_discharge_initiated(&env, discharge_plan_id, &patient_id, &caller);

        Ok(discharge_plan_id)
    }

    /// Assess patient's readiness for discharge
    pub fn assess_discharge_readiness(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        medical_stability_score: u32,
        functional_status_score: u32,
        support_system_score: u32,
        education_completion_score: u32,
    ) -> Result<ReadinessScore, Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        // Validate scores (0-100)
        if medical_stability_score > 100
            || functional_status_score > 100
            || support_system_score > 100
            || education_completion_score > 100
        {
            return Err(Error::InvalidScore);
        }

        let total_score = (medical_stability_score
            + functional_status_score
            + support_system_score
            + education_completion_score)
            / 4;

        let is_ready = total_score >= 75;

        let readiness = ReadinessScore {
            discharge_plan_id,
            medical_stability_score,
            functional_status_score,
            support_system_score,
            education_completion_score,
            total_score,
            is_ready,
            assessed_at: env.ledger().timestamp(),
        };

        Storage::save_readiness_assessment(&env, discharge_plan_id, &readiness);
        Events::emit_readiness_assessed(&env, discharge_plan_id, total_score, is_ready);

        Ok(readiness)
    }

    /// Create discharge orders (medications, equipment, etc.)
    pub fn create_discharge_orders(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        order_type: u32, // 0=Medication, 1=DME, 2=HomeHealth, 3=Lab
        order_details_hash: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        Storage::add_discharge_order(&env, discharge_plan_id, order_type, &order_details_hash);
        Events::emit_order_created(&env, discharge_plan_id, order_type, &order_details_hash);

        Ok(())
    }

    /// Arrange home health services
    pub fn arrange_home_health(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        agency_id: BytesN<32>,
        service_type: u32, // 0=Nursing, 1=PT, 2=OT, 3=SpeechTherapy
        frequency_per_week: u32,
        duration_weeks: u32,
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        if frequency_per_week == 0 || duration_weeks == 0 {
            return Err(Error::InvalidInput);
        }

        Storage::save_home_health_arrangement(
            &env,
            discharge_plan_id,
            &agency_id,
            service_type,
            frequency_per_week,
            duration_weeks,
        );

        Events::emit_home_health_arranged(&env, discharge_plan_id, &agency_id, service_type);

        Ok(())
    }

    /// Order durable medical equipment for discharge
    pub fn order_dme_for_discharge(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        equipment_type: u32, // 0=Walker, 1=Wheelchair, 2=OxygenConcentrator, 3=HospitalBed
        supplier_id: BytesN<32>,
        delivery_date: u64,
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        if delivery_date <= env.ledger().timestamp() {
            return Err(Error::InvalidDate);
        }

        Storage::save_dme_order(
            &env,
            discharge_plan_id,
            equipment_type,
            &supplier_id,
            delivery_date,
        );

        Events::emit_dme_ordered(&env, discharge_plan_id, equipment_type, &supplier_id);

        Ok(())
    }

    /// Schedule follow-up appointments
    pub fn schedule_followup_appointments(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        appointments: Vec<FollowUpAppointment>,
    ) -> Result<Vec<u64>, Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        if appointments.is_empty() {
            return Err(Error::InvalidInput);
        }

        let mut appointment_ids = Vec::new(&env);
        let current_time = env.ledger().timestamp();

        for appointment in appointments.iter() {
            if appointment.scheduled_time <= current_time {
                return Err(Error::InvalidDate);
            }

            let appointment_id = Storage::get_and_increment_appointment_counter(&env);
            Storage::save_followup_appointment(&env, discharge_plan_id, appointment_id, &appointment);
            appointment_ids.push_back(appointment_id);

            Events::emit_appointment_scheduled(
                &env,
                discharge_plan_id,
                appointment_id,
                &appointment.provider_id,
            );
        }

        Ok(appointment_ids)
    }

    /// Provide discharge education to patient/family
    pub fn provide_discharge_education(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        education_topic: u32, // 0=Medications, 1=WoundCare, 2=DietNutrition, 3=ActivityRestrictions
        materials_hash: BytesN<32>,
        completed: bool,
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        Storage::save_education_record(
            &env,
            discharge_plan_id,
            education_topic,
            &materials_hash,
            completed,
        );

        Events::emit_education_provided(&env, discharge_plan_id, education_topic, completed);

        Ok(())
    }

    /// Coordinate with skilled nursing facility
    pub fn coordinate_with_snf(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        snf_id: BytesN<32>,
        bed_reserved: bool,
        transfer_date: u64,
        medical_summary_hash: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        if transfer_date <= env.ledger().timestamp() {
            return Err(Error::InvalidDate);
        }

        Storage::save_snf_coordination(
            &env,
            discharge_plan_id,
            &snf_id,
            bed_reserved,
            transfer_date,
            &medical_summary_hash,
        );

        Events::emit_snf_coordinated(&env, discharge_plan_id, &snf_id, bed_reserved);

        Ok(())
    }

    /// Complete the discharge process
    pub fn complete_discharge(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        actual_discharge_date: u64,
        discharge_summary_hash: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        if Storage::is_discharge_completed(&env, discharge_plan_id) {
            return Err(Error::AlreadyCompleted);
        }

        Storage::mark_discharge_completed(
            &env,
            discharge_plan_id,
            actual_discharge_date,
            &discharge_summary_hash,
        );

        Events::emit_discharge_completed(&env, discharge_plan_id, actual_discharge_date);

        Ok(())
    }

    /// Track readmission risk factors
    pub fn track_readmission_risk(
        env: Env,
        caller: Address,
        discharge_plan_id: u64,
        risk_factors: u32, // Bitmap: 1=MultipleComorbidities, 2=PoorSocialSupport, 4=MedicationNonCompliance, 8=RecentReadmission
        risk_score: u32,   // 0-100
    ) -> Result<(), Error> {
        caller.require_auth();

        if !Storage::discharge_plan_exists(&env, discharge_plan_id) {
            return Err(Error::PlanNotFound);
        }

        if risk_score > 100 {
            return Err(Error::InvalidScore);
        }

        Storage::save_readmission_risk(&env, discharge_plan_id, risk_factors, risk_score);
        Events::emit_risk_tracked(&env, discharge_plan_id, risk_score);

        Ok(())
    }
}

#[cfg(test)]
mod test;
