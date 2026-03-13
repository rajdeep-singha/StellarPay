import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  scValToNative,
  Networks,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import { signTransaction } from "@stellar/freighter-api";

/**
 * StellarPay Soroban Service
 *
 * This service provides functions for interacting with StellarPay's Soroban smart contracts
 * on the Stellar testnet. It handles employee registration, salary advances, vault management,
 * and token operations.
 *
 * @module sorobanService
 */

// Contract addresses - Update these with your deployed contract addresses
const CONTRACT_ADDRESS_TOKEN = "CDHRNIGP6FT4NVRRGIDSAAOKUQMQYAS7LX6BWLX65SEAWJAGTF6YVZ7N";// old one CDB5EWYMHLVBUCF34JKI6V53DLV6IKZPABNTPGXRR7L5XUVDBKE2ZSA3

const CONTRACT_ADDRESS_WAGE = "CDCLWMLTRGRKLVIGMZTBIRRXF2KEH5UAQBSMCL3RDGTSZRV7PDVY2O5C";//CAHEHF7DFQKQBBG6SRQF6U3P6WWDIIP6UAZXEPZAXMXYYYLIS7L7MJTN old contract address

const RPC_URL = "https://soroban-testnet.stellar.org";

if (!CONTRACT_ADDRESS_TOKEN || !CONTRACT_ADDRESS_WAGE) {
  console.warn("⚠️ Contract addresses not set in .env — soroban calls will fail.");
}

// ============================================
// SUPPORTED TOKENS (Stellar Testnet)
// ============================================
export const SUPPORTED_TOKENS = [
  {
    symbol: "XLM",
    name: "Stellar Lumens",
    address: "native",
    decimals: 7,
    icon: "⭐",
    isNative: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    decimals: 7,
    icon: "💵",
    isNative: false,
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    address: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP",
    decimals: 7,
    icon: "💶",
    isNative: false,
  },
];

// Fetch live exchange rates relative to USD
export async function fetchExchangeRates() {
  try {
    // Fallback mock rates — replace with real price feed in production
    return {
      XLM: 0.11,
      USDC: 1.0,
      EURC: 1.08,
    };
  } catch {
    return { XLM: 0.11, USDC: 1.0, EURC: 1.08 };
  }
}

// Initialize Soroban RPC client
const server = new rpc.Server(RPC_URL);

// ============================================
// HELPER FUNCTIONS - TYPE CONVERSIONS
// ============================================

/**
 * Converts a Stellar address string to a Soroban ScVal
 * @param {string} account - Stellar public key (G... address)
 * @returns {ScVal} Soroban-compatible address value
 * @example
 * const scVal = addressToScVal("GBXX...XXXX");
 */
export const addressToScVal = (account) => {
  return new Address(account).toScVal();
};

/**
 * Converts a JavaScript string to a Soroban ScVal
 * @param {string} str - String to convert
 * @returns {ScVal} Soroban-compatible string value
 * @example
 * const scVal = stringToScVal("Hello Stellar");
 */
export const stringToScVal = (str) => {
  return nativeToScVal(str);
};

/**
 * Converts a JavaScript number to a Soroban u128 (unsigned 128-bit integer)
 * Used for: employee IDs, salary amounts, token amounts
 * @param {number} num - Number to convert
 * @returns {ScVal} Soroban u128 value
 * @example
 * const salary = numberToU128(50000); // 50,000 tokens
 */
export const numberToU128 = (num) => {
  return nativeToScVal(num, { type: "u128" });
};

/**
 * Converts a JavaScript number to a Soroban i128 (signed 128-bit integer)
 * Used for: token transfer amounts, vault deposits/withdrawals
 * @param {number} num - Number to convert
 * @returns {ScVal} Soroban i128 value
 * @example
 * const amount = numberToI128(10000); // Transfer 10,000 tokens
 */
export const numberToI128 = (num) => {
  return nativeToScVal(num, { type: "i128" });
};

// ============================================
// TRANSACTION BUILDING HELPERS
// ============================================

/**
 * Gets transaction parameters for Stellar testnet
 * @private
 * @param {string} publicKey - Stellar public key
 * @returns {Object} Transaction parameters
 */
const getTransactionParams = (publicKey) => ({
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
});

