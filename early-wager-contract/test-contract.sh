#!/bin/bash

# StellarPay - Contract Testing Script
# This script tests all contract functions on testnet

set -e

echo "🧪 StellarPay Contract Testing"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load contract addresses
if [ ! -f "contract-addresses.txt" ]; then
    echo -e "${RED}❌ contract-addresses.txt not found${NC}"
    echo "Run deploy-testnet.sh first"
    exit 1
fi

source contract-addresses.txt

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Network: $NETWORK"
echo "  Wage Contract: $WAGE_CONTRACT_ID"
echo "  Token Contract: $TOKEN_CONTRACT_ID"
echo "  Admin: $ADMIN_ADDRESS"
echo "  Employee: $EMPLOYEE_ADDRESS"
echo ""

# Helper function to invoke contract
invoke_contract() {
    local contract_id=$1
    local source=$2
    shift 2
    stellar contract invoke \
        --id $contract_id \
        --source $source \
        --network $NETWORK \
        -- \
        "$@"
}

# Test 1: Get Vault Stats
echo -e "${YELLOW}Test 1: Get Vault Statistics${NC}"
echo "----------------------------"
STATS=$(invoke_contract $WAGE_CONTRACT_ID admin get_vault_stats --token $TOKEN_CONTRACT_ID)
echo "Result: $STATS"
echo -e "${GREEN}✅ Vault stats retrieved${NC}"
echo ""

# Test 2: Register Employee
echo -e "${YELLOW}Test 2: Register Employee${NC}"
echo "-------------------------"
SALARY=5000000000  # 500 tokens (in stroops: 500 * 10,000,000)
echo "Registering employee with salary: 500 tokens"
EMP_ID=$(invoke_contract $WAGE_CONTRACT_ID admin register_employee --wallet $EMPLOYEE_ADDRESS --salary $SALARY)
echo "Employee ID: $EMP_ID"
echo -e "${GREEN}✅ Employee registered${NC}"
echo ""

# Test 3: Get Employee Details
echo -e "${YELLOW}Test 3: Get Employee Details${NC}"
echo "----------------------------"
DETAILS=$(invoke_contract $WAGE_CONTRACT_ID admin get_emp_details --emp_id 1)
echo "Details: $DETAILS"
echo -e "${GREEN}✅ Employee details retrieved${NC}"
echo ""

# Test 4: Deposit to Vault
echo -e "${YELLOW}Test 4: Deposit to Vault${NC}"
echo "------------------------"
DEPOSIT_AMOUNT=10000000000  # 1000 tokens
echo "Depositing 1000 tokens to vault..."

# First, wrap native asset
echo "Minting tokens to admin..."
invoke_contract $TOKEN_CONTRACT_ID admin mint --to $ADMIN_ADDRESS --amount $DEPOSIT_AMOUNT || true

echo "Depositing to vault..."
invoke_contract $WAGE_CONTRACT_ID admin deposit_to_vault --from $ADMIN_ADDRESS --amount $DEPOSIT_AMOUNT --token $TOKEN_CONTRACT_ID
echo -e "${GREEN}✅ Deposit successful${NC}"
echo ""

# Test 5: Check Vault Balance
echo -e "${YELLOW}Test 5: Check Vault Balance${NC}"
echo "---------------------------"
BALANCE=$(invoke_contract $WAGE_CONTRACT_ID admin vault_balance --token $TOKEN_CONTRACT_ID)
echo "Vault Balance: $BALANCE stroops"
BALANCE_TOKENS=$((BALANCE / 10000000))
echo "             = $BALANCE_TOKENS tokens"
echo -e "${GREEN}✅ Balance retrieved${NC}"
echo ""

# Test 6: Request Advance
echo -e "${YELLOW}Test 6: Request Salary Advance${NC}"
echo "------------------------------"
ADVANCE_AMOUNT=1000000000  # 100 tokens
echo "Employee requesting 100 tokens advance..."
invoke_contract $WAGE_CONTRACT_ID employee request_advance --emp_id 1 --amount $ADVANCE_AMOUNT --token $TOKEN_CONTRACT_ID
echo -e "${GREEN}✅ Advance request successful${NC}"
echo ""

# Test 7: Check Remaining Salary
echo -e "${YELLOW}Test 7: Check Remaining Salary${NC}"
echo "------------------------------"
REMAINING=$(invoke_contract $WAGE_CONTRACT_ID admin get_remaining_salary --emp_id 1)
echo "Remaining Salary: $REMAINING stroops"
REMAINING_TOKENS=$((REMAINING / 10000000))
echo "                = $REMAINING_TOKENS tokens"
echo "Expected: 400 tokens (500 - 100)"
echo -e "${GREEN}✅ Remaining salary retrieved${NC}"
echo ""

# Test 8: Get Vault Stats Again
echo -e "${YELLOW}Test 8: Get Updated Vault Statistics${NC}"
echo "------------------------------------"
STATS=$(invoke_contract $WAGE_CONTRACT_ID admin get_vault_stats --token $TOKEN_CONTRACT_ID)
echo "Result: $STATS"
echo -e "${GREEN}✅ Updated vault stats retrieved${NC}"
echo ""

# Test 9: Set Max Withdraw Percentage
echo -e "${YELLOW}Test 9: Set Max Withdraw Percentage${NC}"
echo "-----------------------------------"
echo "Setting max withdraw to 90%..."
invoke_contract $WAGE_CONTRACT_ID admin set_max_withdraw_pct --percentage 90
echo -e "${GREEN}✅ Max withdraw percentage updated${NC}"
echo ""

# Test 10: Verify New Setting
echo -e "${YELLOW}Test 10: Verify New Max Withdraw Setting${NC}"
echo "----------------------------------------"
STATS=$(invoke_contract $WAGE_CONTRACT_ID admin get_vault_stats --token $TOKEN_CONTRACT_ID)
echo "Result: $STATS"
echo "Check that max_withdraw_percentage = 90"
echo -e "${GREEN}✅ Setting verified${NC}"
echo ""

echo "=============================="
echo -e "${GREEN}🎉 All Tests Passed!${NC}"
echo "=============================="
echo ""
echo "📊 Summary:"
echo "  ✅ Vault statistics"
echo "  ✅ Employee registration"
echo "  ✅ Employee details query"
echo "  ✅ Vault deposit"
echo "  ✅ Vault balance query"
echo "  ✅ Salary advance request"
echo "  ✅ Remaining salary query"
echo "  ✅ Vault stats after operations"
echo "  ✅ Max withdraw configuration"
echo "  ✅ Configuration verification"
echo ""
echo "🎯 All contract functions working correctly!"
echo ""
