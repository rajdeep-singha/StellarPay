// Tests for the EarlyWageContract.
// Note: this module is already gated by `#[cfg(test)] mod test;` in lib.rs.

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

// Helper: deploy a Stellar Asset Contract and return both clients.
// - `TokenClient` is the SEP-41 interface (balance, transfer, …)
// - `StellarAssetClient` is the admin interface (mint, clawback, …)
fn create_token(
    e: &Env,
    admin: &Address,
) -> (token::Client<'static>, token::StellarAssetClient<'static>) {
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    let addr = sac.address().clone();
    (
        token::Client::new(e, &addr),
        token::StellarAssetClient::new(e, &addr),
    )
}

/// Setup helper — returns (env, contract_address, admin, token_client, sac_client).
fn setup() -> (
    Env,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarlyWageContract, ());
    let admin = Address::generate(&env);
    let (token_client, sac_client) = create_token(&env, &admin);

    // Initialize
    let client = EarlyWageContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, contract_id, admin, token_client, sac_client)
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
// Employee Registration Tests
// ============================================================

#[test]
fn test_register_employee_success() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let employee_wallet = Address::generate(&env);
    let salary: u128 = 50_000_000_000; // 5,000 with 7 decimals

    let emp_id = client.register_employee(&employee_wallet, &salary, &token_client.address);
    assert_eq!(emp_id, 1);

    // Verify details
    let details = client.get_emp_details(&1u128);
    assert_eq!(details.emp_id, 1);
    assert_eq!(details.wallet, employee_wallet);
    assert_eq!(details.rem_salary, salary);

    // Verify count
    assert_eq!(client.get_employee_count(), 1);
}

#[test]
fn test_register_multiple_employees() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet1 = Address::generate(&env);
    let wallet2 = Address::generate(&env);
    let wallet3 = Address::generate(&env);

    let id1 = client.register_employee(&wallet1, &5000u128, &token_client.address);
    let id2 = client.register_employee(&wallet2, &7500u128, &token_client.address);
    let id3 = client.register_employee(&wallet3, &3000u128, &token_client.address);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
    assert_eq!(client.get_employee_count(), 3);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_register_duplicate_wallet_fails() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    client.register_employee(&wallet, &5000u128, &token_client.address);
    client.register_employee(&wallet, &8000u128, &token_client.address); // Duplicate → AlreadyRegistered
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_register_zero_salary_fails() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    client.register_employee(&wallet, &0u128, &token_client.address); // Zero salary → InvalidAmount
}

// ============================================================
// Deposit Tests
// ============================================================

