#!/bin/bash

# StellarPay - Early Wage Contract Deployment Script
# This script deploys the contract to Stellar testnet and initializes it

set -e  # Exit on error

echo "🚀 StellarPay Contract Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if stellar CLI is installed
if ! command -v stellar &> /dev/null; then
    echo -e "${RED}❌ Stellar CLI is not installed${NC}"
    echo "Install with: cargo install --locked stellar-cli --features opt"
    exit 1
fi

echo -e "${GREEN}✅ Stellar CLI found${NC}"
echo ""

# Set network to testnet
NETWORK="testnet"
echo "🌐 Network: $NETWORK"

# Check if identity exists, create if not
echo ""
echo "👤 Checking for admin identity..."
if ! stellar keys show admin 2>/dev/null; then
    echo -e "${YELLOW}⚠️  No 'admin' identity found. Creating one...${NC}"
    stellar keys generate admin --network $NETWORK
    ADMIN_ADDRESS=$(stellar keys address admin)
    echo -e "${GREEN}✅ Admin identity created: $ADMIN_ADDRESS${NC}"

    echo ""
    echo "💰 Funding admin account from friendbot..."
    curl "https://friendbot.stellar.org?addr=$ADMIN_ADDRESS" >/dev/null 2>&1
    echo -e "${GREEN}✅ Admin account funded${NC}"
else
    ADMIN_ADDRESS=$(stellar keys address admin)
    echo -e "${GREEN}✅ Using existing admin identity: $ADMIN_ADDRESS${NC}"
fi

# Check if employee test identity exists
echo ""
echo "👤 Checking for employee test identity..."
if ! stellar keys show employee 2>/dev/null; then
    echo -e "${YELLOW}⚠️  No 'employee' identity found. Creating one...${NC}"
    stellar keys generate employee --network $NETWORK
    EMPLOYEE_ADDRESS=$(stellar keys address employee)
    echo -e "${GREEN}✅ Employee identity created: $EMPLOYEE_ADDRESS${NC}"

    echo ""
    echo "💰 Funding employee account from friendbot..."
    curl "https://friendbot.stellar.org?addr=$EMPLOYEE_ADDRESS" >/dev/null 2>&1
    echo -e "${GREEN}✅ Employee account funded${NC}"
else
    EMPLOYEE_ADDRESS=$(stellar keys address employee)
    echo -e "${GREEN}✅ Using existing employee identity: $EMPLOYEE_ADDRESS${NC}"
fi

# Build contract
echo ""
echo "🔨 Building contract..."
cd /mnt/c/Users/CarlosIsraelJiménezJ/Documents/Stellar/StellarPay/early-wager-contract
stellar contract build 2>&1 | grep -E "(Compiling|Finished|Build)" || true
echo -e "${GREEN}✅ Contract built${NC}"

# Deploy Early Wage contract
echo ""
echo "📤 Deploying Early Wage contract..."
WAGE_CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/early_wage.wasm \
    --source admin \
    --network $NETWORK)

echo -e "${GREEN}✅ Early Wage Contract deployed${NC}"
echo "   Contract ID: $WAGE_CONTRACT_ID"

# Deploy Token contract (using native Stellar asset)
echo ""
echo "📤 Deploying Test Token..."
TOKEN_CONTRACT_ID=$(stellar contract asset deploy \
    --asset native \
    --source admin \
    --network $NETWORK)

echo -e "${GREEN}✅ Token deployed${NC}"
echo "   Token ID: $TOKEN_CONTRACT_ID"

# Initialize the Early Wage contract
echo ""
echo "⚙️  Initializing contract with admin..."
stellar contract invoke \
    --id $WAGE_CONTRACT_ID \
    --source admin \
    --network $NETWORK \
    -- \
    initialize \
    --admin $ADMIN_ADDRESS

echo -e "${GREEN}✅ Contract initialized${NC}"

# Save contract IDs to file
echo ""
echo "💾 Saving contract addresses..."
cat > contract-addresses.txt <<EOF
# StellarPay Contract Addresses (Testnet)
# Generated: $(date)

NETWORK=$NETWORK
ADMIN_ADDRESS=$ADMIN_ADDRESS
EMPLOYEE_ADDRESS=$EMPLOYEE_ADDRESS
WAGE_CONTRACT_ID=$WAGE_CONTRACT_ID
TOKEN_CONTRACT_ID=$TOKEN_CONTRACT_ID

# For .env file:
export CONTRACT_ADDRESS_WAGE="$WAGE_CONTRACT_ID"
export CONTRACT_ADDRESS_TOKEN="$TOKEN_CONTRACT_ID"
export ADMIN_PUBLIC_KEY="$ADMIN_ADDRESS"
EOF

echo -e "${GREEN}✅ Addresses saved to contract-addresses.txt${NC}"

echo ""
echo "=================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "📋 Summary:"
echo "  Network:         $NETWORK"
echo "  Admin:           $ADMIN_ADDRESS"
echo "  Employee (test): $EMPLOYEE_ADDRESS"
echo "  Wage Contract:   $WAGE_CONTRACT_ID"
echo "  Token Contract:  $TOKEN_CONTRACT_ID"
echo ""
echo "📝 Next steps:"
echo "  1. Update client/.env with contract addresses"
echo "  2. Test contract functions (see test-contract.sh)"
echo "  3. Start the frontend: cd client && npm run dev"
echo ""
