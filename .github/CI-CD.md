# StellarPay CI/CD Pipeline

This document describes the comprehensive CI/CD pipeline implemented for StellarPay using GitHub Actions.

## 🚀 Overview

The CI/CD pipeline provides automated testing, building, security scanning, and deployment for all three layers of the StellarPay application:

- **React Frontend** (Vite, TypeScript, TailwindCSS)
- **Go Backend** (Stellar Horizon SDK)
- **Rust/Soroban Smart Contracts**

## 📋 Pipeline Workflows

### 1. Main CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main`, `develop`, and `enhancement/*` branches
- Pull requests to `main` and `develop` branches

**Jobs:**

#### Frontend CI
- **Node.js Setup**: Uses Node.js v20 with npm caching
- **Dependencies**: Installs and caches frontend dependencies
- **Linting**: Runs ESLint for code quality
- **Type Checking**: TypeScript compilation check
- **Build**: Production build with Vite
- **Artifacts**: Uploads built frontend distribution

#### Backend CI
- **Go Setup**: Uses Go v1.24 with module caching
- **Dependencies**: Downloads and verifies Go modules
- **Testing**: Runs unit tests with race detection and coverage
- **Benchmark**: Performance benchmarking
- **Build**: Compiles Go binary
- **Artifacts**: Uploads backend binary

#### Smart Contracts CI
- **Rust Setup**: Uses Rust v1.75 with cargo caching
- **Stellar CLI**: Installs Stellar CLI for contract operations
- **Code Quality**: Rustfmt and Clippy checks
- **Testing**: Runs all contract tests
- **Build**: Compiles contracts to WASM
- **Artifacts**: Uploads WASM contract files

#### Security Scanning
- **Trivy**: Vulnerability scanning for all code
- **npm audit**: Frontend dependency security check
- **Go security audit**: Backend security analysis
- **Rust security audit**: Contract dependency audit
- **SARIF Upload**: Security results uploaded to GitHub

#### Integration Tests
- **Services**: Spins up Stellar testnet instance
- **Multi-component**: Tests interaction between all layers
- **Health Checks**: Verifies service availability
- **API Testing**: Tests backend endpoints

#### Deployment
- **Environment**: Production deployment on main branch
- **Artifacts**: Downloads all build artifacts
- **Deploy**: Multi-service deployment
- **Contracts**: Deploys smart contracts to Stellar

#### Notifications
- **Slack Integration**: Failure notifications to CI/CD channel
- **Team Alerts**: Immediate notification on pipeline failures

### 2. Pull Request Checks (`pull-request.yml`)

**Triggers:**
- Pull requests opened, synchronized, or reopened

**Jobs:**

#### Quick Checks
- **Conventional Commits**: Validates commit message format
- **File Size**: Prevents large file commits
- **Secret Scanning**: TruffleHog secret detection

#### Code Quality
- **Multi-language Linting**: ESLint, gofmt, rustfmt
- **Coverage Reports**: Code coverage with PR comments
- **Quality Gates**: Minimum quality thresholds

#### Dependency Checks
- **Outdated Packages**: Checks for outdated dependencies
- **Security Updates**: Identifies security vulnerabilities
- **Version Compatibility**: Ensures compatibility testing

#### Performance Checks
- **Bundle Analysis**: Frontend bundle size analysis
- **Lighthouse CI**: Performance and accessibility testing
- **Benchmarking**: Performance regression detection

### 3. Deployment Pipeline (`deploy.yml`)

**Triggers:**
- Push to main branch
- Version tags (v*)
- Manual workflow dispatch

**Jobs:**

#### Docker Build & Push
- **Multi-arch**: Builds for multiple architectures
- **Registry**: GitHub Container Registry
- **Caching**: Build cache for faster builds
- **Metadata**: Automatic tagging and labeling

#### Staging Deployment
- **Kubernetes**: Deploys to staging namespace
- **Health Checks**: Post-deployment verification
- **Smoke Tests**: Basic functionality testing

#### Production Deployment
- **Smart Contracts**: Deploys to Stellar network
- **Kubernetes**: Production namespace deployment
- **Rolling Updates**: Zero-downtime deployment
- **Comprehensive Tests**: Full test suite execution

#### Rollback
- **Automatic**: Rollback on deployment failure
- **Manual**: Manual rollback capability
- **Notifications**: Rollback status alerts

### 4. Release Pipeline (`release.yml`)

**Triggers:**
- Version tags (v*)
- Manual workflow dispatch

**Jobs:**

#### Release Creation
- **Changelog**: Automatic changelog generation
- **GitHub Release**: Creates release with assets
- **Version Management**: Semantic versioning support

#### Asset Building
- **Multi-component**: Builds all application components
- **Archives**: Creates compressed archives
- **Checksums**: SHA256 checksums for verification
- **Upload**: Uploads to GitHub releases

