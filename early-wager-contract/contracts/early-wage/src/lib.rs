#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Map, Symbol, Vec,
};

#[contract]
pub struct EarlyWageContract;

const EMP_COUNT: Symbol = symbol_short!("EMP_COUNT");
const EMP_DETAILS: Symbol = symbol_short!("EMP_DET");
const WALLET_TO_ID: Symbol = symbol_short!("wal2id");
const VAULT_COUNT: Symbol = symbol_short!("VLT_CNT");
const VAULTS: Symbol = symbol_short!("VAULTS");
const ADMIN: Symbol = symbol_short!("ADMIN");

#[contracttype]
pub struct EmployeeDetails {
    pub emp_id: u128,
    pub wallet: Address,
    pub rem_salary: u128,
    pub vault_id: u128, // Which vault this employee is associated with
}

#[contracttype]
pub struct VaultInfo {
    pub vault_id: u128,
    pub token_address: Address,
    pub admin: Address,
    pub total_deposited: i128,
    pub total_withdrawn: i128,
    pub is_active: bool,
    pub allowed_employees: Vec<u128>, // List of employee IDs allowed to access this vault
}

fn distribute_for_demo(e: &Env, sender: Address, add1: Address, add2: Address, token: Address) {
    sender.require_auth();
    let token = token::TokenClient::new(e, &token);

    token.transfer_from(&sender, &sender, &add1, &1000);
    token.transfer_from(&sender, &sender, &add2, &1000);
}

