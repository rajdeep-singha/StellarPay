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
    /// The contract has not been initialized yet.
    NotInitialized = 1,
    /// The contract has already been initialized.
    AlreadyInitialized = 2,
    /// The caller is not the contract administrator.
    Unauthorized = 3,
    /// The wallet address is already registered as an employee.
    AlreadyRegistered = 4,
    /// The requested employee ID does not exist.
    EmployeeNotFound = 5,
    /// The requested advance exceeds the remaining salary.
    ExceedsRemainingSalary = 6,
    /// The amount must be greater than zero.
    InvalidAmount = 7,
    /// No remaining salary to release.
    NoRemainingSalary = 8,
    /// The requested vault does not exist.
    VaultNotFound = 9,
    /// The vault has insufficient balance for the operation.
    InsufficientVaultBalance = 10,
}

// ============================================================
// Storage Keys
// ============================================================
const ADMIN: Symbol = symbol_short!("ADMIN");
const EMP_COUNT: Symbol = symbol_short!("EMP_COUNT");
const EMP_DETAILS: Symbol = symbol_short!("EMP_DET");
const WALLET_TO_ID: Symbol = symbol_short!("wal2id");
const INITIALIZED: Symbol = symbol_short!("INIT");
const SUPPORTED_TOKENS: Symbol = symbol_short!("SUP_TOK");
const VAULT_COUNT: Symbol = symbol_short!("V_COUNT");
const VAULT_DETAILS: Symbol = symbol_short!("V_DET");
const VAULT_BALANCE: Symbol = symbol_short!("V_BAL");