/**
 * Builds and prepares a Soroban smart contract function call
 *
 * This internal helper:
 * 1. Fetches the caller's account from the network
 * 2. Creates a contract operation
 * 3. Builds a transaction
 * 4. Simulates and prepares it for signing
 *
 * @private
 * @async
 * @param {string} publicKey - Caller's Stellar public key
 * @param {string} contractId - Contract address to call
 * @param {string} functionName - Smart contract function name
 * @param {Array<ScVal>} args - Function arguments as ScVal array
 * @returns {Promise<Transaction>} Prepared transaction ready for signing
 * @throws {Error} If account fetch or transaction preparation fails
 */
async function buildContractCall(publicKey, contractId, functionName, args = []) {
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);
  const operation = contract.call(functionName, ...args);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  return server.prepareTransaction(transaction);
}

/**
 * Signs a prepared transaction using Freighter wallet
 *
 * Prompts the user to approve and sign the transaction in their Freighter browser extension.
 *
 * @private
 * @async
 * @param {Transaction} preparedTx - Prepared transaction from buildContractCall
 * @returns {Promise<Transaction>} Signed transaction ready for submission
 * @throws {Error} If Freighter is not installed or user rejects signing
 */
async function signWithFreighter(preparedTx) {
  if (!window.freighterApi) throw new Error("Freighter wallet not found");

  const txXdr = preparedTx.toXDR();
  const signedResponse = await signTransaction(txXdr, {
    network: "TESTNET",
    networkPassphrase: Networks.TESTNET,
  });

  if (!signedResponse) {
    throw new Error("Transaction signature was rejected or failed.");
  }

  // The NPM package might return an object { signedTxXdr: "..." } or a raw string
  const finalXdr = typeof signedResponse === 'object' ? signedResponse.signedTxXdr || signedResponse.txXdr : signedResponse;

  if (!finalXdr || typeof finalXdr !== 'string') {
    throw new Error("Invalid response format from Freighter SDK: Missing XDR string.");
  }

  return TransactionBuilder.fromXDR(finalXdr, Networks.TESTNET);
}

/**
 * Submits a signed transaction to the Stellar network and waits for confirmation
 *
 * Process:
 * 1. Sends transaction to RPC server
 * 2. Polls for transaction status every 1 second
 * 3. Returns result when status is SUCCESS or throws on ERROR
 *
 * @private
 * @async
 * @param {Transaction} signedTx - Signed transaction from signWithFreighter
 * @returns {Promise<Object>} Transaction result
 * @returns {boolean} result.success - Whether transaction succeeded
 * @returns {string} result.hash - Transaction hash
 * @returns {string} [result.result] - XDR-encoded result if available
 * @throws {Error} If transaction fails or times out
 */
async function submitTransaction(signedTx) {
  const response = await server.sendTransaction(signedTx);

  if (response.status === "PENDING") {
    let txResponse = await server.getTransaction(response.hash);
    while (txResponse.status === "NOT_FOUND") {
      await new Promise((r) => setTimeout(r, 1000));
      txResponse = await server.getTransaction(response.hash);
    }
    if (txResponse.status === "SUCCESS") {
      return { success: true, hash: response.hash, result: txResponse.resultXdr };
    }
    throw new Error(`Transaction failed: ${txResponse.status}`);
  } else if (response.status === "ERROR") {
    throw new Error(`Transaction error: ${response.errorResultXdr}`);
  }

  return { success: true, hash: response.hash };
}

// ============================================
// MULTI-TOKEN WALLET BALANCES
// ============================================

/**
 * Fetch all token balances for a wallet using Horizon API
 */
export async function getWalletTokenBalances(publicKey) {
  try {
    const horizonUrl = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;
    const response = await fetch(horizonUrl);

    if (!response.ok) throw new Error("Failed to fetch account");

    const accountData = await response.json();
    const balances = [];

    for (const balance of accountData.balances) {
      if (balance.asset_type === "native") {
        balances.push({
          symbol: "XLM",
          name: "Stellar Lumens",
          address: "native",
          balance: parseFloat(balance.balance),
          decimals: 7,
          icon: "⭐",
          isNative: true,
        });
      } else {
        const knownToken = SUPPORTED_TOKENS.find(
          (t) => t.address === balance.asset_issuer
        );
        balances.push({
          symbol: balance.asset_code,
          name: knownToken?.name || balance.asset_code,
          address: balance.asset_issuer,
          balance: parseFloat(balance.balance),
          decimals: 7,
          icon: knownToken?.icon || "🪙",
          isNative: false,
          limit: balance.limit,
        });
      }
    }

    return balances;
  } catch (error) {
    console.error("Error fetching balances:", error);
    return [
      {
        symbol: "XLM",
        name: "Stellar Lumens",
        address: "native",
        balance: 0,
        decimals: 7,
        icon: "⭐",
        isNative: true,
      },
    ];
  }
}

