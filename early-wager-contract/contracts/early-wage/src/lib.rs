#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Map,
    Symbol, Vec,
};

// ============================================================
// Error Types — Replace raw panic! with typed, on-chain errors
// ============================================================
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    AlreadyRegistered = 4,
    EmployeeNotFound = 5,
    ExceedsRemainingSalary = 6,
    InvalidAmount = 7,
    NoRemainingSalary = 8,
}

// ============================================================
// Storage Keys & Constants
// ============================================================
const ADMIN: Symbol = symbol_short!("ADMIN");
const EMP_COUNT: Symbol = symbol_short!("EMP_COUNT");
const INITIALIZED: Symbol = symbol_short!("INIT");
const SUPPORTED_TOKENS: Symbol = symbol_short!("SUP_TOK");

// TTL Constants for State Rent (Phase 3 Fix)
// 1 ledger = ~5 seconds. 1 day = ~17,280 ledgers.
const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // Add 30 days of lifetime
const LIFETIME_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS; // Bump if less than 15 days remaining

// ============================================================
// Data Types
// ============================================================
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmployeeDetails {
    pub emp_id: u128,
    pub wallet: Address,
    pub rem_salary: u128,
    pub salary_token: Address,
}

#[contracttype]
pub struct TokenInfo {
    pub address: Address,
    pub symbol: soroban_sdk::String,
    pub decimals: u32,
}

// ============================================================
// Storage Helpers (Phase 3 Fix - O(1) Storage & TTL Management)
// ============================================================
// These private helpers prevent DoS by avoiding large Maps in Instance storage.
// They use Persistent storage with individual tuple keys and automatically manage rent.

fn read_employee(e: &Env, emp_id: u128) -> Result<EmployeeDetails, ContractError> {
    let key = (symbol_short!("EMP_DET"), emp_id);
    if let Some(emp) = e.storage().persistent().get::<_, EmployeeDetails>(&key) {
        e.storage().persistent().extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
        Ok(emp)
    } else {
        Err(ContractError::EmployeeNotFound)
    }
}

fn write_employee(e: &Env, emp_id: u128, emp: &EmployeeDetails) {
    let key = (symbol_short!("EMP_DET"), emp_id);
    e.storage().persistent().set(&key, emp);
    e.storage().persistent().extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

fn read_wallet_id(e: &Env, wallet: &Address) -> Option<u128> {
    let key = (symbol_short!("W_TO_ID"), wallet.clone());
    if let Some(id) = e.storage().persistent().get::<_, u128>(&key) {
        e.storage().persistent().extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
        Some(id)
    } else {
        None
    }
}

fn write_wallet_id(e: &Env, wallet: &Address, emp_id: u128) {
    let key = (symbol_short!("W_TO_ID"), wallet.clone());
    e.storage().persistent().set(&key, &emp_id);
    e.storage().persistent().extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);
}

// ============================================================
// Contract
// ============================================================
#[contract]
pub struct EarlyWageContract;

#[contractimpl]
impl EarlyWageContract {
    // --------------------------------------------------------
    // Initialization
    // --------------------------------------------------------

    pub fn initialize(e: Env, admin: Address) -> Result<(), ContractError> {
        if e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        e.storage().instance().set(&ADMIN, &admin);
        e.storage().instance().set(&INITIALIZED, &true);
        e.storage().instance().set(&EMP_COUNT, &0u128);

        e.events().publish((symbol_short!("init"),), admin.clone());

        Ok(())
    }

