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

// Contract addresses (set these via VITE_* env vars)
const CONTRACT_ADDRESS_TOKEN = import.meta.env.VITE_CONTRACT_TOKEN;
const CONTRACT_ADDRESS_WAGE = import.meta.env.VITE_CONTRACT_WAGE;
const RPC_URL = "https://soroban-testnet.stellar.org";

if (!CONTRACT_ADDRESS_TOKEN || !CONTRACT_ADDRESS_WAGE)
  console.warn(
    "⚠️ Contract addresses not set in the client `.env` — soroban calls will fail."
  );

// ============================================
// SUPPORTED TOKENS (Stellar Testnet)
// ============================================
export const SUPPORTED_TOKENS = [
  { symbol: "XLM", name: "Stellar Lumens", address: "native", decimals: 7, icon: "⭐", isNative: true },
  { symbol: "USDC", name: "USD Coin", address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", decimals: 7, icon: "💵", isNative: false },
  { symbol: "EURC", name: "Euro Coin", address: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP", decimals: 7, icon: "💶", isNative: false },
];

export async function fetchExchangeRates() {
  try {
    return { XLM: 0.11, USDC: 1.0, EURC: 1.08 };
  } catch {
    return { XLM: 0.11, USDC: 1.0, EURC: 1.08 };
  }
}

const server = new rpc.Server(RPC_URL);

// ============================================
// ScVal HELPERS
// ============================================
export const addressToScVal = (account) => new Address(account).toScVal();
export const numberToU128 = (num) => nativeToScVal(num, { type: "u128" });
export const numberToI128 = (num) => nativeToScVal(num, { type: "i128" });

// ============================================
// CORE TRANSACTION HELPERS
// ============================================
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

async function signWithFreighter(preparedTx) {
  if (!window.freighterApi) throw new Error("Freighter wallet not found");
  const txXdr = preparedTx.toXDR();
  const signedResponse = await signTransaction(txXdr, {
    network: "TESTNET",
    networkPassphrase: Networks.TESTNET,
  });
  if (!signedResponse) throw new Error("Transaction signature was rejected or failed.");
  const finalXdr =
    typeof signedResponse === "object"
      ? signedResponse.signedTxXdr || signedResponse.txXdr
      : signedResponse;
  if (!finalXdr || typeof finalXdr !== "string")
    throw new Error("Invalid response format from Freighter SDK: Missing XDR string.");
  return TransactionBuilder.fromXDR(finalXdr, Networks.TESTNET);
}

/**
 * Submit a signed transaction and poll for confirmation.
 *
 * Fixes issue #19: the original implementation used an unbounded `while` loop
 * that would poll forever if the network stalled or the transaction was lost.
 * This version adds:
 *   - A configurable `maxAttempts` limit (default: 30 × 1 s = 30 s timeout)
 *   - A clear timeout error when the limit is exceeded
 *
 * @param {Transaction} signedTx  - Signed Stellar transaction
 * @param {number}      maxAttempts - Maximum polling attempts before timing out (default: 30)
 * @param {number}      intervalMs  - Milliseconds between each poll (default: 1000)
 */
async function submitTransaction(signedTx, maxAttempts = 30, intervalMs = 1000) {
  const response = await server.sendTransaction(signedTx);

  if (response.status === "ERROR") {
    throw new Error(`Transaction error: ${response.errorResultXdr}`);
  }

  if (response.status === "PENDING") {
    let attempts = 0;
    let txResponse = await server.getTransaction(response.hash);

    while (txResponse.status === "NOT_FOUND") {
      if (attempts >= maxAttempts) {
        throw new Error(
          `Transaction confirmation timed out after ${maxAttempts} attempts (~${
            (maxAttempts * intervalMs) / 1000
          }s). Hash: ${response.hash}`
        );
      }
      await new Promise((r) => setTimeout(r, intervalMs));
      txResponse = await server.getTransaction(response.hash);
      attempts++;
    }

    if (txResponse.status === "SUCCESS") {
      return { success: true, hash: response.hash, result: txResponse.resultXdr };
    }
    throw new Error(`Transaction failed: ${txResponse.status}`);
  }

  return { success: true, hash: response.hash };
}

// ============================================
// MULTI-TOKEN WALLET BALANCES
// ============================================
export async function getWalletTokenBalances(publicKey) {
  try {
    const horizonUrl = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;
    const response = await fetch(horizonUrl);
    if (!response.ok) throw new Error("Failed to fetch account");
    const accountData = await response.json();
    const balances = [];
    for (const balance of accountData.balances) {
      if (balance.asset_type === "native") {
        balances.push({ symbol: "XLM", name: "Stellar Lumens", address: "native", balance: parseFloat(balance.balance), decimals: 7, icon: "⭐", isNative: true });
      } else {
        const knownToken = SUPPORTED_TOKENS.find((t) => t.address === balance.asset_issuer);
        balances.push({ symbol: balance.asset_code, name: knownToken?.name || balance.asset_code, address: balance.asset_issuer, balance: parseFloat(balance.balance), decimals: 7, icon: knownToken?.icon || "🪙", isNative: false, limit: balance.limit });
      }
    }
    return balances;
  } catch (error) {
    console.error("Error fetching balances:", error);
    return [{ symbol: "XLM", name: "Stellar Lumens", address: "native", balance: 0, decimals: 7, icon: "⭐", isNative: true }];
  }
}

// ============================================
// EMPLOYEE CONTRACT FUNCTIONS
// ============================================

/**
 * Look up an employee ID by wallet address.
 *
 * Implements the new two-step query pattern introduced when the contract was
 * refactored: `get_emp_id_by_wallet` returns only the u128 emp_id, which is
 * then passed to `get_emp_details` to fetch the full employee record.
 *
 * Fixes issue #18: the old `getEmployeeWithWA` helper was removed from this
 * file but callers in checkUser.js and RegistrationCard.jsx still referenced
 * it, causing ReferenceErrors at runtime.
 *
 * @param {string} publicKey     - Connected wallet's public key (for RPC account load)
 * @param {string} walletAddress - Wallet address to look up
 * @returns {bigint|null} emp_id as BigInt, or null if not registered
 */
export async function getEmpIdByWallet(publicKey, walletAddress) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call(
      "get_emp_id_by_wallet",
      addressToScVal(walletAddress)
    );
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();
    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) {
      const val = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());
      // Contract returns Option<u128>: if None, the wallet is not registered
      if (val.switch().name === "scvVoid") return null;
      return BigInt(val.u128().lo().toString());
    }
    return null;
  } catch (error) {
    console.error("Error getting emp_id by wallet:", error);
    return null;
  }
}

