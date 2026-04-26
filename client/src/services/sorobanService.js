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
  console.warn("⚠️ Contract addresses not set in the client `.env` — soroban calls will fail.");

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
  // Fallback mock rates — replace with real price feed in production
  return {
    XLM: 0.11,
    USDC: 1.0,
    EURC: 1.08,
  };
}

// Initialize Soroban RPC client
const server = new rpc.Server(RPC_URL);
function getWageContract() {
  if (!CONTRACT_ADDRESS_WAGE) {
    throw new Error("CONTRACT_ADDRESS_WAGE is not set. Please check .env and restart the app.");
  }
  try {
    return new Contract(CONTRACT_ADDRESS_WAGE);
  } catch {
    throw new Error(`Invalid contract ID for CONTRACT_ADDRESS_WAGE: ${CONTRACT_ADDRESS_WAGE}`);
  }
}
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

export async function registerEmployee(publicKey, walletAddress, salary, salaryToken = CONTRACT_ADDRESS_TOKEN) {
  if (!publicKey || !walletAddress) {
    throw new Error("Wallet address not available for registration. Please connect wallet.");
  }

  try {
    const args = [
      addressToScVal(walletAddress),
      numberToU128(salary),
      addressToScVal(salaryToken),
    ];

    const preparedTx = await buildContractCall(publicKey, CONTRACT_ADDRESS_WAGE, "register_employee", args);
    const signedTx = await signWithFreighter(preparedTx);

    const result = await submitTransaction(signedTx);
    console.log("registerEmployee transaction success:", result);
    return result;
  } catch (error) {
    console.error("registerEmployee error:", error);
    throw error;
  }
}

export async function getAdmin() {
  const preparedTx = await buildContractCall("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", CONTRACT_ADDRESS_WAGE, "get_admin", []);
  const signedTx = await signWithFreighter(preparedTx);
  return submitTransaction(signedTx);
}

export async function getTokenBalance(publicKey, tokenAddress) {
  try {
    const horizonUrl = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;
    const response = await fetch(horizonUrl);
    if (!response.ok) return 0;
    const data = await response.json();
    for (const b of data.balances) {
      if (b.asset_type === "native" && tokenAddress === "native") return parseFloat(b.balance);
      if (b.asset_issuer === tokenAddress) return parseFloat(b.balance);
    }
    return 0;
  } catch {
    return 0;
  }
}

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

export async function getVaultBalance(publicKey, tokenAddress = CONTRACT_ADDRESS_TOKEN) {
  try {
    const account = await server.getAccount(publicKey);
  const contract = getWageContract();
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

export async function getEmployeeDetails(publicKey, empId) {
  try {
    const account = await server.getAccount(publicKey);
    const contract = getWageContract();
    const operation = contract.call("get_emp_details", numberToU128(empId));

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) {
      const raw = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());
      return scValToNative(raw);
    }
    return null;
  } catch (error) {
    console.error("Error getting employee details:", error);
    return null;
  }
}

export async function getEmployeeIdByWallet(walletAddress) {
  try {
    const account = await server.getAccount(walletAddress);
    const contract = getWageContract();
    const operation = contract.call("get_emp_id_by_wallet", addressToScVal(walletAddress));

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await server.simulateTransaction(transaction);
    if (simResult.result) {
      const sc = xdr.ScVal.fromXDR(simResult.result.retval.toXDR());
      const id = Number(sc.u128().lo().toString());
      return id;
    }

    return 0;
  } catch (error) {
    console.error("Error getting employee ID by wallet:", error);
    return 0;
  }
}

export async function getEmployeeWithWA(walletAddress) {
  try {
    const empId = await getEmployeeIdByWallet(walletAddress);
    if (!empId) {
      return null;
    }

    const details = await getEmployeeDetails(walletAddress, empId);
    if (!details) {
      return null;
    }

    return {
      empId,
      wallet: details.wallet || walletAddress,
      rem_salary: Number(details.rem_salary || 0),
      salary_token: details.salary_token,
      ...details,
    };
  } catch (error) {
    console.error("Error getting employee with wallet address:", error);
    throw error;
  }
}

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

export const CONTRACTS = {
  TOKEN: CONTRACT_ADDRESS_TOKEN,
  WAGE: CONTRACT_ADDRESS_WAGE,
  RPC_URL,
};
export async function getTransactionHistory(publicKey) {
  try {
    const response = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${publicKey}/operations?limit=20&order=desc`
    );
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

export default {
  registerEmployee,
  getAdmin,
  depositToVault,
  requestAdvance,
  getVaultBalance,
  getEmployeeDetails,
  getEmployeeWithWA,
  getRemainingSalary,
  releaseRemainingSalary,
  getWalletTokenBalances,
  fetchExchangeRates,
  getTransactionHistory,
  SUPPORTED_TOKENS,
  CONTRACTS,
};