// ============================================
// EMPLOYEE CONTRACT FUNCTIONS
// ============================================

/**
 * Registers a new employee in the Early Wage Access system
 *
 * Creates an employee record with an auto-incremented ID and initial salary balance.
 * Each wallet can only be registered once.
 *
 * @async
 * @param {string} publicKey - Caller's Stellar public key (employer/admin)
 * @param {string} walletAddress - Employee's Stellar wallet address (G... format)
 * @param {number} salary - Initial monthly salary amount (in token base units)
 * @param {string} [salaryToken=CONTRACT_ADDRESS_TOKEN] - Token contract address for salary
 * @returns {Promise<Object>} Transaction result with employee ID
 * @throws {Error} If wallet is already registered or transaction fails
 * @example
 * const result = await registerEmployee(
 *   "GBXX...CALLER",
 *   "GBYY...EMPLOYEE",
 *   50000, // 50,000 tokens
 *   CONTRACT_ADDRESS_TOKEN
 * );
 * console.log("Employee ID:", result.hash);
 */
export async function registerEmployee(publicKey, walletAddress, salary, salaryToken = CONTRACT_ADDRESS_TOKEN) {
  const args = [
    addressToScVal(walletAddress),
    numberToU128(salary),
    addressToScVal(salaryToken),
  ];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "register_employee", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

/**
 * Deposits funds into the salary vault
 *
 * Transfers tokens from the caller's account to the contract vault.
 * These funds are used to fulfill employee salary advance requests.
 * Requires token approval if not using native XLM.
 *
 * @async
 * @param {string} publicKey - Depositor's Stellar public key (employer/sponsor)
 * @param {number} amount - Amount to deposit (in token stroops: 1 token = 10,000,000 stroops)
 * @param {string} [tokenAddress=CONTRACT_ADDRESS_TOKEN] - Token contract address
 * @returns {Promise<Object>} Transaction result
 * @throws {Error} If insufficient balance or transaction fails
 * @example
 * // Deposit 100,000 tokens (in stroops)
 * await depositToVault("GBXX...EMPLOYER", 100000 * 10000000);
 */
export async function depositToVault(publicKey, amount, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  // Pre-flight check: Ensure the depositor has enough token balance
  const balance = await getTokenBalance(publicKey, tokenAddress);
  if (balance < amount) {
    throw new Error(`Insufficient token balance! You only have ${balance} tokens.`);
  }

  const args = [
    addressToScVal(publicKey),
    numberToI128(amount),
    addressToScVal(tokenAddress),
  ];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "deposit_to_vault", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

/**
 * Requests an early wage advance for an employee
 *
 * Allows employees to withdraw a portion of their earned salary before payday.
 * A 1.25% fee is automatically deducted from the requested amount.
 * The advance amount is deducted from the employee's remaining salary balance.
 *
 * @async
 * @param {string} publicKey - Caller's Stellar public key (employee or admin)
 * @param {number} empId - Employee ID (returned from registerEmployee)
 * @param {number} amount - Requested advance amount (before fees, in stroops)
 * @param {string} [tokenAddress=CONTRACT_ADDRESS_TOKEN] - Token contract address
 * @returns {Promise<Object>} Transaction result
 * @throws {Error} If amount exceeds remaining salary or vault has insufficient funds
 * @example
 * // Request 2,000 tokens advance (employee receives 1,975 after 1.25% fee)
 * await requestAdvance("GBXX...EMPLOYEE", 1, 2000 * 10000000);
 */
export async function requestAdvance(publicKey, empId, amount, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  // Pre-flight check: Ensure the contract vault has enough balance to pay out
  const vaultBalance = await getVaultBalance(publicKey, tokenAddress);
  const fee = amount * 0.0125;
  const netAmount = amount - fee;

  if (vaultBalance < netAmount) {
    throw new Error(`Contract has insufficient funds to pay this advance right now.`);
  }

  const args = [
    numberToU128(empId),
    numberToI128(amount),
    addressToScVal(tokenAddress),
  ];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "request_advance", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

/**
 * Retrieves the current balance of the salary vault
 *
 * Queries the token balance held by the Early Wage contract.
 * This represents available funds for salary advances.
 * This is a read-only operation (simulation, not a transaction).
 *
 * @async
 * @param {string} publicKey - Caller's Stellar public key (any valid account)
 * @param {string} [tokenAddress=CONTRACT_ADDRESS_TOKEN] - Token contract address
 * @returns {Promise<number>} Vault balance in token base units (stroops)
 * @example
 * const balance = await getVaultBalance("GBXX...XXXX");
 * console.log("Vault has:", balance / 10000000, "tokens");
 */
export async function getVaultBalance(publicKey, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call("vault_balance", addressToScVal(tokenAddress));

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) {
      const resultValue = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());
      return Number(resultValue.i128().lo().toString());
    }
    return 0;
  } catch (error) {
    console.error("Error getting vault balance:", error);
    return 0;
  }
}