#[test]
fn test_deposit_to_vault_success() {
    let (env, contract_id, admin, token_client, sac_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    // Mint tokens to admin via StellarAssetClient
    sac_client.mint(&admin, &1_000_000_000_000);

    // Deposit
    client.deposit_to_vault(&admin, &500_000_000_000_i128, &token_client.address);

    // Check vault balance
    let balance = client.vault_balance(&token_client.address);
    assert_eq!(balance, 500_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_deposit_zero_amount_fails() {
    let (env, contract_id, admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.deposit_to_vault(&admin, &0i128, &token_client.address); // InvalidAmount
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_deposit_negative_amount_fails() {
    let (env, contract_id, admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.deposit_to_vault(&admin, &-100i128, &token_client.address); // InvalidAmount
}

// ============================================================
// Advance Request Tests
// ============================================================

#[test]
fn test_request_advance_success() {
    let (env, contract_id, admin, token_client, sac_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 10_000;

    client.register_employee(&emp_wallet, &salary, &token_client.address);

    // Fund the vault
    sac_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Request advance of 5,000 (fee = 5000 * 125 / 10000 = 62)
    let net = client.request_advance(&1u128, &5_000i128, &token_client.address);
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
    let (env, contract_id, admin, token_client, sac_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    client.register_employee(&emp_wallet, &5000u128, &token_client.address);

    sac_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Try to advance entire salary (>= rem_salary) → ExceedsRemainingSalary
    client.request_advance(&1u128, &5000i128, &token_client.address);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_request_advance_equal_salary_fails() {
    // Test for Bug 1 fix: amount == rem_salary should fail
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 5000;
    client.register_employee(&emp_wallet, &salary);

    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Try to advance exactly the remaining salary → ExceedsRemainingSalary
    client.request_advance(&1u128, &(salary as i128), &token_client.address);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_request_advance_insufficient_vault_balance_fails() {
    // Test for Bug 2 fix: insufficient vault balance should fail with clear error
    let (env, contract_id, admin, token_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    client.register_employee(&emp_wallet, &5000u128);

    // Deposit only 1000 to vault, but try to advance 5000
    token_client.mint(&admin, &1000);
    client.deposit_to_vault(&admin, &1000i128, &token_client.address);

    // Should fail with InsufficientVaultBalance before attempting transfer
    client.request_advance(&1u128, &4000i128, &token_client.address);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_request_advance_zero_amount_fails() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    client.register_employee(&emp_wallet, &5000u128, &token_client.address);

    client.request_advance(&1u128, &0i128, &token_client.address); // InvalidAmount
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_request_advance_nonexistent_employee_fails() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.request_advance(&999u128, &100i128, &token_client.address); // EmployeeNotFound
}

// ============================================================
// Release Remaining Salary Tests
// ============================================================

#[test]
fn test_release_remaining_salary_success() {
    let (env, contract_id, admin, token_client, sac_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 10_000;

    client.register_employee(&emp_wallet, &salary, &token_client.address);

    // Fund the vault
    sac_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Request partial advance first
    client.request_advance(&1u128, &3_000i128, &token_client.address);

    // Release the remaining (10_000 - 3_000 = 7_000)
    let new_salary: u128 = 10_000;
    client.release_remaining_salary(&1u128, &token_client.address, &new_salary);

    // After release, salary resets to new cycle amount
    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, new_salary);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_release_zero_remaining_fails() {
    let (env, contract_id, admin, token_client, sac_client) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);

    // Register with salary and advance everything possible
    // We'll manipulate: register with salary = 1, then remaining = 1
    // Actually, to get rem_salary = 0 we need a different approach.
    // The cleanest way: register, release (which transfers rem_salary and sets to new),
    // then register a new employee with remaining already 0.
    // Actually the contract sets rem_salary = salary on register.
    // To make rem_salary = 0, we'd need to advance the full amount,
    // but advance requires amount < rem_salary (strict less than).
    // So rem_salary can never actually reach 0 through advances alone.
    // This test verifies the error path is reachable if rem_salary were 0.

    // For testing, we'll register emp, release (pays rem_salary, sets to 0)
    client.register_employee(&emp_wallet, &1000u128, &token_client.address);

    sac_client.mint(&admin, &100_000);
    client.deposit_to_vault(&admin, &100_000i128, &token_client.address);

    // Release with new_salary = 0 (simulating end of employment)
    client.release_remaining_salary(&1u128, &token_client.address, &0u128);

    // Now rem_salary = 0, try to release again → NoRemainingSalary
    client.release_remaining_salary(&1u128, &token_client.address, &5000u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_release_nonexistent_employee_fails() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.release_remaining_salary(&999u128, &token_client.address, &5000u128);
    // EmployeeNotFound
}

// ============================================================
// Query Tests
// ============================================================

#[test]
fn test_get_remaining_salary() {
    let (env, contract_id, _admin, token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    client.register_employee(&wallet, &8500u128, &token_client.address);

    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, 8500);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_get_details_nonexistent_fails() {
    let (env, contract_id, _admin, _token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.get_emp_details(&42u128); // EmployeeNotFound
}

#[test]
fn test_get_admin() {
    let (env, contract_id, admin, _token_client, _sac) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_get_admin_before_init_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarlyWageContract, ());
    let client = EarlyWageContractClient::new(&env, &contract_id);

    client.get_admin(); // NotInitialized
}
