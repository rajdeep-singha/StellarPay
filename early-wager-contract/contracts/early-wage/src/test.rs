#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env,
};

// Helper: deploy the token contract from the companion crate and mint
// initial supply to a given address.
// Helper: deploy the built-in Stellar asset contract and return the admin client
// (StellarAssetClient) which has the `.mint()` capability. 
// The standard token::Client does NOT have this method.
fn create_token<'a>(e: &Env, admin: &Address) -> token::StellarAssetClient<'a> {
    let token_address = e.register_stellar_asset_contract_v2(admin.clone()).address();
    token::StellarAssetClient::new(e, &token_address)
}

/// Setup helper — returns (env, contract_address, admin, token_client).
fn setup() -> (Env, Address, Address, token::StellarAssetClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarlyWageContract, ());
    let admin = Address::generate(&env);
    
    // Generates the token using the admin interface to allow minting in tests
    let token_client = create_token(&env, &admin);

    // Initialize
    let client = EarlyWageContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, contract_id, admin, token_client)
}
/// Helper to DRY up employee registration and salary assignment in tests
fn setup_employee(
    client: &EarlyWageContractClient,
    wallet: &Address,
    salary: u128,
    token: &Address,
) -> u128 {
    // Phase 1 Workflow: 1. Self-register
    let emp_id = client.register_employee(wallet);
    // Phase 1 Workflow: 2. Admin sets salary and token
    client.set_employee_salary(&emp_id, &salary, token);
    emp_id
}

// ============================================================
// Initialization Tests
// ============================================================

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarlyWageContract, ());
    let admin = Address::generate(&env);

    let client = EarlyWageContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    // Verify admin is set
    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);

    // Verify employee count starts at 0
    let count = client.get_employee_count();
    assert_eq!(count, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarlyWageContract, ());
    let admin = Address::generate(&env);

    let client = EarlyWageContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    client.initialize(&admin); // Should fail with AlreadyInitialized
}

// ============================================================
// Employee Registration Tests (Updated for Phase 1 Fix)
// ============================================================

#[test]
fn test_register_employee_workflow_success() {
    let (env, contract_id, _admin, token) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let employee_wallet = Address::generate(&env);
    let salary: u128 = 5_000_0000000; // 5,000 with 7 decimals

    // Step 1: Self Registration (Salary must be 0)
    let emp_id = client.register_employee(&employee_wallet);
    assert_eq!(emp_id, 1);

    let initial_details = client.get_emp_details(&emp_id);
    assert_eq!(initial_details.rem_salary, 0); // Security check

    // Step 2: Admin Approval
    client.set_employee_salary(&emp_id, &salary, &token.address);

    // Verify final details
    let final_details = client.get_emp_details(&emp_id);
    assert_eq!(final_details.emp_id, 1);
    assert_eq!(final_details.wallet, employee_wallet);
    assert_eq!(final_details.rem_salary, salary);
    assert_eq!(final_details.salary_token, token.address);

    // Verify count
    assert_eq!(client.get_employee_count(), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_register_duplicate_wallet_fails() {
    let (env, contract_id, _admin, _token) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    client.register_employee(&wallet);
    client.register_employee(&wallet); // Duplicate → AlreadyRegistered
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_set_zero_salary_fails() {
    let (env, contract_id, _admin, token) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    let emp_id = client.register_employee(&wallet);
    
    // Admin attempting to set 0 salary → InvalidAmount
    client.set_employee_salary(&emp_id, &0u128, &token.address); 
}

// ============================================================
// Deposit Tests
// ============================================================

#[test]
fn test_deposit_to_vault_success() {
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    // Mint tokens to admin
    token_client.mint(&admin, &100_000_0000000);

    // Deposit
    client.deposit_to_vault(&admin, &50_000_0000000i128, &token_client.address);

    // Check vault balance
    let balance = client.vault_balance(&token_client.address);
    assert_eq!(balance, 50_000_0000000);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_deposit_negative_amount_fails() {
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.deposit_to_vault(&admin, &-100i128, &token_client.address); // InvalidAmount
}

// ============================================================
// Advance Request Tests (Updated for Phase 2 Fix)
// ============================================================

#[test]
fn test_request_advance_success() {
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 10_000;

    // Use our DRY helper
    setup_employee(&client, &emp_wallet, salary, &token_client.address);

    // Fund the vault
    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Request advance of 5,000 (fee = 5000 * 125 / 10000 = 62)
    // NOTE: Token parameter removed due to Phase 2 anti-spoofing fix
    let net = client.request_advance(&1u128, &5_000i128);
    let expected_fee = 5_000i128 * 125 / 10000;
    let expected_net = 5_000i128 - expected_fee;
    assert_eq!(net, expected_net);

    // Remaining salary should be reduced
    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, salary - 5_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_request_advance_exceeds_salary_fails() {
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    setup_employee(&client, &emp_wallet, 5000u128, &token_client.address);

    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Try to advance more than allowed
    client.request_advance(&1u128, &6000i128);
}

#[test]
fn test_request_advance_exact_salary_success() {
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    setup_employee(&client, &emp_wallet, 5000u128, &token_client.address);

    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Phase 2 Fix: Advancing exact salary must succeed (used to fail due to >= bug)
    let net = client.request_advance(&1u128, &5000i128);
    assert!(net > 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_request_advance_zero_amount_fails() {
    let (env, contract_id, _admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    setup_employee(&client, &emp_wallet, 5000u128, &token_client.address);

    client.request_advance(&1u128, &0i128); // InvalidAmount
}

// ============================================================
// Salary Release Tests
// ============================================================

#[test]
fn test_release_remaining_salary_success() {
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 10_000;

    setup_employee(&client, &emp_wallet, salary, &token_client.address);

    // Fund the vault
    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Request partial advance first
    client.request_advance(&1u128, &3_000i128);

    // Release the remaining (10_000 - 3_000 = 7_000)
    let new_salary: u128 = 10_000;
    client.release_remaining_salary(&1u128, &token_client.address, &new_salary);

    // After release, salary resets to new cycle amount
    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, new_salary);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_get_details_nonexistent_fails() {
    let (env, contract_id, _admin, _token) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.get_emp_details(&42u128); // EmployeeNotFound
}