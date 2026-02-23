#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};
use types::{FollowUpAppointment, ReadinessScore};

fn create_test_hash(env: &Env, value: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = value;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_initiate_discharge_planning() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);
    let admission_date = 1000u64;
    let expected_discharge_date = 2000u64;
    let discharge_destination = 0u32; // Home

    let result = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &admission_date,
        &expected_discharge_date,
        &discharge_destination,
    );

    assert_eq!(result, 0);
}

#[test]
fn test_initiate_discharge_planning_invalid_date() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);
    let admission_date = 2000u64;
    let expected_discharge_date = 1000u64; // Invalid: before admission
    let discharge_destination = 0u32;

    let result = client.try_initiate_discharge_planning(
        &caller,
        &patient_id,
        &admission_date,
        &expected_discharge_date,
        &discharge_destination,
    );

    assert_eq!(result, Err(Ok(Error::InvalidDate)));
}

#[test]
fn test_assess_discharge_readiness() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    // First create a discharge plan
    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    // Assess readiness
    let readiness = client.assess_discharge_readiness(
        &caller,
        &discharge_plan_id,
        &80u32,
        &75u32,
        &85u32,
        &70u32,
    );

    assert_eq!(readiness.discharge_plan_id, discharge_plan_id);
    assert_eq!(readiness.total_score, 77);
    assert_eq!(readiness.is_ready, true);
}

#[test]
fn test_assess_discharge_readiness_not_ready() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let readiness = client.assess_discharge_readiness(
        &caller,
        &discharge_plan_id,
        &60u32,
        &50u32,
        &70u32,
        &65u32,
    );

    assert_eq!(readiness.total_score, 61);
    assert_eq!(readiness.is_ready, false);
}

#[test]
fn test_assess_discharge_readiness_invalid_score() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let result = client.try_assess_discharge_readiness(
        &caller,
        &discharge_plan_id,
        &101u32, // Invalid: > 100
        &75u32,
        &85u32,
        &70u32,
    );

    assert_eq!(result, Err(Ok(Error::InvalidScore)));
}

#[test]
fn test_assess_discharge_readiness_plan_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);

    let result = client.try_assess_discharge_readiness(
        &caller,
        &999u64, // Non-existent plan
        &80u32,
        &75u32,
        &85u32,
        &70u32,
    );

    assert_eq!(result, Err(Ok(Error::PlanNotFound)));
}

#[test]
fn test_create_discharge_orders() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let order_details_hash = create_test_hash(&env, 10);
    client.create_discharge_orders(&caller, &discharge_plan_id, &0u32, &order_details_hash);

    // Should succeed without error
}

#[test]
fn test_arrange_home_health() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let agency_id = create_test_hash(&env, 20);
    client.arrange_home_health(
        &caller,
        &discharge_plan_id,
        &agency_id,
        &0u32, // Nursing
        &3u32, // 3 times per week
        &4u32, // 4 weeks
    );

    // Should succeed without error
}

#[test]
fn test_arrange_home_health_invalid_input() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let agency_id = create_test_hash(&env, 20);
    let result = client.try_arrange_home_health(
        &caller,
        &discharge_plan_id,
        &agency_id,
        &0u32,
        &0u32, // Invalid: 0 frequency
        &4u32,
    );

    assert_eq!(result, Err(Ok(Error::InvalidInput)));
}

#[test]
fn test_order_dme_for_discharge() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let supplier_id = create_test_hash(&env, 30);
    env.ledger().with_mut(|li| li.timestamp = 1500);

    client.order_dme_for_discharge(
        &caller,
        &discharge_plan_id,
        &1u32, // Wheelchair
        &supplier_id,
        &3000u64, // Future delivery date
    );

    // Should succeed without error
}

#[test]
fn test_schedule_followup_appointments() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    env.ledger().with_mut(|li| li.timestamp = 1500);

    let mut appointments = Vec::new(&env);
    appointments.push_back(FollowUpAppointment {
        provider_id: create_test_hash(&env, 40),
        specialty: 0u32, // Primary Care
        scheduled_time: 3000u64,
        location_hash: create_test_hash(&env, 41),
    });
    appointments.push_back(FollowUpAppointment {
        provider_id: create_test_hash(&env, 42),
        specialty: 1u32, // Cardiology
        scheduled_time: 3500u64,
        location_hash: create_test_hash(&env, 43),
    });

    let appointment_ids = client.schedule_followup_appointments(
        &caller,
        &discharge_plan_id,
        &appointments,
    );

    assert_eq!(appointment_ids.len(), 2);
    assert_eq!(appointment_ids.get(0).unwrap(), 0);
    assert_eq!(appointment_ids.get(1).unwrap(), 1);
}

#[test]
fn test_schedule_followup_appointments_empty() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let appointments = Vec::new(&env);

    let result = client.try_schedule_followup_appointments(
        &caller,
        &discharge_plan_id,
        &appointments,
    );

    assert_eq!(result, Err(Ok(Error::InvalidInput)));
}