    // --------------------------------------------------------
    // Admin Helper
    // --------------------------------------------------------
    fn require_admin(e: &Env) -> Result<Address, ContractError> {
        if !e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::NotInitialized);
        }
        let admin: Address = e.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        Ok(admin)
    }

    pub fn get_admin(e: Env) -> Result<Address, ContractError> {
        if !e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::NotInitialized);
        }
        Ok(e.storage().instance().get(&ADMIN).unwrap())
    }

    // --------------------------------------------------------
    // Token Management
    // --------------------------------------------------------

    pub fn add_supported_token(
        e: Env,
        token_address: Address,
        symbol: soroban_sdk::String,
        decimals: u32,
    ) -> Result<(), ContractError> {
        Self::require_admin(&e)?;

        let mut tokens: Vec<TokenInfo> = e
            .storage()
            .instance()
            .get(&SUPPORTED_TOKENS)
            .unwrap_or(Vec::new(&e));

        tokens.push_back(TokenInfo {
            address: token_address,
            symbol,
            decimals,
        });

        e.storage().instance().set(&SUPPORTED_TOKENS, &tokens);
        Ok(())
    }

    pub fn get_supported_tokens(e: Env) -> Vec<TokenInfo> {
        e.storage()
            .instance()
            .get(&SUPPORTED_TOKENS)
            .unwrap_or(Vec::new(&e))
    }

    // --------------------------------------------------------
    // Employee Management (Phase 1 & 3 Fixes)
    // --------------------------------------------------------

    /// Employee self-registration. Initializes with 0 salary for security.
    pub fn register_employee(
        e: Env,
        wallet: Address,
    ) -> Result<u128, ContractError> {
        
        // Ensure caller is the wallet owner (Identity Verification)
        wallet.require_auth();

        // O(1) Check using Persistent Storage Helper
        if read_wallet_id(&e, &wallet).is_some() {
            return Err(ContractError::AlreadyRegistered);
        }

        let mut emp_id: u128 = e.storage().instance().get(&EMP_COUNT).unwrap_or(0);
        emp_id += 1;
        
        // Register employee with 0 salary to prevent draining the vault
        let new_emp = EmployeeDetails {
            emp_id,
            wallet: wallet.clone(),
            rem_salary: 0, 
            salary_token: e.current_contract_address(), // Temporary placeholder
        };

        // Write using O(1) Helper (saves to Persistent & pays TTL rent)
        write_employee(&e, emp_id, &new_emp);
        write_wallet_id(&e, &wallet, emp_id);

        e.storage().instance().set(&EMP_COUNT, &emp_id);

        e.events().publish((symbol_short!("employee"), symbol_short!("reg")), (emp_id, wallet));

        Ok(emp_id)
    }

    /// Admin updates salary and assigns correct token (Employer Approval)
    pub fn set_employee_salary(
        e: Env,
        emp_id: u128,
        salary: u128,
        salary_token: Address,
    ) -> Result<(), ContractError> {
        
        Self::require_admin(&e)?;

        if salary == 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Fetch employee using O(1) Helper
        let mut emp = read_employee(&e, emp_id)?;

        emp.rem_salary = salary;
        emp.salary_token = salary_token;

        // Save back using O(1) Helper
        write_employee(&e, emp_id, &emp);

        Ok(())
    }

    // --------------------------------------------------------
    // Vault / Deposit
    // --------------------------------------------------------

    pub fn deposit_to_vault(
        e: Env,
        from: Address,
        amount: i128,
        token: Address,
    ) -> Result<(), ContractError> {
        from.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let client = token::Client::new(&e, &token);
        if client.balance(&from) < amount {
            return Err(ContractError::InvalidAmount);
        }
        client.transfer(&from, &e.current_contract_address(), &amount);

        e.events().publish((symbol_short!("vault"), symbol_short!("deposit")), (from, amount, token));

        Ok(())
    }

    pub fn vault_balances_multi(e: Env, tokens: Vec<Address>) -> Map<Address, i128> {
        let mut balances: Map<Address, i128> = Map::new(&e);
        for i in 0..tokens.len() {
            let token_addr = tokens.get(i).unwrap();
            let client = token::Client::new(&e, &token_addr);
            let balance = client.balance(&e.current_contract_address());
            balances.set(token_addr, balance);
        }
        balances
    }

    // --------------------------------------------------------
    // Advance Requests (Phase 2 & 3 Fixes)
    // --------------------------------------------------------

    /// Employee requests early wage. Token spoofing bug fixed.
    pub fn request_advance(
        e: Env,
        emp_id: u128,
        amount: i128,
    ) -> Result<i128, ContractError> {
        if !e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::NotInitialized);
        }

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Fetch using O(1) Helper
        let mut emp = read_employee(&e, emp_id)?;

        emp.wallet.require_auth();

        // Mathematical Fix: Allow full salary withdrawal (>)
        if amount as u128 > emp.rem_salary {
            return Err(ContractError::ExceedsRemainingSalary);
        }

        let fee = amount * 125 / 10000; // 1.25 %
        let final_amount = amount - fee;

        // Security Fix: Enforce registered salary_token to prevent spoofing
        let client = token::Client::new(&e, &emp.salary_token);
        client.transfer(&e.current_contract_address(), &emp.wallet, &final_amount);

        emp.rem_salary -= amount as u128;
        
        // Save using O(1) Helper
        write_employee(&e, emp_id, &emp);

        e.events().publish((symbol_short!("advance"), symbol_short!("requested")), (emp_id, amount, fee, final_amount, emp.salary_token));

        Ok(final_amount)
    }

    // --------------------------------------------------------
    // Salary Release
    // --------------------------------------------------------

    pub fn release_remaining_salary(
        e: Env,
        emp_id: u128,
        token: Address,
        salary: u128,
    ) -> Result<(), ContractError> {
        Self::require_admin(&e)?;

        if salary == 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Fetch using O(1) Helper
        let mut emp = read_employee(&e, emp_id)?;

        if emp.rem_salary == 0 {
            return Err(ContractError::NoRemainingSalary);
        }

        let client = token::Client::new(&e, &token);
        client.transfer(
            &e.current_contract_address(),
            &emp.wallet,
            &(emp.rem_salary as i128),
        );

        e.events().publish(
            (symbol_short!("release"),symbol_short!("released")),
            (emp_id, emp.rem_salary, token),
        );

        emp.rem_salary = salary;
        
        // Save using O(1) Helper
        write_employee(&e, emp_id, &emp);

        Ok(())
    }

    // --------------------------------------------------------
    // Read-only Queries (Phase 3 Fix)
    // --------------------------------------------------------

    pub fn vault_balance(e: Env, token: Address) -> i128 {
        let client = token::Client::new(&e, &token);
        client.balance(&e.current_contract_address())
    }

    pub fn get_emp_details(e: Env, emp_id: u128) -> Result<EmployeeDetails, ContractError> {
        read_employee(&e, emp_id)
    }

    pub fn get_emp_id_by_wallet(e: Env, wallet: Address) -> u128 {
        read_wallet_id(&e, &wallet).unwrap_or(0)
    }

    pub fn get_remaining_salary(e: Env, emp_id: u128) -> Result<u128, ContractError> {
        let emp = read_employee(&e, emp_id)?;
        Ok(emp.rem_salary)
    }

    pub fn get_employee_count(e: Env) -> u128 {
        e.storage().instance().get(&EMP_COUNT).unwrap_or(0)
    }
}