/**
 * Retrieves detailed information about an employee
 *
 * Returns the employee record including ID, wallet address, and remaining salary balance.
 * This is a read-only operation (simulation, not a transaction).
 *
 * @async
 * @param {string} publicKey - Caller's Stellar public key (any valid account)
 * @param {number} empId - Employee ID to query
 * @returns {Promise<Object|null>} Employee details or null if not found
 * @returns {number} result.emp_id - Employee ID
 * @returns {string} result.wallet - Employee's Stellar address
 * @returns {number} result.rem_salary - Remaining salary balance
 * @example
 * const employee = await getEmployeeDetails("GBXX...XXXX", 1);
 * if (employee) {
 *   console.log("Remaining salary:", employee.rem_salary);
 * }
 */
export async function getEmployeeDetails(publicKey, empId) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call("get_emp_details", numberToU128(empId));

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) return simResult.result.retval;
    return null;
  } catch (error) {
    console.error("Error getting employee details:", error);
    return null;
  }
}

/**
 * Retrieves the remaining salary balance for an employee
 *
 * Returns how much salary the employee has left to withdraw in the current pay cycle.
 * This amount decreases when advances are requested.
 * This is a read-only operation (simulation, not a transaction).
 *
 * @async
 * @param {string} publicKey - Caller's Stellar public key (any valid account)
 * @param {number} empId - Employee ID to query
 * @returns {Promise<number>} Remaining salary in token base units (stroops), or 0 if employee not found
 * @example
 * const remaining = await getRemainingSalary("GBXX...XXXX", 1);
 * console.log("Can still withdraw:", remaining / 10000000, "tokens");
 */
export async function getRemainingSalary(publicKey, empId) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call("get_remaining_salary", numberToU128(empId));

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) {
      const resultValue = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());
      return Number(resultValue.u128().lo().toString());
    }
    return 0;
  } catch (error) {
    console.error("Error getting remaining salary:", error);
    return 0;
  }
}

/**
 * Releases remaining salary to employee and resets their balance for a new pay cycle
 *
 * This function:
 * 1. Transfers any remaining salary from current cycle to the employee
 * 2. Resets the employee's balance to the new salary amount
 * Typically called at the end of a pay period (e.g., monthly).
 *
 * @async
 * @param {string} publicKey - Caller's Stellar public key (employer/admin)
 * @param {number} empId - Employee ID
 * @param {string} [tokenAddress=CONTRACT_ADDRESS_TOKEN] - Token contract address
 * @param {number} newSalary - Salary amount for the next pay cycle (in stroops)
 * @returns {Promise<Object>} Transaction result
 * @throws {Error} If no remaining salary exists or vault has insufficient funds
 * @example
 * // End of month: release remaining salary and set next month's salary
 * await releaseRemainingSalary(
 *   "GBXX...EMPLOYER",
 *   1,
 *   CONTRACT_ADDRESS_TOKEN,
 *   55000 * 10000000 // New salary: 55,000 tokens
 * );
 */