#[test]
fn test_provide_discharge_education() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let materials_hash = create_test_hash(&env, 50);
    client.provide_discharge_education(
        &caller,
        &discharge_plan_id,
        &0u32, // Medications
        &materials_hash,
        &true,
    );

    // Should succeed without error
}

#[test]
fn test_coordinate_with_snf() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &1u32, // SNF destination
    );

    env.ledger().with_mut(|li| li.timestamp = 1500);

    let snf_id = create_test_hash(&env, 60);
    let medical_summary_hash = create_test_hash(&env, 61);

    client.coordinate_with_snf(
        &caller,
        &discharge_plan_id,
        &snf_id,
        &true,
        &2500u64,
        &medical_summary_hash,
    );

    // Should succeed without error
}

#[test]
fn test_complete_discharge() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let discharge_summary_hash = create_test_hash(&env, 70);

    client.complete_discharge(
        &caller,
        &discharge_plan_id,
        &2000u64,
        &discharge_summary_hash,
    );

    // Should succeed without error
}

#[test]
fn test_complete_discharge_already_completed() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let discharge_summary_hash = create_test_hash(&env, 70);

    client.complete_discharge(
        &caller,
        &discharge_plan_id,
        &2000u64,
        &discharge_summary_hash,
    );

    // Try to complete again
    let result = client.try_complete_discharge(
        &caller,
        &discharge_plan_id,
        &2000u64,
        &discharge_summary_hash,
    );

    assert_eq!(result, Err(Ok(Error::AlreadyCompleted)));
}

#[test]
fn test_track_readmission_risk() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    // Risk factors bitmap: 1=MultipleComorbidities, 2=PoorSocialSupport
    let risk_factors = 3u32; // Both factors present
    let risk_score = 75u32;

    client.track_readmission_risk(&caller, &discharge_plan_id, &risk_factors, &risk_score);

    // Should succeed without error
}

#[test]
fn test_track_readmission_risk_invalid_score() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &2000u64,
        &0u32,
    );

    let result = client.try_track_readmission_risk(
        &caller,
        &discharge_plan_id,
        &3u32,
        &101u32, // Invalid: > 100
    );

    assert_eq!(result, Err(Ok(Error::InvalidScore)));
}

#[test]
fn test_full_discharge_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, HospitalDischargeContract);
    let client = HospitalDischargeContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let patient_id = create_test_hash(&env, 1);

    env.ledger().with_mut(|li| li.timestamp = 1000);

    // 1. Initiate discharge planning
    let discharge_plan_id = client.initiate_discharge_planning(
        &caller,
        &patient_id,
        &1000u64,
        &5000u64,
        &0u32,
    );

    // 2. Assess readiness
    let readiness = client.assess_discharge_readiness(
        &caller,
        &discharge_plan_id,
        &85u32,
        &80u32,
        &90u32,
        &75u32,
    );
    assert!(readiness.is_ready);

    // 3. Create discharge orders
    client.create_discharge_orders(
        &caller,
        &discharge_plan_id,
        &0u32,
        &create_test_hash(&env, 10),
    );

    // 4. Arrange home health
    client.arrange_home_health(
        &caller,
        &discharge_plan_id,
        &create_test_hash(&env, 20),
        &0u32,
        &3u32,
        &4u32,
    );

    // 5. Order DME
    client.order_dme_for_discharge(
        &caller,
        &discharge_plan_id,
        &0u32,
        &create_test_hash(&env, 30),
        &6000u64,
    );

    // 6. Schedule follow-up appointments
    let mut appointments = Vec::new(&env);
    appointments.push_back(FollowUpAppointment {
        provider_id: create_test_hash(&env, 40),
        specialty: 0u32,
        scheduled_time: 7000u64,
        location_hash: create_test_hash(&env, 41),
    });
    let appointment_ids = client.schedule_followup_appointments(
        &caller,
        &discharge_plan_id,
        &appointments,
    );
    assert_eq!(appointment_ids.len(), 1);

    // 7. Provide education
    client.provide_discharge_education(
        &caller,
        &discharge_plan_id,
        &0u32,
        &create_test_hash(&env, 50),
        &true,
    );

    // 8. Track readmission risk
    client.track_readmission_risk(&caller, &discharge_plan_id, &1u32, &30u32);

    // 9. Complete discharge
    client.complete_discharge(
        &caller,
        &discharge_plan_id,
        &5000u64,
        &create_test_hash(&env, 70),
    );

    // Verify cannot complete again
    let result = client.try_complete_discharge(
        &caller,
        &discharge_plan_id,
        &5000u64,
        &create_test_hash(&env, 70),
    );
    assert_eq!(result, Err(Ok(Error::AlreadyCompleted)));
}
