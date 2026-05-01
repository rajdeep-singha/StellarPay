<div align="center">

# StellarPay

Stellar-MBC


A three-month open-source builder journey on Stellar.
Focused on real, core contributions—no low-effort PRs.
$2,000 rewarded every month to validated builders.
### Fast, Cheap & Borderless Payrolls for the World

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-7C3AED?style=for-the-badge&logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-06B6D4?style=for-the-badge)](https://soroban.stellar.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Go](https://img.shields.io/badge/Go-Backend-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev)
[![Rust](https://img.shields.io/badge/Rust-Contracts-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Smart Contract CI](https://github.com/rajdeep-singha/StellarPay/actions/workflows/contract.yml/badge.svg)](https://github.com/rajdeep-singha/StellarPay/actions/workflows/contract.yml)
[![Go Backend CI](https://github.com/rajdeep-singha/StellarPay/actions/workflows/backend.yml/badge.svg)](https://github.com/rajdeep-singha/StellarPay/actions/workflows/backend.yml)
[![React Frontend CI](https://github.com/rajdeep-singha/StellarPay/actions/workflows/frontend.yml/badge.svg)](https://github.com/rajdeep-singha/StellarPay/actions/workflows/frontend.yml)
[![Deploy](https://github.com/rajdeep-singha/StellarPay/actions/workflows/deploy.yml/badge.svg)](https://github.com/rajdeep-singha/StellarPay/actions/workflows/deploy.yml)

*Built on Stellar Blockchain — powering global remittance, Early Wage Access (EWA), and modern payroll systems.*

<img src="https://github.com/user-attachments/assets/20dffb3d-40b8-4f75-81d0-a46f6458f189" width="700" alt="StellarPay UI" />

[Live Demo](#-live-demo) • [Getting Started](#-getting-started) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## User Feedback
<img width="1234" height="776" alt="image" src="https://github.com/user-attachments/assets/c1e8645e-aadc-4975-8533-203486b389b1" />

### Our Users
FeedBack Form : https://docs.google.com/forms/d/e/1FAIpQLSdGhtCQ2Z9_skiKndFdVWFpNmxg7q7-iEW2T0KSGa-VPWWHuw/viewform

| User Name | User Email | User Wallet Address |
|-----------|------------|---------------------|
| Ansh | anshansh5999@gmail.com| `GCB3VWQA52OMVE6XQ4XDXEIKAYCN3ORBSVRXXEHQXNJAZUFMZNP3VTJI` |
| Samriddhi Tripathi | samriddhit13@gmail.com | `GAVTU3FCWGXWHXD33LIORGUJ6CR5XEUJ4AKJVXXIOOOQRXGGGNGBKJNQ` |
| Utkarsh Singh | utkarshsingh2321@gmail.com | `GDRB6WSREDVNHB63MSEQOUOF52NNEJ36UQ3LRA5P7YP4C5JUNXNV34YD` |
| Achika bala | achika@gmail.com | `GDQNFJVN7ZJDEM3E7ZMVA4OIL2VAC4J6XRV4EQ62R4KNFPEZSSXASDRJ` |
| EAnsh Singh | anshansh5999@gmail.com | `GBKYNHPCT7EHUBNL5VMFLEYLHDST5H5XKJGMKZYNEKJZCUCJCLO3SSRE` |

### User Feedback Implementation

| User Name | User Email | User Wallet Address | User Feedback | Commit ID |
|-----------|------------|---------------------|---------------|-----------|
| Swarnadeep Chanda | swarnadeep.c17@gmail.com | `GBNWTLZKQPYJLPZNO6YSQ3XASIUP4IJA2KTKXBJMH35IWCEVQ6BQFKGN` | Implement CI/CD pipelines for better test case functionality | [`64b0a17`](https://github.com/rajdeep-singha/StellarPay/commit/64b0a17) · [PR #67](https://github.com/rajdeep-singha/StellarPay/pull/67) |
| Samriddha Das | samriddhadas0106@gmail.com | `GAL6K7NYTU7RZKSL2HT72QVF3BEPHIN4UCHVAB26UGFS6LN3LCVB3UJB` | Add live XLM/USD price feed with real-time ticker component | [`dc48462`](https://github.com/rajdeep-singha/StellarPay/commit/dc48462) · [PR #75](https://github.com/rajdeep-singha/StellarPay/pull/75) |
| Soni shree | sonishree125@gmail.com | `GCQJEHOEIJ46JONK5LCIDGIVUIDFLTFMHSTIJG2HVIE6VHEU3MYVLPRZ` | Add CSV export functionality for payroll data so that we can print payrolls — very handy | [`f2fb3fe`](https://github.com/rajdeep-singha/StellarPay/commit/f2fb3fe) · [PR #32](https://github.com/rajdeep-singha/StellarPay/pull/32) |

## Response Sheet : https://docs.google.com/spreadsheets/d/1aaM2YWWxkLgSeUsUFGImxVuhtmpZeDdKUeYEpROhr_4/edit?usp=sharing

##  About

**StellarPay** is a next-generation remittance and payroll platform built on the **Stellar blockchain**. We leverage Soroban smart contracts to provide:

-  **Remittance Payments** — Cross-border money transfers with near-zero fees
-  **Early Wage Access (EWA)** — Get paid as you earn, no more waiting for payday
-  **On/Off-Ramp Payroll** — Modern global payroll infrastructure for remote teams

---

##  Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          StellarPay                                 │
├─────────────────┬─────────────────────┬─────────────────────────────┤
│     Client      │     Go Backend      │     Smart Contracts         │
│   (React/Vite)  │    (Horizon SDK)    │   (Rust/Soroban)            │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ • Freighter     │ • XLM Transfers     │ • EarlyWage Contract        │
│   Wallet        │ • Transaction       │ • Token Contract            │
│ • Soroban SDK   │   Signing           │ • Vault Management          │
│ • TailwindCSS   │ • CORS Support      │ • Employee Registry         │
└─────────────────┴─────────────────────┴─────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Stellar Testnet  │
                    │   (Soroban RPC)   │
                    └───────────────────┘
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TailwindCSS 4, Stellar SDK |
| **Backend** | Go, Stellar Horizon SDK |
| **Smart Contracts** | Rust, Soroban SDK |
| **Wallet** | Freighter Browser Extension |
| **Network** | Stellar Testnet |

---

##  Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **Go** v1.21+
- **Rust** and Cargo (for contract development)
- **Freighter Wallet** browser extension ([Install](https://freighter.app))

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/Stellar-Pay.git
cd Stellar-Pay
```

### 2️⃣ Start the Go Backend

```bash
cd Go-Sdk
go mod download
go run main.go
```

The API will be running at `http://localhost:8080`

**Available Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send` | Send XLM to a recipient |
| GET | `/api/health` | Health check |

### 3️⃣ Start the React Client

```bash
cd client
npm install
npm run dev
```

The app will be running at `http://localhost:5173`

### 4️⃣ Connect Your Wallet

1. Install [Freighter Wallet](https://freighter.app)
2. Create/import a testnet account
3. Fund your account using [Stellar Friendbot](https://friendbot.stellar.org/?addr=YOUR_ADDRESS)
4. Connect wallet in the StellarPay app

---

##  Project Structure

```
Stellar-Pay/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/        # UI Components
│   │   │   ├── HomePage.jsx
│   │   │   ├── WithdrawForm.jsx
│   │   │   ├── PayCycleProgress.jsx
│   │   │   ├── TransactionHistory.jsx
│   │   │   └── SendMoneyModal.jsx
│   │   ├── hooks/             # Custom React Hooks
│   │   │   └── useWallet.js   # Freighter integration
│   │   ├── services/          # API & Blockchain Services
│   │   │   ├── apiService.js  # Go backend client
│   │   │   └── sorobanService.js  # Smart contract interactions
│   │   └── App.jsx
│   └── package.json
│
├── Go-Sdk/                    # Go Backend
│   ├── main.go                # API server & Stellar transactions
│   ├── go.mod
│   └── go.sum
│
├── early-wager-contract/      # Soroban Smart Contracts
│   └── contracts/
│       ├── early-wage/        # Main EWA contract
│       │   └── src/lib.rs
│       └── token/             # Token contract
│           └── src/
└── README.md
```

---

##  Smart Contract Functions

### Early Wage Contract

| Function | Description |
|----------|-------------|
| `register_employee(wallet, salary)` | Register new employee |
| `deposit_to_vault(from, amount, token)` | Deposit funds to company vault |
| `request_advance(emp_id, amount, token)` | Request salary advance (1.25% fee) |
| `get_remaining_salary(emp_id)` | Check available salary balance |
| `release_remaining_salary(emp_id, token, salary)` | Release remaining salary |
| `vault_balance(token)` | Get vault balance |

---


## CI/CD Logic 
<img width="568" height="159" alt="image" src="https://github.com/user-attachments/assets/d8b4f1db-2439-445a-bccf-f1ce6baff27a" />
<img width="1470" height="847" alt="image" src="https://github.com/user-attachments/assets/669e69eb-ca99-432f-a67d-e38bd8056dd3" />


##  Why StellarPay?

###  Market Opportunity

| Segment | Market Size | Problem | Our Solution |
|---------|-------------|---------|--------------|
| **Remittance** | $860B+ (2023) | 6-8% fees, 1-5 day transfers | Near-zero fees, ~5 sec transfers |
| **EWA** | $200B+ by 2030 | 70%+ live paycheck-to-paycheck | Real-time earned wage access |
| **Global Payroll** | $40B+ (2024) | Complex cross-border payments | Crypto on/off-ramps |

###  Stellar Advantage

| Feature | Traditional | StellarPay |
|---------|-------------|------------|
| Transfer Fees | 6–8% | **~$0.00001** |
| Transfer Time | 1–5 days | **~5 seconds** |
| Bank Required | Yes | **No** |
| Global Access | Limited | **Borderless** |

---

##  Contributing

We love contributions! StellarPay is open source and we welcome developers of all skill levels.

### How to Contribute

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/Stellar-Pay.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow existing code style
   - Add tests if applicable
   - Update documentation

4. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
   
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation
   - `style:` Formatting
   - `refactor:` Code restructuring
   - `test:` Adding tests
   - `chore:` Maintenance

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/amazing-feature
   ```

###  Reporting Issues

Found a bug? Please [open an issue](https://github.com/your-username/Stellar-Pay/issues/new) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### 💡 Feature Requests

Have an idea? We'd love to hear it! [Open a feature request](https://github.com/your-username/Stellar-Pay/issues/new) and describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### 📋 Good First Issues

New to the project? Look for issues labeled:
- `good first issue` — Great for newcomers
- `help wanted` — We need your help!
- `documentation` — Help improve our docs

---

## 🛠️ Development

### Running Tests

```bash
# Client tests
cd client
npm test

# Contract tests
cd early-wager-contract
cargo test
```

### Building for Production

```bash
# Build client
cd client
npm run build

# Build contracts
cd early-wager-contract/contracts/early-wage
make build
```

### Environment Variables

Create a `.env` file in the client directory:

```env
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK=TESTNET
VITE_CONTRACT_TOKEN=your_token_contract_address
VITE_CONTRACT_WAGE=your_wage_contract_address
```

---

##  Screenshots

<table>
  <tr>
    <td align="center"><strong>Dashboard</strong></td>
    <td align="center"><strong>Withdraw</strong></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/20dffb3d-40b8-4f75-81d0-a46f6458f189" width="400" /></td>
    <td><img src="https://github.com/user-attachments/assets/e4ea8ff2-b82a-4114-bd9b-4d672636bae6" width="400"/></td>
  </tr>
</table>

---

## 🗺️ Roadmap

- [x] Core EWA smart contract
- [x] React frontend with Freighter integration
- [x] Go backend for XLM transfers
- [ ] Mobile app (React Native)
- [ ] Multi-currency support
- [ ] Employer dashboard
- [ ] Live FX rate optimization
- [ ] Mainnet deployment

---

## 📢 Live Demo

🔗 **Coming soon...**

---

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://stellar.org)
- [Soroban Smart Contracts](https://soroban.stellar.org)
- [Freighter Wallet](https://freighter.app)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 💜 by the StellarPay Team**

⭐ Star this repo if you find it useful!

[Report Bug](https://github.com/your-username/Stellar-Pay/issues) · [Request Feature](https://github.com/your-username/Stellar-Pay/issues)

</div>