export async function releaseRemainingSalary(publicKey, empId, tokenAddress = CONTRACT_ADDRESS_TOKEN, newSalary) {
  const args = [
    numberToU128(empId),
    addressToScVal(tokenAddress),
    numberToU128(newSalary),
  ];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "release_remaining_salary", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

// ============================================
// NEW VAULT MANAGEMENT FUNCTIONS (Issue #3)
// ============================================

/**
 * Initializes the contract with an admin and default settings
 *
 * Must be called once before using other contract functions.
 * Sets default maximum withdrawal percentage to 80%.
 *
 * @async
 * @param {string} adminPublicKey - Admin's Stellar public key
 * @returns {Promise<Object>} Transaction result
 * @throws {Error} If initialization fails
 * @example
 * await initializeContract("GBXX...ADMIN");
 */
export async function initializeContract(adminPublicKey) {
  const args = [addressToScVal(adminPublicKey)];

  const preparedTx = await buildContractCall(
    adminPublicKey,
    CONTRACT_ADDRESS_WAGE,
    "initialize",
    args
  );

  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

/**
 * Updates the maximum withdrawal percentage (admin only)
 *
 * Controls how much of their salary employees can withdraw as advances.
 * For example, 80 means employees can withdraw up to 80% of their salary.
 *
 * @async
 * @param {string} adminPublicKey - Admin's Stellar public key
 * @param {number} percentage - Maximum withdrawal percentage (0-100)
 * @returns {Promise<Object>} Transaction result
 * @throws {Error} If caller is not admin or percentage > 100
 * @example
 * // Allow employees to withdraw up to 90% of salary
 * await setMaxWithdrawPercentage("GBXX...ADMIN", 90);
 */
export async function setMaxWithdrawPercentage(adminPublicKey, percentage) {
  const args = [numberToU128(percentage)];

  const preparedTx = await buildContractCall(
    adminPublicKey,
    CONTRACT_ADDRESS_WAGE,
    "set_max_withdraw_pct",
    args
  );

  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

/**
 * Retrieves comprehensive vault statistics
 *
 * Returns detailed information about vault financial health:
 * - Total amount ever deposited
 * - Total amount ever withdrawn
 * - Current balance
 * - Maximum withdrawal percentage setting
 *
 * This is a read-only operation (simulation, not a transaction).
 *
 * @async
 * @param {string} publicKey - Any valid Stellar public key
 * @param {string} [tokenAddress=CONTRACT_ADDRESS_TOKEN] - Token contract address
 * @returns {Promise<Object>} Vault statistics
 * @returns {number} result.total_deposited - Total deposited (stroops)
 * @returns {number} result.total_withdrawn - Total withdrawn (stroops)
 * @returns {number} result.current_balance - Current balance (stroops)
 * @returns {number} result.max_withdraw_percentage - Max withdraw % (0-100)
 * @example
 * const stats = await getVaultStats("GBXX...XXXX");
 * console.log("Vault health:", {
 *   deposited: stats.total_deposited / 10000000,
 *   withdrawn: stats.total_withdrawn / 10000000,
 *   balance: stats.current_balance / 10000000,
 *   maxWithdraw: stats.max_withdraw_percentage + "%"
 * });
 */
export async function getVaultStats(publicKey, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  try {
    const args = [addressToScVal(tokenAddress)];

    const preparedTx = await buildContractCall(
      publicKey,
      CONTRACT_ADDRESS_WAGE,
      "get_vault_stats",
      args
    );

    const sim = await server.simulateTransaction(preparedTx);

    if (rpc.Api.isSimulationSuccess(sim)) {
      const simResult = sim;
      const resultValue = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());

      // Parse the VaultStats struct
      const statsMap = resultValue.map();
      const stats = {};

      statsMap.forEach((entry) => {
        const key = entry.key().sym().toString();
        const val = entry.val();

        if (key === "total_deposited" || key === "total_withdrawn" || key === "current_balance") {
          stats[key] = Number(val.i128().lo().toString());
        } else if (key === "max_withdraw_percentage") {
          stats[key] = Number(val.u32());
        }
      });

      return stats;
    }
    return null;
  } catch (error) {
    console.error("Error getting vault stats:", error);
    throw error;
  }
}

// Helper function to get token balance (used by depositToVault)
async function getTokenBalance(publicKey, tokenAddress) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(tokenAddress);
    const operation = contract.call("balance", addressToScVal(publicKey));

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) {
      const resultValue = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());
      return Number(resultValue.i128().lo().toString());
    }
    return 0;
  } catch (error) {
    console.error("Error getting token balance:", error);
    return 0;
  }
}

// Export contract addresses for reference
export const CONTRACTS = {
  TOKEN: CONTRACT_ADDRESS_TOKEN,
  WAGE: CONTRACT_ADDRESS_WAGE,
  RPC_URL,
};

export default {
  registerEmployee,
  depositToVault,
  requestAdvance,
  getVaultBalance,
  getEmployeeDetails,
  getRemainingSalary,
  releaseRemainingSalary,
  getWalletTokenBalances,
  fetchExchangeRates,
  initializeContract,
  setMaxWithdrawPercentage,
  getVaultStats,
  SUPPORTED_TOKENS,
  CONTRACTS,
};
