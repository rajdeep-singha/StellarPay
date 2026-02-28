#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, symbol_short, token, Address, Env, Map, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EarlyWageError {
    WalletAlreadyRegistered = 1,
    EmployeeNotFound = 2,
    InvalidAmount = 3,
    InsufficientSalary = 4,
    NoRemainingSalary = 5,
    InsufficientVaultBalance = 6,
    WithdrawLimitExceeded = 7,
    Unauthorized = 8,
}

#[contract]
pub struct EarlyWageContract;

const EMP_COUNT: Symbol = symbol_short!("EMP_COUNT");
const EMP_DETAILS: Symbol = symbol_short!("EMP_DET");
const WALLET_TO_ID: Symbol = symbol_short!("wal2id");
const ADMIN: Symbol = symbol_short!("ADMIN");
const MAX_WITHDRAW_PCT: Symbol = symbol_short!("MAX_WD_PC");
const TOTAL_DEPOSITED: Symbol = symbol_short!("TOT_DEP");
const TOTAL_WITHDRAWN: Symbol = symbol_short!("TOT_WD");

#[contracttype]
pub struct EmployeeDetails {
    pub emp_id: u128,
    pub wallet: Address,
    pub rem_salary: u128,
}

#[contracttype]
pub struct VaultStats {
    pub total_deposited: i128,
    pub total_withdrawn: i128,
    pub current_balance: i128,
    pub max_withdraw_percentage: u32,
}

fn distribute_for_demo(e: &Env, sender: Address, add1: Address, add2: Address, token: Address) {
    sender.require_auth();
    let token = token::TokenClient::new(e, &token);

    token.transfer_from(&sender, &sender, &add1, &1000);
    token.transfer_from(&sender, &sender, &add2, &1000);
}

#[contractimpl]
impl EarlyWageContract {
    /// Initialize the contract with an admin and default settings
    /// Default max withdraw percentage: 80% (employees can withdraw up to 80% of salary)
    pub fn initialize(e: Env, admin: Address) {
        admin.require_auth();

        e.storage().instance().set(&ADMIN, &admin);
        e.storage().instance().set(&MAX_WITHDRAW_PCT, &80u32);
        e.storage().instance().set(&TOTAL_DEPOSITED, &0i128);
        e.storage().instance().set(&TOTAL_WITHDRAWN, &0i128);
    }

    /// Update maximum withdrawal percentage (admin only)
    pub fn set_max_withdraw_pct(e: Env, percentage: u32) -> Result<(), EarlyWageError> {
        if percentage > 100 {
            return Err(EarlyWageError::InvalidAmount);
        }

        let admin: Address = e.storage().instance().get(&ADMIN).ok_or(EarlyWageError::Unauthorized)?;
        admin.require_auth();

        e.storage().instance().set(&MAX_WITHDRAW_PCT, &percentage);
        Ok(())
    }

    /// Get comprehensive vault statistics
    pub fn get_vault_stats(e: Env, token: Address) -> VaultStats {
        let token_client = token::TokenClient::new(&e, &token);
        let current_balance = token_client.balance(&e.current_contract_address());

        let total_deposited: i128 = e.storage().instance().get(&TOTAL_DEPOSITED).unwrap_or(0);
        let total_withdrawn: i128 = e.storage().instance().get(&TOTAL_WITHDRAWN).unwrap_or(0);
        let max_withdraw_percentage: u32 = e.storage().instance().get(&MAX_WITHDRAW_PCT).unwrap_or(80);

        VaultStats {
            total_deposited,
            total_withdrawn,
            current_balance,
            max_withdraw_percentage,
        }
    }