// ============================================================
// Data Types
// ============================================================
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmployeeDetails {
    pub emp_id: u128,
    pub vault_id: u128,
    pub wallet: Address,
    pub rem_salary: u128,
    pub salary_token: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultDetails {
    pub vault_id: u128,
    pub admin: Address,
    pub name: Symbol,
}

#[contracttype]
pub struct TokenInfo {
    pub address: Address,
    pub symbol: soroban_sdk::String,
    pub decimals: u32,
}

// ============================================================
// Contract
// ============================================================
#[contract]
pub struct EarlyWageContract;

#[contractimpl]
impl EarlyWageContract {
    // --------------------------------------------------------
    // Initialization — must be called once by the deployer
    // --------------------------------------------------------

    /// Initialize the contract with an administrator address.
    /// Can only be called once.
    pub fn initialize(e: Env, admin: Address) -> Result<(), ContractError> {
        if e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        e.storage().instance().set(&ADMIN, &admin);
        e.storage().instance().set(&INITIALIZED, &true);
        e.storage().instance().set(&EMP_COUNT, &0u128);
        e.storage().instance().set(&VAULT_COUNT, &0u128);

        e.events()
            .publish((symbol_short!("init"),), admin.clone());

        Ok(())
    }

    // --------------------------------------------------------
    // Admin helper
    // --------------------------------------------------------
    fn require_admin(e: &Env) -> Result<Address, ContractError> {
        if !e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::NotInitialized);
        }
        let admin: Address = e.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        Ok(admin)
    }

    /// Get the current admin address.
    pub fn get_admin(e: Env) -> Result<Address, ContractError> {
        if !e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::NotInitialized);
        }
        Ok(e.storage().instance().get(&ADMIN).unwrap())
    }

    // --------------------------------------------------------
    // Token Management (admin only)
    // --------------------------------------------------------

    /// Add a supported token — only stored admin can call this.
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

    /// Get all supported tokens (public read).
    pub fn get_supported_tokens(e: Env) -> Vec<TokenInfo> {
        e.storage()
            .instance()
            .get(&SUPPORTED_TOKENS)
            .unwrap_or(Vec::new(&e))
    }

    // --------------------------------------------------------
    // Employee Management
    // --------------------------------------------------------

    /// Register a new employee and link them to a specific vault.
    /// Only the vault admin or global admin can register employees.
    pub fn register_employee(
        e: Env,
        vault_id: u128,
        wallet: Address,
        salary: u128,
        salary_token: Address,
    ) -> Result<u128, ContractError> {
        let vault = Self::get_vault_details(e.clone(), vault_id)?;
        
        // Authorization: either global admin or vault admin
        if let Ok(admin) = e.storage().instance().get::<_, Address>(&ADMIN).ok_or(ContractError::NotInitialized) {
            if !e.auths().iter().any(|a| a.address_authorized(&admin)) {
                vault.admin.require_auth();
            }
        } else {
            vault.admin.require_auth();
        }

        if salary == 0 {
            return Err(ContractError::InvalidAmount);
        }

        let mut wallet_map: Map<Address, u128> = e
            .storage()
            .instance()
            .get(&WALLET_TO_ID)
            .unwrap_or(Map::new(&e));

        if wallet_map.contains_key(wallet.clone()) {
            return Err(ContractError::AlreadyRegistered);
        }

        let mut emp_id: u128 = e.storage().instance().get(&EMP_COUNT).unwrap_or(0);
        emp_id += 1;

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        emp_map.set(
            emp_id,
            EmployeeDetails {
                emp_id,
                vault_id,
                wallet: wallet.clone(),
                rem_salary: salary,
                salary_token,
            },
        );
        wallet_map.set(wallet.clone(), emp_id);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
        e.storage().instance().set(&WALLET_TO_ID, &wallet_map);
        e.storage().instance().set(&EMP_COUNT, &emp_id);

        e.events()
            .publish((symbol_short!("employee"), symbol_short!("reg")), (emp_id, wallet));

        Ok(emp_id)
    }

    // --------------------------------------------------------
    // Vault Management
    // --------------------------------------------------------

    /// Create a new vault with a specific admin and name.
    pub fn create_vault(e: Env, admin: Address, name: Symbol) -> Result<u128, ContractError> {
        Self::require_admin(&e)?;

        let mut vault_id: u128 = e.storage().instance().get(&VAULT_COUNT).unwrap_or(0);
        vault_id += 1;

        let mut vault_map: Map<u128, VaultDetails> = e
            .storage()
            .instance()
            .get(&VAULT_DETAILS)
            .unwrap_or(Map::new(&e));

        vault_map.set(
            vault_id,
            VaultDetails {
                vault_id,
                admin: admin.clone(),
                name,
            },
        );

        e.storage().instance().set(&VAULT_DETAILS, &vault_map);
        e.storage().instance().set(&VAULT_COUNT, &vault_id);

        e.events().publish(
            (symbol_short!("vault"), symbol_short!("created")),
            (vault_id, admin, name),
        );

        Ok(vault_id)
    }

    /// Deposit tokens into a specific vault.
    pub fn deposit_to_vault(
        e: Env,
        vault_id: u128,
        from: Address,
        amount: i128,
        token: Address,
    ) -> Result<(), ContractError> {
        from.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Verify vault exists
        let _vault = Self::get_vault_details(e.clone(), vault_id)?;

        let client = token::Client::new(&e, &token);
        client.transfer(&from, &e.current_contract_address(), &amount);

        // Update internal vault balance
        let balance_key = (VAULT_BALANCE, vault_id, token.clone());
        let current_balance: i128 = e.storage().instance().get(&balance_key).unwrap_or(0);
        e.storage()
            .instance()
            .set(&balance_key, &(current_balance + amount));

        e.events().publish(
            (symbol_short!("vault"), symbol_short!("deposit")),
            (vault_id, from, amount, token),
        );

        Ok(())
    }

    /// Withdraw tokens from a vault. Only the vault admin can call this.
    pub fn withdraw_from_vault(
        e: Env,
        vault_id: u128,
        to: Address,
        amount: i128,
        token: Address,
    ) -> Result<(), ContractError> {
        let vault = Self::get_vault_details(e.clone(), vault_id)?;
        vault.admin.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let balance_key = (VAULT_BALANCE, vault_id, token.clone());
        let current_balance: i128 = e.storage().instance().get(&balance_key).unwrap_or(0);

        if current_balance < amount {
            return Err(ContractError::InsufficientVaultBalance);
        }

        let client = token::Client::new(&e, &token);
        client.transfer(&e.current_contract_address(), &to, &amount);

        e.storage()
            .instance()
            .set(&balance_key, &(current_balance - amount));

        e.events().publish(
            (symbol_short!("vault"), symbol_short!("withdraw")),
            (vault_id, to, amount, token),
        );

        Ok(())
    }

    /// Get details of a vault.
    pub fn get_vault_details(e: Env, vault_id: u128) -> Result<VaultDetails, ContractError> {
        let vault_map: Map<u128, VaultDetails> = e
            .storage()
            .instance()
            .get(&VAULT_DETAILS)
            .unwrap_or(Map::new(&e));
        vault_map.get(vault_id).ok_or(ContractError::VaultNotFound)
    }

    /// Get internal balance of a specific vault for a token.
    pub fn get_vault_balance(e: Env, vault_id: u128, token: Address) -> i128 {
        let balance_key = (VAULT_BALANCE, vault_id, token);
        e.storage().instance().get(&balance_key).unwrap_or(0)
    }

    /// Get vault balances for multiple tokens.
    pub fn vault_balances_multi(
        e: Env,
        vault_id: u128,
        tokens: Vec<Address>,
    ) -> Map<Address, i128> {
        let mut balances: Map<Address, i128> = Map::new(&e);
        for i in 0..tokens.len() {
            let token_addr = tokens.get(i).unwrap();
            let balance = Self::get_vault_balance(e.clone(), vault_id, token_addr.clone());
            balances.set(token_addr, balance);
        }
        balances
    }

    // --------------------------------------------------------
    // Advance Requests
    // --------------------------------------------------------

    /// Request an early wage advance. Only the employee whose
    /// wallet is registered for the given `emp_id` can call this.
    /// A 1.25 % processing fee is deducted automatically.
    pub fn request_advance(
        e: Env,
        emp_id: u128,
        amount: i128,
        token: Address,
    ) -> Result<i128, ContractError> {
        if !e.storage().instance().has(&INITIALIZED) {
            return Err(ContractError::NotInitialized);
        }

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let mut emp = emp_map.get(emp_id).ok_or(ContractError::EmployeeNotFound)?;

        // Authorization: only the employee can request their own advance
        emp.wallet.require_auth();

        if amount as u128 >= emp.rem_salary {
            return Err(ContractError::ExceedsRemainingSalary);
        }

        let fee = amount * 125 / 10000; // 1.25 %
        let final_amount = amount - fee;

        // Check vault balance
        let balance_key = (VAULT_BALANCE, emp.vault_id, token.clone());
        let current_balance: i128 = e.storage().instance().get(&balance_key).unwrap_or(0);
        if current_balance < amount {
            return Err(ContractError::InsufficientVaultBalance);
        }

        let client = token::Client::new(&e, &token);
        client.transfer(&e.current_contract_address(), &emp.wallet, &final_amount);

        // Update vault balance
        e.storage()
            .instance()
            .set(&balance_key, &(current_balance - amount));

        emp.rem_salary -= amount as u128;
        emp_map.set(emp_id, emp.clone());

        e.storage().instance().set(&EMP_DETAILS, &emp_map);

        e.events().publish(
            (symbol_short!("advance"), symbol_short!("requested")),
            (emp_id, amount, fee, final_amount, token, emp.vault_id),
        );

        Ok(final_amount)
    }

    // --------------------------------------------------------
    // Salary Release
    // --------------------------------------------------------

    /// Release the remaining salary to an employee and reset
    /// their balance for the next pay cycle. Admin only.
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

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let mut emp = emp_map.get(emp_id).ok_or(ContractError::EmployeeNotFound)?;

        if emp.rem_salary == 0 {
            return Err(ContractError::NoRemainingSalary);
        }

        // Check vault balance
        let balance_key = (VAULT_BALANCE, emp.vault_id, token.clone());
        let current_balance: i128 = e.storage().instance().get(&balance_key).unwrap_or(0);
        if current_balance < emp.rem_salary as i128 {
            return Err(ContractError::InsufficientVaultBalance);
        }

        let client = token::Client::new(&e, &token);
        client.transfer(
            &e.current_contract_address(),
            &emp.wallet,
            &(emp.rem_salary as i128),
        );

        // Update vault balance
        e.storage()
            .instance()
            .set(&balance_key, &(current_balance - emp.rem_salary as i128));

        e.events().publish(
            (symbol_short!("release"), symbol_short!("released")),
            (emp_id, emp.rem_salary, token, emp.vault_id),
        );

        emp.rem_salary = salary;
        emp_map.set(emp_id, emp);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);

        Ok(())
    }

    // --------------------------------------------------------
    // Read-only Queries
    // --------------------------------------------------------

    /// Return the contract vault's token balance.
    pub fn vault_balance(e: Env, token: Address) -> i128 {
        let client = token::Client::new(&e, &token);
        client.balance(&e.current_contract_address())
    }

    /// Return an employee's full details.
    pub fn get_emp_details(e: Env, emp_id: u128) -> Result<EmployeeDetails, ContractError> {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        emp_map.get(emp_id).ok_or(ContractError::EmployeeNotFound)
    }

    /// Get employee ID by wallet address.
    pub fn get_emp_id_by_wallet(e: Env, wallet: Address) -> u128 {
        let wallet_map: Map<Address, u128> = e
            .storage()
            .instance()
            .get(&WALLET_TO_ID)
            .unwrap_or(Map::new(&e));
        wallet_map.get(wallet).unwrap_or(0)
    }

    /// Return an employee's remaining salary for the current cycle.
    pub fn get_remaining_salary(e: Env, emp_id: u128) -> Result<u128, ContractError> {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        let emp = emp_map.get(emp_id).ok_or(ContractError::EmployeeNotFound)?;
        Ok(emp.rem_salary)
    }

    /// Return total employee count.
    pub fn get_employee_count(e: Env) -> u128 {
        e.storage().instance().get(&EMP_COUNT).unwrap_or(0)
    }
}