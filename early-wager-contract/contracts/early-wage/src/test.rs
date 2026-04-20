#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    symbol_short, Address, Env,
};

// Helper: deploy the token contract from the companion crate and mint
// initial supply to a given address.
fn create_token<'a>(e: &Env, admin: &Address) -> token::Client<'a> {
    let token_address = e.register_stellar_asset_contract_v2(admin.clone()).address().clone();
    token::Client::new(e, &token_address)
}

/// Setup helper — returns (env, contract_address, admin, token_client, vault_id).
fn setup() -> (Env, Address, Address, token::Client<'static>, u128) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarlyWageContract, ());
    let admin = Address::generate(&env);
    let token_client = create_token(&env, &admin);

    // Initialize
    let client = EarlyWageContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    // Create a default vault
    let vault_id = client.create_vault(&admin, &symbol_short!("DFT_VLT"));

    (env, contract_id, admin, token_client, vault_id)
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
    let (env, contract_id, _admin, token, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let employee_wallet = Address::generate(&env);
    let salary: u128 = 5_000_0000000; // 5,000 with 7 decimals

    let emp_id = client.register_employee(&vault_id, &employee_wallet, &salary, &token.address);
    assert_eq!(emp_id, 1);

    // Verify details
    let details = client.get_emp_details(&1u128);
    assert_eq!(details.emp_id, 1);
    assert_eq!(details.vault_id, vault_id);
    assert_eq!(details.wallet, employee_wallet);
    assert_eq!(details.rem_salary, salary);

    // Verify count
    assert_eq!(client.get_employee_count(), 1);
}

#[test]
fn test_register_multiple_employees() {
    let (env, contract_id, _admin, token, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet1 = Address::generate(&env);
    let wallet2 = Address::generate(&env);
    let wallet3 = Address::generate(&env);

    let id1 = client.register_employee(&vault_id, &wallet1, &5000u128, &token.address);
    let id2 = client.register_employee(&vault_id, &wallet2, &7500u128, &token.address);
    let id3 = client.register_employee(&vault_id, &wallet3, &3000u128, &token.address);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
    assert_eq!(client.get_employee_count(), 3);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_register_duplicate_wallet_fails() {
    let (env, contract_id, _admin, token, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    client.register_employee(&vault_id, &wallet, &5000u128, &token.address);
    client.register_employee(&vault_id, &wallet, &8000u128, &token.address); // Duplicate → AlreadyRegistered
}

// ============================================================
// Vault Management Tests
// ============================================================

#[test]
fn test_deposit_to_vault_success() {
    let (env, contract_id, admin, token_client, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    // Mint tokens to admin
    token_client.mint(&admin, &100_000_0000000);

    // Deposit
    client.deposit_to_vault(&vault_id, &admin, &50_000_0000000i128, &token_client.address);

    // Check vault balance
    let balance = client.get_vault_balance(&vault_id, &token_client.address);
    assert_eq!(balance, 50_000_0000000);
}

#[test]
fn test_multiple_vaults_isolation() {
    let (env, contract_id, admin, token_client, vault1_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let vault2_admin = Address::generate(&env);
    let vault2_id = client.create_vault(&vault2_admin, &symbol_short!("VLT_2"));

    // Mint and deposit to Vault 1
    token_client.mint(&admin, &1000);
    client.deposit_to_vault(&vault1_id, &admin, &1000i128, &token_client.address);

    // Mint and deposit to Vault 2
    token_client.mint(&vault2_admin, &2000);
    client.deposit_to_vault(&vault2_id, &vault2_admin, &2000i128, &token_client.address);

    // Check balances are isolated
    assert_eq!(client.get_vault_balance(&vault1_id, &token_client.address), 1000);
    assert_eq!(client.get_vault_balance(&vault2_id, &token_client.address), 2000);

    // Check total contract balance
    assert_eq!(token_client.balance(&contract_id), 3000);
}

#[test]
fn test_withdraw_from_vault_success() {
    let (env, contract_id, admin, token_client, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let vault_details = client.get_vault_details(&vault_id);
    let v_admin = vault_details.admin;

    token_client.mint(&v_admin, &5000);
    client.deposit_to_vault(&vault_id, &v_admin, &5000i128, &token_client.address);

    let to = Address::generate(&env);
    client.withdraw_from_vault(&vault_id, &to, &2000i128, &token_client.address);

    assert_eq!(client.get_vault_balance(&vault_id, &token_client.address), 3000);
    assert_eq!(token_client.balance(&to), 2000);
}

// ============================================================
// Advance Request Tests
// ============================================================

#[test]
fn test_request_advance_success() {
    let (env, contract_id, admin, token_client, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 10_000;

    client.register_employee(&vault_id, &emp_wallet, &salary, &token_client.address);

    // Fund the vault
    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&vault_id, &admin, &100_000i128, &token_client.address);

    // Request advance of 5,000 (fee = 5000 * 125 / 10000 = 62)
    let net = client.request_advance(&1u128, &5_000i128, &token_client.address);
    let expected_fee = 5_000i128 * 125 / 10000;
    let expected_net = 5_000i128 - expected_fee;
    assert_eq!(net, expected_net);

    // Remaining salary should be reduced
    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, salary - 5_000);
    
    // Vault balance should be reduced by 5,000 (the full advanced amount is deducted from vault quota)
    assert_eq!(client.get_vault_balance(&vault_id, &token_client.address), 95_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_vault_insufficient_balance_fails() {
    let (env, contract_id, _admin, token_client, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    client.register_employee(&vault_id, &emp_wallet, &10000u128, &token_client.address);

    // Vault has 0 balance, request advance → InsufficientVaultBalance
    client.request_advance(&1u128, &500i128, &token_client.address);
}

// ============================================================
// Salary Release Tests
// ============================================================

#[test]
fn test_release_remaining_salary_success() {
    let (env, contract_id, admin, token_client, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let emp_wallet = Address::generate(&env);
    let salary: u128 = 10_000;

    client.register_employee(&vault_id, &emp_wallet, &salary, &token_client.address);

    // Fund the vault
    token_client.mint(&admin, &100_000);
    client.deposit_to_vault(&vault_id, &admin, &100_000i128, &token_client.address);

    // Request partial advance first
    client.request_advance(&1u128, &3_000i128, &token_client.address);

    // Release the remaining (10_000 - 3_000 = 7_000)
    let new_salary: u128 = 10_000;
    client.release_remaining_salary(&1u128, &token_client.address, &new_salary);

    // After release, salary resets to new cycle amount
    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, new_salary);
}

// ============================================================
// Query Tests
// ============================================================

#[test]
fn test_get_remaining_salary() {
    let (env, contract_id, _admin, token, vault_id) = setup();
    let client = EarlyWageContractClient::new(&env, &contract_id);

    let wallet = Address::generate(&env);
    client.register_employee(&vault_id, &wallet, &8500u128, &token.address);

    let remaining = client.get_remaining_salary(&1u128);
    assert_eq!(remaining, 8500);
}

#[test]
fn test_get_admin() {
    let (env, contract_id, admin, _token, _vault_id) = setup();
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
