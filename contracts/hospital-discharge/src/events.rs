use soroban_sdk::{Env, Address, BytesN, symbol_short};

pub struct Events;

impl Events {
    pub fn emit_discharge_initiated(
        env: &Env,
        discharge_plan_id: u64,
        patient_id: &BytesN<32>,
        caller: &Address,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("init")),
            (discharge_plan_id, patient_id.clone(), caller.clone()),
        );
    }

    pub fn emit_readiness_assessed(
        env: &Env,
        discharge_plan_id: u64,
        total_score: u32,
        is_ready: bool,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("ready")),
            (discharge_plan_id, total_score, is_ready),
        );
    }

    pub fn emit_order_created(
        env: &Env,
        discharge_plan_id: u64,
        order_type: u32,
        order_details_hash: &BytesN<32>,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("order")),
            (discharge_plan_id, order_type, order_details_hash.clone()),
        );
    }

    pub fn emit_home_health_arranged(
        env: &Env,
        discharge_plan_id: u64,
        agency_id: &BytesN<32>,
        service_type: u32,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("homeheal")),
            (discharge_plan_id, agency_id.clone(), service_type),
        );
    }

    pub fn emit_dme_ordered(
        env: &Env,
        discharge_plan_id: u64,
        equipment_type: u32,
        supplier_id: &BytesN<32>,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("dme")),
            (discharge_plan_id, equipment_type, supplier_id.clone()),
        );
    }

    pub fn emit_appointment_scheduled(
        env: &Env,
        discharge_plan_id: u64,
        appointment_id: u64,
        provider_id: &BytesN<32>,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("appt")),
            (discharge_plan_id, appointment_id, provider_id.clone()),
        );
    }

    pub fn emit_education_provided(
        env: &Env,
        discharge_plan_id: u64,
        education_topic: u32,
        completed: bool,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("edu")),
            (discharge_plan_id, education_topic, completed),
        );
    }

    pub fn emit_snf_coordinated(
        env: &Env,
        discharge_plan_id: u64,
        snf_id: &BytesN<32>,
        bed_reserved: bool,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("snf")),
            (discharge_plan_id, snf_id.clone(), bed_reserved),
        );
    }

    pub fn emit_discharge_completed(
        env: &Env,
        discharge_plan_id: u64,
        actual_discharge_date: u64,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("complete")),
            (discharge_plan_id, actual_discharge_date),
        );
    }

    pub fn emit_risk_tracked(
        env: &Env,
        discharge_plan_id: u64,
        risk_score: u32,
    ) {
        env.events().publish(
            (symbol_short!("discharge"), symbol_short!("risk")),
            (discharge_plan_id, risk_score),
        );
    }
}