#### Documentation Updates
- **Version Sync**: Updates version numbers
- **Documentation**: Updates docs with new version
- **Git Operations**: Commits version updates

## 🔧 Configuration Files

### Docker Configuration
- **Frontend Dockerfile**: Multi-stage build with Nginx
- **Backend Dockerfile**: Optimized Go binary build
- **Nginx Config**: Production-ready Nginx configuration
- **Dockerignore**: Optimized build context

### Kubernetes Configuration
- **Staging**: Staging environment configurations
- **Production**: Production environment configurations
- **Services**: Service and ingress configurations
- **Deployments**: Deployment specifications

### GitHub Actions
- **Workflows**: All CI/CD workflow files
- **Environment**: Production and staging environments
- **Secrets**: Required secrets and configurations

## 🛡️ Security Features

### Scanning
- **Code Scanning**: Tr vulnerability scanning
- **Secret Detection**: TruffleHog secret scanning
- **Dependency Scanning**: npm audit, Go audit, Rust audit
- **Container Scanning**: Docker image security scanning

### Best Practices
- **Least Privilege**: Minimal permissions for workflows
- **Secret Management**: Secure secret handling
- **Signed Commits**: Commit verification
- **Dependency Pinning**: Fixed dependency versions

## 📊 Monitoring & Observability

### Metrics
- **Build Times**: Pipeline performance metrics
- **Test Coverage**: Code coverage tracking
- **Security Scores**: Security vulnerability tracking
- **Deployment Success**: Deployment success rates

### Alerts
- **Slack Integration**: Real-time notifications
- **GitHub Status**: Status badge updates
- **Email Alerts**: Critical failure notifications
- **Dashboard**: Pipeline status dashboard

## 🚦 Environment Management

### Staging
- **Purpose**: Testing environment
- **Data**: Test data and configurations
- **Network**: Stellar Testnet
- **URL**: staging.stellarpay.app

### Production
- **Purpose**: Live production environment
- **Data**: Real user data
- **Network**: Stellar Mainnet (when ready)
- **URL**: stellarpay.app

## 🔄 Branch Strategy

### Main Branch
- **Purpose**: Production-ready code
- **Protection**: Branch protection rules
- **Deployment**: Automatic production deployment
- **Merging**: PR-based merging with checks

### Develop Branch
- **Purpose**: Integration testing
- **Deployment**: Staging deployment
- **Features**: Feature branch merging target

### Feature Branches
- **Naming**: `enhancement/*` pattern
- **Testing**: Full CI pipeline execution
- **Merging**: PR to develop branch

## 📝 Required Secrets

### GitHub Secrets
```
GITHUB_TOKEN                    # GitHub API token
SLACK_WEBHOOK                  # Slack webhook URL
KUBE_CONFIG_STAGING            # Kubernetes staging config
KUBE_CONFIG_PRODUCTION        # Kubernetes production config
LHCI_GITHUB_APP_TOKEN         # Lighthouse CI token
```

### Environment Secrets
```
STELLAR_NETWORK               # Stellar network configuration
HORIZON_URL                   # Horizon API URL
JWT_SECRET                    # JWT signing secret
DATABASE_URL                  # Database connection URL
```

## 🛠️ Local Development

### Prerequisites
- Docker and Docker Compose
- Kubernetes cluster (optional)
- GitHub CLI (gh)

### Setup
```bash
# Clone repository
git clone https://github.com/omolobamoyinoluwa-max/StellarPay.git
cd StellarPay

# Setup GitHub CLI
gh auth login

# Test workflows locally
act -j frontend
act -j backend
act -j smart-contracts
```

## 📈 Performance Optimizations

### Build Caching
- **GitHub Actions Cache**: Dependency and build caching
- **Docker Layer Caching**: Optimized Docker builds
- **Cargo Cache**: Rust dependency caching
- **Go Module Cache**: Go module caching

### Parallel Execution
- **Matrix Strategy**: Parallel builds for multiple components
- **Job Dependencies**: Optimized job execution order
- **Resource Management**: Efficient resource utilization

## 🚨 Troubleshooting

### Common Issues
1. **Build Failures**: Check dependency versions and compatibility
2. **Test Failures**: Verify test environment setup
3. **Deployment Failures**: Check Kubernetes configuration
4. **Security Scanning**: Review and fix security vulnerabilities

### Debug Commands
```bash
# Check workflow status
gh run list

# View workflow logs
gh run view <run-id>

# Debug specific job
gh run view <run-id> --job <job-id>

# Cancel running workflow
gh run cancel <run-id>
```

## 📚 References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Stellar Development Guide](https://developers.stellar.org/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 🤝 Contributing

When contributing to the CI/CD pipeline:

1. **Test Changes**: Always test workflow changes in feature branches
2. **Documentation**: Update this documentation for any changes
3. **Security**: Follow security best practices
4. **Performance**: Consider build time and resource usage

For questions or issues, please open an issue or contact the DevOps team.