#[contractimpl]
impl EarlyWageContract {
    // Initialize contract with admin
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&ADMIN) {
            panic!("Contract already initialized");
        }
        admin.require_auth();
        e.storage().instance().set(&ADMIN, &admin);
        e.storage().instance().set(&VAULT_COUNT, &0u128);
        e.storage().instance().set(&EMP_COUNT, &0u128);
    }

    // Create a new vault
    pub fn create_vault(e: Env, admin: Address, token_address: Address) -> u128 {
        let contract_admin: Address = e.storage().instance().get(&ADMIN).unwrap();
        if contract_admin != admin {
            panic!("Only admin can create vaults");
        }
        admin.require_auth();

        let mut vault_id: u128 = e.storage().instance().get(&VAULT_COUNT).unwrap_or(0);
        vault_id += 1;

        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let vault = VaultInfo {
            vault_id,
            token_address,
            admin: admin.clone(),
            total_deposited: 0,
            total_withdrawn: 0,
            is_active: true,
            allowed_employees: Vec::new(&e),
        };

        vaults.set(vault_id, vault);
        e.storage().instance().set(&VAULTS, &vaults);
        e.storage().instance().set(&VAULT_COUNT, &vault_id);

        vault_id
    }

    // Toggle vault active status
    pub fn toggle_vault_status(e: Env, admin: Address, vault_id: u128) {
        admin.require_auth();

        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(vault_id).unwrap();
        
        if vault.admin != admin {
            panic!("Only vault admin can toggle status");
        }

        vault.is_active = !vault.is_active;
        vaults.set(vault_id, vault);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    // Add employee to vault's allowed list
    pub fn add_employee_to_vault(e: Env, admin: Address, vault_id: u128, emp_id: u128) {
        admin.require_auth();

        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(vault_id).unwrap();
        
        if vault.admin != admin {
            panic!("Only vault admin can add employees");
        }

        if !vault.is_active {
            panic!("Vault is not active");
        }

        // Check if employee exists
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        
        if !emp_map.contains_key(emp_id) {
            panic!("Employee does not exist");
        }

        // Add to allowed list if not already present
        let mut allowed = vault.allowed_employees;
        if !allowed.contains(&emp_id) {
            allowed.push_back(emp_id);
        }
        vault.allowed_employees = allowed;

        vaults.set(vault_id, vault);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    // Remove employee from vault's allowed list
    pub fn remove_employee_from_vault(e: Env, admin: Address, vault_id: u128, emp_id: u128) {
        admin.require_auth();

        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(vault_id).unwrap();
        
        if vault.admin != admin {
            panic!("Only vault admin can remove employees");
        }

        let mut new_allowed = Vec::new(&e);
        for emp in vault.allowed_employees.iter() {
            if emp != emp_id {
                new_allowed.push_back(emp);
            }
        }
        vault.allowed_employees = new_allowed;

        vaults.set(vault_id, vault);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    pub fn register_employee(e: Env, wallet: Address, salary: u128, vault_id: u128) {
        let mut wallet_map: Map<Address, u128> = e
            .storage()
            .instance()
            .get(&WALLET_TO_ID)
            .unwrap_or(Map::new(&e));

        if wallet_map.contains_key(wallet.clone()) {
            panic!("Wallet already registered");
        }

        // Verify vault exists
        let vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));
        
        if !vaults.contains_key(vault_id) {
            panic!("Vault does not exist");
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
                wallet: wallet.clone(),
                rem_salary: salary,
                vault_id,
            },
        );
        wallet_map.set(wallet, emp_id);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
        e.storage().instance().set(&WALLET_TO_ID, &wallet_map);
        e.storage().instance().set(&EMP_COUNT, &emp_id);
    }

    pub fn deposit_to_vault(e: Env, from: Address, vault_id: u128, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(vault_id).unwrap();

        if !vault.is_active {
            panic!("Vault is not active");
        }

        let client = token::Client::new(&e, &vault.token_address);
        client.transfer(&from, &e.current_contract_address(), &amount);

        vault.total_deposited += amount;
        vaults.set(vault_id, vault);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    pub fn withdraw_from_vault(e: Env, admin: Address, vault_id: u128, to: Address, amount: i128) {
        admin.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(vault_id).unwrap();

        if vault.admin != admin {
            panic!("Only vault admin can withdraw");
        }

        let client = token::Client::new(&e, &vault.token_address);
        let balance = client.balance(&e.current_contract_address());

        if balance < amount {
            panic!("Insufficient vault balance");
        }

        client.transfer(&e.current_contract_address(), &to, &amount);

        vault.total_withdrawn += amount;
        vaults.set(vault_id, vault);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    pub fn request_advance(e: Env, emp_id: u128, amount: i128) {
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let mut emp = emp_map.get(emp_id).unwrap();
        emp.wallet.require_auth();

        if amount as u128 > emp.rem_salary {
            panic!("Requested amount exceeded remaining salary");
        }

        // Get vault info
        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(emp.vault_id).unwrap();

        if !vault.is_active {
            panic!("Vault is not active");
        }

        // Check if employee is allowed to access this vault
        if !vault.allowed_employees.contains(&emp_id) {
            panic!("Employee not authorized for this vault");
        }

        let fee = amount * 125 / 10000; // 1.25% fee
        let final_amount = amount - fee;

        let client = token::Client::new(&e, &vault.token_address);
        let balance = client.balance(&e.current_contract_address());

        if balance < final_amount {
            panic!("Insufficient vault balance");
        }

        client.transfer(&e.current_contract_address(), &emp.wallet, &final_amount);

        emp.rem_salary -= amount as u128;
        emp_map.set(emp_id, emp);

        vault.total_withdrawn += final_amount;
        vaults.set(emp.vault_id, vault);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    pub fn vault_balance(e: Env, vault_id: u128) -> i128 {
        let vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let vault = vaults.get(vault_id).unwrap();
        let client = token::Client::new(&e, &vault.token_address);
        client.balance(&e.current_contract_address())
    }

    pub fn get_vault_info(e: Env, vault_id: u128) -> VaultInfo {
        let vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        vaults.get(vault_id).unwrap()
    }

    pub fn get_vault_count(e: Env) -> u128 {
        e.storage().instance().get(&VAULT_COUNT).unwrap_or(0)
    }

    pub fn get_all_vaults(e: Env) -> Vec<VaultInfo> {
        let vault_count: u128 = e.storage().instance().get(&VAULT_COUNT).unwrap_or(0);
        let vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut result = Vec::new(&e);
        for i in 1..=vault_count {
            if let Some(vault) = vaults.get(i) {
                result.push_back(vault);
            }
        }
        result
    }

    pub fn get_emp_details(e: Env, emp_id: u128) -> EmployeeDetails {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        emp_map.get(emp_id).unwrap()
    }

    pub fn release_remaining_salary(e: Env, admin: Address, emp_id: u128, new_salary: u128) {
        admin.require_auth();

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let mut emp = emp_map.get(emp_id).unwrap();

        if emp.rem_salary == 0 {
            panic!("No remaining salary to release");
        }

        // Get vault info
        let mut vaults: Map<u128, VaultInfo> = e
            .storage()
            .instance()
            .get(&VAULTS)
            .unwrap_or(Map::new(&e));

        let mut vault = vaults.get(emp.vault_id).unwrap();

        if vault.admin != admin {
            panic!("Only vault admin can release salary");
        }

        if !vault.is_active {
            panic!("Vault is not active");
        }

        let client = token::Client::new(&e, &vault.token_address);
        let balance = client.balance(&e.current_contract_address());

        if balance < emp.rem_salary as i128 {
            panic!("Insufficient vault balance");
        }

        client.transfer(
            &e.current_contract_address(),
            &emp.wallet,
            &(emp.rem_salary as i128),
        );

        vault.total_withdrawn += emp.rem_salary as i128;
        vaults.set(emp.vault_id, vault);

        emp.rem_salary = new_salary;
        emp_map.set(emp_id, emp);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
        e.storage().instance().set(&VAULTS, &vaults);
    }

    pub fn get_remaining_salary(e: Env, emp_id: u128) -> u128 {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let emp = emp_map.get(emp_id).unwrap();

        emp.rem_salary
    }
}