    pub fn register_employee(e: Env, wallet: Address, salary: u128) -> Result<u128, EarlyWageError> {
        let mut wallet_map: Map<Address, u128> = e
            .storage()
            .instance()
            .get(&WALLET_TO_ID)
            .unwrap_or(Map::new(&e));

        if wallet_map.contains_key(wallet.clone()) {
            return Err(EarlyWageError::WalletAlreadyRegistered);
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
            },
        );
        wallet_map.set(wallet, emp_id);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);
        e.storage().instance().set(&WALLET_TO_ID, &wallet_map);
        e.storage().instance().set(&EMP_COUNT, &emp_id);

        Ok(emp_id)
    }

    pub fn deposit_to_vault(e: Env, from: Address, amount: i128, token: Address) -> Result<(), EarlyWageError> {
        from.require_auth();

        if amount <= 0 {
            return Err(EarlyWageError::InvalidAmount);
        }

        let client = token::Client::new(&e, &token);
        client.transfer(&from, &e.current_contract_address(), &amount);

        // Track total deposited
        let total_deposited: i128 = e.storage().instance().get(&TOTAL_DEPOSITED).unwrap_or(0);
        e.storage().instance().set(&TOTAL_DEPOSITED, &(total_deposited + amount));

        Ok(())
    }

    pub fn request_advance(e: &Env, emp_id: u128, amount: i128, token: Address) -> Result<(), EarlyWageError> {
        if amount <= 0 {
            return Err(EarlyWageError::InvalidAmount);
        }

        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(e));

        let mut emp = emp_map
            .get(emp_id)
            .ok_or(EarlyWageError::EmployeeNotFound)?;

        if amount as u128 >= emp.rem_salary {
            return Err(EarlyWageError::InsufficientSalary);
        }

        // Check withdraw limit (default 80% of original salary)
        let max_withdraw_pct: u32 = e.storage().instance().get(&MAX_WITHDRAW_PCT).unwrap_or(80);
        let original_salary = emp.rem_salary + (amount as u128); // Current + what they're withdrawing
        let max_allowed = (original_salary * max_withdraw_pct as u128) / 100;

        if (amount as u128) > max_allowed {
            return Err(EarlyWageError::WithdrawLimitExceeded);
        }

        let fee = amount * 125 / 10000;
        let final_amount = amount - fee;

        let client = token::Client::new(e, &token);

        // Check vault has sufficient balance
        let vault_balance = client.balance(&e.current_contract_address());
        if vault_balance < final_amount {
            return Err(EarlyWageError::InsufficientVaultBalance);
        }

        client.transfer(&e.current_contract_address(), &emp.wallet, &final_amount);

        // Track total withdrawn
        let total_withdrawn: i128 = e.storage().instance().get(&TOTAL_WITHDRAWN).unwrap_or(0);
        e.storage().instance().set(&TOTAL_WITHDRAWN, &(total_withdrawn + final_amount));

        emp.rem_salary -= amount as u128;
        emp_map.set(emp_id, emp);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);

        Ok(())
    }

    pub fn vault_balance(e: Env, token: Address) -> i128 {
        let client = token::Client::new(&e, &token);
        client.balance(&e.current_contract_address())
    }

    pub fn get_emp_details(e: Env, emp_id: u128) -> Result<EmployeeDetails, EarlyWageError> {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));
        emp_map
            .get(emp_id)
            .ok_or(EarlyWageError::EmployeeNotFound)
    }

    pub fn release_remaining_salary(e: Env, emp_id: u128, token: Address, salary: u128) -> Result<(), EarlyWageError> {
        let mut emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let mut emp = emp_map
            .get(emp_id)
            .ok_or(EarlyWageError::EmployeeNotFound)?;

        if emp.rem_salary == 0 {
            return Err(EarlyWageError::NoRemainingSalary);
        }

        let client = token::Client::new(&e, &token);
        let amount_to_transfer = emp.rem_salary as i128;

        // Check vault has sufficient balance
        let vault_balance = client.balance(&e.current_contract_address());
        if vault_balance < amount_to_transfer {
            return Err(EarlyWageError::InsufficientVaultBalance);
        }

        client.transfer(
            &e.current_contract_address(),
            &emp.wallet,
            &amount_to_transfer,
        );

        // Track total withdrawn
        let total_withdrawn: i128 = e.storage().instance().get(&TOTAL_WITHDRAWN).unwrap_or(0);
        e.storage().instance().set(&TOTAL_WITHDRAWN, &(total_withdrawn + amount_to_transfer));

        emp.rem_salary = salary;
        emp_map.set(emp_id, emp);

        e.storage().instance().set(&EMP_DETAILS, &emp_map);

        Ok(())
    }

    pub fn get_remaining_salary(e: Env, emp_id: u128) -> Result<u128, EarlyWageError> {
        let emp_map: Map<u128, EmployeeDetails> = e
            .storage()
            .instance()
            .get(&EMP_DETAILS)
            .unwrap_or(Map::new(&e));

        let emp = emp_map
            .get(emp_id)
            .ok_or(EarlyWageError::EmployeeNotFound)?;

        Ok(emp.rem_salary)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token,
        Address, Env,
    };

    fn create_token<'a>(e: &Env, admin: &Address) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
        let contract_id = e.register_stellar_asset_contract_v2(admin.clone());
        let token_client = token::Client::new(e, &contract_id.address());
        let token_admin = token::StellarAssetClient::new(e, &contract_id.address());
        (token_client, token_admin)
    }

    fn create_wage_contract<'a>(e: &Env) -> EarlyWageContractClient<'a> {
        EarlyWageContractClient::new(e, &e.register(EarlyWageContract, ()))
    }

    #[test]
    fn test_register_employee() {
        let e = Env::default();
        e.mock_all_auths();

        let contract = create_wage_contract(&e);
        let employee = Address::generate(&e);
        let salary: u128 = 5000;

        let emp_id = contract.register_employee(&employee, &salary);
        assert_eq!(emp_id, 1);

        let details = contract.get_emp_details(&emp_id);
        assert_eq!(details.emp_id, 1);
        assert_eq!(details.wallet, employee);
        assert_eq!(details.rem_salary, salary);
    }

    #[test]
    fn test_register_multiple_employees() {
        let e = Env::default();
        e.mock_all_auths();

        let contract = create_wage_contract(&e);
        let employee1 = Address::generate(&e);
        let employee2 = Address::generate(&e);
        let employee3 = Address::generate(&e);

        let emp_id1 = contract.register_employee(&employee1, &5000);
        let emp_id2 = contract.register_employee(&employee2, &6000);
        let emp_id3 = contract.register_employee(&employee3, &7000);

        assert_eq!(emp_id1, 1);
        assert_eq!(emp_id2, 2);
        assert_eq!(emp_id3, 3);

        let details1 = contract.get_emp_details(&emp_id1);
        assert_eq!(details1.rem_salary, 5000);

        let details2 = contract.get_emp_details(&emp_id2);
        assert_eq!(details2.rem_salary, 6000);

        let details3 = contract.get_emp_details(&emp_id3);
        assert_eq!(details3.rem_salary, 7000);
    }

    #[test]
    #[should_panic]
    fn test_register_duplicate_wallet() {
        let e = Env::default();
        e.mock_all_auths();

        let contract = create_wage_contract(&e);
        let employee = Address::generate(&e);

        contract.register_employee(&employee, &5000);
        contract.register_employee(&employee, &6000);
    }

    #[test]
    fn test_deposit_to_vault() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let depositor = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        token_admin.mint(&depositor, &10000);
        assert_eq!(token.balance(&depositor), 10000);

        contract.deposit_to_vault(&depositor, &5000, &token.address);

        assert_eq!(token.balance(&depositor), 5000);
        assert_eq!(contract.vault_balance(&token.address), 5000);
    }

    #[test]
    fn test_request_advance() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let employer = Address::generate(&e);
        let employee = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        let emp_id = contract.register_employee(&employee, &10000);

        token_admin.mint(&employer, &20000);
        contract.deposit_to_vault(&employer, &20000, &token.address);

        contract.request_advance(&emp_id, &4000, &token.address);

        let fee = 4000 * 125 / 10000;
        let expected_amount = 4000 - fee;
        assert_eq!(token.balance(&employee), expected_amount);

        let remaining = contract.get_remaining_salary(&emp_id);
        assert_eq!(remaining, 6000);
    }

    #[test]
    fn test_request_advance_fee_calculation() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let employer = Address::generate(&e);
        let employee = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        let emp_id = contract.register_employee(&employee, &10000);

        token_admin.mint(&employer, &20000);
        contract.deposit_to_vault(&employer, &20000, &token.address);

        contract.request_advance(&emp_id, &8000, &token.address);

        let fee = 8000 * 125 / 10000;
        assert_eq!(fee, 100);

        let expected_employee_balance = 8000 - 100;
        assert_eq!(token.balance(&employee), expected_employee_balance);

        let remaining = contract.get_remaining_salary(&emp_id);
        assert_eq!(remaining, 2000);
    }

    #[test]
    #[should_panic]
    fn test_request_advance_zero_amount() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let (token, _) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);
        let employee = Address::generate(&e);

        let emp_id = contract.register_employee(&employee, &10000);

        contract.request_advance(&emp_id, &0, &token.address);
    }

    #[test]
    #[should_panic]
    fn test_request_advance_negative_amount() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let (token, _) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);
        let employee = Address::generate(&e);

        let emp_id = contract.register_employee(&employee, &10000);

        contract.request_advance(&emp_id, &-100, &token.address);
    }

    #[test]
    #[should_panic]
    fn test_request_advance_exceeds_salary() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let employer = Address::generate(&e);
        let employee = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        let emp_id = contract.register_employee(&employee, &5000);

        token_admin.mint(&employer, &20000);
        contract.deposit_to_vault(&employer, &20000, &token.address);

        contract.request_advance(&emp_id, &6000, &token.address);
    }

    #[test]
    #[should_panic]
    fn test_request_advance_nonexistent_employee() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let (token, _) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        contract.request_advance(&999, &1000, &token.address);
    }

    #[test]
    fn test_release_remaining_salary() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let employer = Address::generate(&e);
        let employee = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        let emp_id = contract.register_employee(&employee, &10000);

        token_admin.mint(&employer, &20000);
        contract.deposit_to_vault(&employer, &20000, &token.address);

        contract.request_advance(&emp_id, &4000, &token.address);

        let remaining_before = contract.get_remaining_salary(&emp_id);
        assert_eq!(remaining_before, 6000);

        contract.release_remaining_salary(&emp_id, &token.address, &8000);

        let remaining_after = contract.get_remaining_salary(&emp_id);
        assert_eq!(remaining_after, 8000);

        let fee = 4000 * 125 / 10000;
        let expected_balance = (4000 - fee) + 6000;
        assert_eq!(token.balance(&employee), expected_balance);
    }

    #[test]
    #[should_panic]
    fn test_release_salary_with_zero_remaining() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let employer = Address::generate(&e);
        let employee = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        let emp_id = contract.register_employee(&employee, &10000);

        token_admin.mint(&employer, &20000);
        contract.deposit_to_vault(&employer, &20000, &token.address);

        contract.request_advance(&emp_id, &9999, &token.address);
        contract.release_remaining_salary(&emp_id, &token.address, &0);
        contract.release_remaining_salary(&emp_id, &token.address, &5000);
    }

    #[test]
    #[should_panic]
    fn test_get_details_nonexistent_employee() {
        let e = Env::default();
        let contract = create_wage_contract(&e);

        contract.get_emp_details(&999);
    }

    #[test]
    #[should_panic]
    fn test_get_remaining_salary_nonexistent_employee() {
        let e = Env::default();
        let contract = create_wage_contract(&e);

        contract.get_remaining_salary(&999);
    }

    #[test]
    fn test_vault_balance() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let depositor1 = Address::generate(&e);
        let depositor2 = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        assert_eq!(contract.vault_balance(&token.address), 0);

        token_admin.mint(&depositor1, &5000);
        token_admin.mint(&depositor2, &3000);

        contract.deposit_to_vault(&depositor1, &5000, &token.address);
        assert_eq!(contract.vault_balance(&token.address), 5000);

        contract.deposit_to_vault(&depositor2, &3000, &token.address);
        assert_eq!(contract.vault_balance(&token.address), 8000);
    }

    #[test]
    fn test_complete_workflow() {
        let e = Env::default();
        e.mock_all_auths();

        let admin = Address::generate(&e);
        let employer = Address::generate(&e);
        let employee1 = Address::generate(&e);
        let employee2 = Address::generate(&e);
        let (token, token_admin) = create_token(&e, &admin);
        let contract = create_wage_contract(&e);

        let emp_id1 = contract.register_employee(&employee1, &10000);
        let emp_id2 = contract.register_employee(&employee2, &15000);

        token_admin.mint(&employer, &50000);
        contract.deposit_to_vault(&employer, &50000, &token.address);

        contract.request_advance(&emp_id1, &4000, &token.address);
        contract.request_advance(&emp_id2, &6000, &token.address);

        let remaining1 = contract.get_remaining_salary(&emp_id1);
        let remaining2 = contract.get_remaining_salary(&emp_id2);
        assert_eq!(remaining1, 6000);
        assert_eq!(remaining2, 9000);

        contract.release_remaining_salary(&emp_id1, &token.address, &10000);

        let new_remaining1 = contract.get_remaining_salary(&emp_id1);
        assert_eq!(new_remaining1, 10000);
    }
}
