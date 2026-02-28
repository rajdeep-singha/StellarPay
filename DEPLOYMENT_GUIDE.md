# StellarPay Deployment Guide

Complete guide for deploying and testing the StellarPay Early Wage Access contract.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Deployment](#detailed-deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

1. **Rust** (1.70+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Stellar CLI**
   ```bash
   cargo install stellar-cli
   ```

3. **Node.js** (18+) - for frontend
   ```bash
   # Install from https://nodejs.org
   ```

4. **Go** (1.24+) - for backend
   ```bash
   # Download from https://go.dev/dl
   ```

### Verify Installation

```bash
# Check Rust
rustc --version

# Check Stellar CLI
stellar --version

# Check Node.js
node --version
npm --version

# Check Go
go version
```

## Quick Start

### 1. Build Contract

```bash
cd early-wager-contract
cargo build --release --target wasm32-unknown-unknown --package early-wage
```

### 2. Run Tests

```bash
cargo test --package early-wage
# Should show: 16 passed, 0 failed ✅
```

### 3. Deploy to Testnet

```bash
chmod +x deploy-testnet.sh
./deploy-testnet.sh
```

This script will:
- ✅ Create admin and employee identities
- ✅ Fund accounts from friendbot
- ✅ Deploy Early Wage contract
- ✅ Deploy Token contract
- ✅ Initialize contracts
- ✅ Save addresses to `contract-addresses.txt`

### 4. Test Contract Functions

```bash
chmod +x test-contract.sh
./test-contract.sh
```

This will test all 10 contract functions:
1. Get vault statistics
2. Register employee
3. Get employee details
4. Deposit to vault
5. Check vault balance
6. Request salary advance
7. Check remaining salary
8. Get updated vault stats
9. Set max withdraw percentage
10. Verify new settings

### 5. Update Frontend

```bash
# Copy contract addresses to frontend .env
cd ../client
cp ../ early-wager-contract/contract-addresses.txt .

# Create .env file
cat > .env <<EOF
VITE_CONTRACT_ADDRESS_WAGE="<WAGE_CONTRACT_ID from contract-addresses.txt>"
VITE_CONTRACT_ADDRESS_TOKEN="<TOKEN_CONTRACT_ID from contract-addresses.txt>"
VITE_RPC_URL="https://soroban-testnet.stellar.org"
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
EOF

# Install dependencies and start
npm install
npm run dev
```

## Detailed Deployment

### Step 1: Create Stellar Identities

```bash
# Admin identity (contract owner)
stellar keys generate admin --network testnet
stellar keys address admin

# Employee identity (for testing)
stellar keys generate employee --network testnet
stellar keys address employee
```

### Step 2: Fund Accounts

```bash
# Fund admin
curl "https://friendbot.stellar.org?addr=<ADMIN_ADDRESS>"

# Fund employee
curl "https://friendbot.stellar.org?addr=<EMPLOYEE_ADDRESS>"
```

### Step 3: Build Contract

```bash
cd early-wager-contract
cargo build --release --target wasm32-unknown-unknown --package early-wage
```

The WASM file will be at:
```
target/wasm32-unknown-unknown/release/early_wage.wasm
```

### Step 4: Deploy Contracts

#### Deploy Early Wage Contract

```bash
WAGE_CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/early_wage.wasm \
    --source admin \
    --network testnet)

echo "Wage Contract ID: $WAGE_CONTRACT_ID"
```

#### Deploy Token Contract

```bash
TOKEN_CONTRACT_ID=$(stellar contract asset deploy \
    --asset native \
    --source admin \
    --network testnet)

echo "Token Contract ID: $TOKEN_CONTRACT_ID"
```

### Step 5: Initialize Contract

```bash
ADMIN_ADDRESS=$(stellar keys address admin)

stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source admin \
    --network testnet \
    -- \
    initialize \
    --admin $ADMIN_ADDRESS
```

### Step 6: Verify Deployment

```bash
# Check vault stats
stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source admin \
    --network testnet \
    -- \
    get_vault_stats \
    --token $TOKEN_CONTRACT_ID
```

Expected output:
```json
{
  "current_balance": 0,
  "max_withdraw_percentage": 80,
  "total_deposited": 0,
  "total_withdrawn": 0
}
```

## Testing

### Manual Contract Testing

#### 1. Register Employee

```bash
stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source admin \
    --network testnet \
    -- \
    register_employee \
    --wallet $(stellar keys address employee) \
    --salary 5000000000

# Returns employee ID (should be 1)
```

#### 2. Deposit to Vault

```bash
# First mint tokens to admin
stellar contract invoke \
    --id $TOKEN_CONTRACT_ID \
    --source admin \
    --network testnet \
    -- \
    mint \
    --to $(stellar keys address admin) \
    --amount 10000000000

# Then deposit to vault
stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source admin \
    --network testnet \
    -- \
    deposit_to_vault \
    --from $(stellar keys address admin) \
    --amount 10000000000 \
    --token $TOKEN_CONTRACT_ID
```

#### 3. Request Advance

```bash
stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source employee \
    --network testnet \
    -- \
    request_advance \
    --emp_id 1 \
    --amount 1000000000 \
    --token $TOKEN_CONTRACT_ID

# Employee receives 98.75 tokens (1.25% fee)
```

#### 4. Check Remaining Salary

```bash
stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source admin \
    --network testnet \
    -- \
    get_remaining_salary \
    --emp_id 1

# Should return 4000000000 (400 tokens)
```

### Automated Testing

Use the provided test script:

```bash
./test-contract.sh
```

This runs all 10 test cases automatically.

### Unit Tests

```bash
cargo test --package early-wage
```

All 16 tests should pass:
- ✅ test_register_employee
- ✅ test_register_multiple_employees
- ✅ test_register_duplicate_wallet
- ✅ test_deposit_to_vault
- ✅ test_request_advance
- ✅ test_request_advance_with_high_fee
- ✅ test_request_advance_zero_amount
- ✅ test_request_advance_negative_amount
- ✅ test_request_advance_exceeds_salary
- ✅ test_request_advance_nonexistent_employee
- ✅ test_release_remaining_salary
- ✅ test_release_salary_with_zero_remaining
- ✅ test_get_details_nonexistent_employee
- ✅ test_get_remaining_salary_nonexistent_employee
- ✅ test_vault_balance
- ✅ test_multiple_employees_and_operations

## Troubleshooting

### Stellar CLI Not Found

```bash
# Add cargo bin to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Verify
stellar --version
```

### Contract Deployment Fails

```bash
# Check account balance
stellar keys address admin
curl "https://horizon-testnet.stellar.org/accounts/<ADMIN_ADDRESS>"

# Fund again if needed
curl "https://friendbot.stellar.org?addr=<ADMIN_ADDRESS>"
```

### Transaction Fails

Common issues:
1. **Insufficient balance**: Fund account from friendbot
2. **Invalid signature**: Ensure correct `--source` identity
3. **Contract not initialized**: Run `initialize` function first
4. **Wrong network**: Verify `--network testnet`

### Build Errors

```bash
# Update Rust
rustup update

# Clean and rebuild
cargo clean
cargo build --release --target wasm32-unknown-unknown --package early-wage
```

### Test Failures

```bash
# Run tests with output
cargo test --package early-wage -- --nocapture

# Run specific test
cargo test --package early-wage test_request_advance
```

## Production Deployment (Mainnet)

⚠️ **WARNING**: Do not deploy to mainnet without:

1. ✅ Complete security audit
2. ✅ Penetration testing
3. ✅ Multi-signature setup for admin
4. ✅ Emergency pause mechanism
5. ✅ Insurance fund
6. ✅ Legal compliance review

### Mainnet Deployment Steps

1. Change network to `mainnet`:
   ```bash
   --network mainnet
   ```

2. Use hardware wallet for admin:
   ```bash
   # Use Ledger or other hardware wallet
   ```

3. Set up multi-signature:
   ```bash
   # Configure multiple signers for admin operations
   ```

4. Implement monitoring:
   ```bash
   # Set up alerts for unusual activity
   ```

5. Deploy gradually:
   - Start with small amounts
   - Limit number of employees
   - Monitor closely for 30 days

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org)
- [Soroban Docs](https://soroban.stellar.org)
- [Stellar CLI Reference](https://developers.stellar.org/docs/tools/developer-tools/cli)
- [StellarPay Repository](https://github.com/your-org/StellarPay)

## Support

- **Issues**: https://github.com/your-org/StellarPay/issues
- **Discussions**: https://github.com/your-org/StellarPay/discussions
- **Security**: security@stellarpay.dev

---

Last Updated: February 2026