/**
 * Fetch full employee details for a given wallet address using the two-step
 * query pattern: wallet → emp_id → employee details.
 *
 * This replaces the removed `getEmployeeWithWA` function for callers that
 * need the full EmployeeDetails struct (checkUser.js, RegistrationCard.jsx).
 *
 * @param {string} publicKey     - Connected wallet public key
 * @param {string} walletAddress - Wallet address to look up
 * @returns {{ empId: bigint, details: object }|null}
 */
export async function getEmployeeByWallet(publicKey, walletAddress) {
  const empId = await getEmpIdByWallet(publicKey, walletAddress);
  if (empId === null) return null;
  const details = await getEmployeeDetails(publicKey, empId);
  if (!details) return null;
  return { empId, details };
}

export async function registerEmployee(publicKey, walletAddress, salary, salaryToken = CONTRACT_ADDRESS_TOKEN) {
  const args = [addressToScVal(walletAddress), numberToU128(salary), addressToScVal(salaryToken)];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "register_employee", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

export async function depositToVault(publicKey, amount, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  const balance = await getTokenBalance(publicKey, tokenAddress);
  if (balance < amount) throw new Error(`Insufficient token balance! You only have ${balance} tokens.`);
  const args = [addressToScVal(publicKey), numberToI128(amount), addressToScVal(tokenAddress)];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "deposit_to_vault", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

export async function requestAdvance(publicKey, empId, amount, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  const vaultBalance = await getVaultBalance(publicKey, tokenAddress);
  const fee = amount * 0.0125;
  const netAmount = amount - fee;
  if (vaultBalance < netAmount) throw new Error(`Contract has insufficient funds to pay this advance right now.`);
  const args = [numberToU128(empId), numberToI128(amount), addressToScVal(tokenAddress)];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "request_advance", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

export async function getVaultBalance(publicKey, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call("vault_balance", addressToScVal(tokenAddress));
    const transaction = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(operation).setTimeout(300).build();
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

export async function getEmployeeDetails(publicKey, empId) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call("get_emp_details", numberToU128(empId));
    const transaction = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(operation).setTimeout(300).build();
    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) return simResult.result.retval;
    return null;
  } catch (error) {
    console.error("Error getting employee details:", error);
    return null;
  }
}

export async function getRemainingSalary(publicKey, empId) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ADDRESS_WAGE);
    const operation = contract.call("get_remaining_salary", numberToU128(empId));
    const transaction = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(operation).setTimeout(300).build();
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

export async function releaseRemainingSalary(publicKey, empId, tokenAddress = CONTRACT_ADDRESS_TOKEN, newSalary) {
  const args = [numberToU128(empId), addressToScVal(tokenAddress), numberToU128(newSalary)];
  const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "release_remaining_salary", args);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

export async function getTransactionHistory(publicKey) {
  try {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}/operations?limit=20&order=desc`);
    if (!response.ok) throw new Error("Failed to fetch transaction history");
    const data = await response.json();
    return data._embedded.records.map((op) => ({
      hash: op.transaction_hash,
      type: op.type === "payment" ? (op.to === publicKey ? "Receive" : "Send") : op.type,
      amount: parseFloat(op.amount || 0),
      date: op.created_at,
      status: "completed",
      recipient: op.to || null,
      fee: 0,
    }));
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return [];
  }
}

export const CONTRACTS = { TOKEN: CONTRACT_ADDRESS_TOKEN, WAGE: CONTRACT_ADDRESS_WAGE, RPC_URL };

export default {
  registerEmployee,
  depositToVault,
  requestAdvance,
  getVaultBalance,
  getEmployeeDetails,
  getEmpIdByWallet,
  getEmployeeByWallet,
  getRemainingSalary,
  releaseRemainingSalary,
  getWalletTokenBalances,
  fetchExchangeRates,
  getTransactionHistory,
  SUPPORTED_TOKENS,
  CONTRACTS,
};
