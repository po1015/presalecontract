const hre = require("hardhat");
const fs = require("fs");

const BASE_USDC = "0xfe411b74c2AA728ed17CFcCf1FA0144599b55176";
const BASE_USDT = "0xe4124421ada579bD3F81FbBdF460DC1C6Cb310E0";
const ETH_USD_ORACLE = "0xf7aE13dEb9a62bf8f263ADAAa4aF2c7e4cBB470e";

async function main() {
  console.log("=== NEBA Presale - WORKING Deployment ===\n");

  const [deployer] = await hre.ethers.getSigners();
  const multisig = deployer.address;
  const nebaToken = process.env.NEBA_TOKEN_ADDRESS;

  console.log("Deployer:", deployer.address, "\n");

  // 1. Deploy VestingVault FIRST (no saleManager yet!)
  console.log("1️⃣ Deploying Vesting Vault (uninitialized)...");
  const VestingVault = await hre.ethers.getContractFactory("VestingVault");
  const vestingVault = await VestingVault.deploy(nebaToken);
  await vestingVault.waitForDeployment();
  const vvAddr = await vestingVault.getAddress();
  console.log("   ✅", vvAddr, "\n");

  // 2. Deploy infrastructure
  console.log("2️⃣ Deploying infrastructure...");
  const KYCRegistry = await hre.ethers.getContractFactory("KYCRegistry");
  const kycRegistry = await KYCRegistry.deploy(multisig);
  await kycRegistry.waitForDeployment();
  const kycAddr = await kycRegistry.getAddress();

  const RateLimiter = await hre.ethers.getContractFactory("RateLimiter");
  const rateLimiter = await RateLimiter.deploy(multisig);
  await rateLimiter.waitForDeployment();
  const rateAddr = await rateLimiter.getAddress();

  const FundsVault = await hre.ethers.getContractFactory("FundsVault");
  const fundsVault = await FundsVault.deploy(multisig);
  await fundsVault.waitForDeployment();
  const fundsAddr = await fundsVault.getAddress();
  console.log("   ✅ Done\n");

  // 3. Deploy SaleManager with VestingVault address
  console.log("3️⃣ Deploying Sale Manager...");
  const SaleManager = await hre.ethers.getContractFactory("SaleManager");
  const saleManager = await SaleManager.deploy(
    nebaToken, kycAddr, rateAddr, vvAddr, fundsAddr,
    BASE_USDC, BASE_USDT, ETH_USD_ORACLE, multisig
  );
  await saleManager.waitForDeployment();
  const smAddr = await saleManager.getAddress();
  console.log("   ✅", smAddr, "\n");

  // 4. Initialize VestingVault with SaleManager
  console.log("4️⃣ Initializing Vesting Vault with Sale Manager...");
  const initTx = await vestingVault.initialize(smAddr);
  await initTx.wait();
  console.log("   ✅ Initialized!\n");

  const refAddr = await saleManager.referralSystem();

  console.log("═══════════════════════════════════════");
  console.log("  ✅ DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log("NEBA Token:", nebaToken);
  console.log("KYC Registry:", kycAddr);
  console.log("Rate Limiter:", rateAddr);
  console.log("Funds Vault:", fundsAddr);
  console.log("Vesting Vault:", vvAddr);
  console.log("Referral System:", refAddr);
  console.log("Sale Manager:", smAddr, "\n");

  // Save
  const info = {
    network: hre.network.name,
    deployer: deployer.address,
    multisig: multisig,
    timestamp: new Date().toISOString(),
    contracts: {
      NEBAToken: nebaToken,
      KYCRegistry: kycAddr,
      RateLimiter: rateAddr,
      FundsVault: fundsAddr,
      VestingVault: vvAddr,
      ReferralSystem: refAddr,
      SaleManager: smAddr,
    }
  };

  fs.writeFileSync(`deployments-${hre.network.name}.json`, JSON.stringify(info, null, 2));
  console.log("✅ Saved to deployments-" + hre.network.name + ".json\n");

  // Create round immediately
  console.log("Creating Private Sale round...");
  const config = {
    name: "Private Sale",
    tokenPriceUSD: 50000,
    hardCapUSD: hre.ethers.parseUnits("500000", 6),
    startTime: Math.floor(Date.now() / 1000),
    endTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    cliffDuration: 180 * 24 * 60 * 60,
    vestingDuration: 365 * 24 * 60 * 60,
    isActive: true,
  };

  const createTx = await saleManager.createRound(config);
  await createTx.wait();
  
  const roundCount = await saleManager.getRoundCount();
  const roundAddr = await saleManager.getRound(Number(roundCount) - 1);
  console.log("✅ Round created:", roundAddr, "\n");

  // Authorize round
  console.log("Authorizing round...");
  await fundsVault.authorizeDepositor(roundAddr);
  await rateLimiter.grantRole(await rateLimiter.SALE_ROUND_ROLE(), roundAddr);
  await vestingVault.grantRole(await vestingVault.SALE_ROUND_ROLE(), roundAddr);
  const refSys = await hre.ethers.getContractAt("ReferralSystem", refAddr);
  await refSys.grantRole(await refSys.SALE_ROUND_ROLE(), roundAddr);
  console.log("✅ All permissions granted\n");

  // Add to KYC
  console.log("Adding to KYC whitelist...");
  await kycRegistry.addToWhitelist(deployer.address);
  console.log("✅ KYC approved\n");

  // TEST PURCHASE!
  console.log("═══════════════════════════════════════");
  console.log("  🧪 TESTING USDT PURCHASE");
  console.log("═══════════════════════════════════════\n");
  
  const saleRound = await hre.ethers.getContractAt("SaleRound", roundAddr);
  const usdt = await hre.ethers.getContractAt("ERC20Mock", BASE_USDT);
  
  const amount = hre.ethers.parseUnits("100", 6);
  
  console.log("Minting 100 USDT...");
  await usdt.mint(deployer.address, amount);
  console.log("✅ Minted\n");
  
  console.log("Approving USDT...");
  await usdt.approve(roundAddr, amount);
  console.log("✅ Approved\n");
  
  console.log("Purchasing...");
  console.log("  Amount: $100 USDT");
  console.log("  Expected: 2,000 NEBA ($100 / $0.05)");
  console.log("  Referrer: None\n");
  
  const purchaseTx = await saleRound.buyWithUSDT(amount, hre.ethers.ZeroAddress);
  console.log("  Transaction sent:", purchaseTx.hash);
  await purchaseTx.wait();
  console.log("  ✅ CONFIRMED!\n");

  const [contrib, alloc, bonus] = await saleRound.getUserInfo(deployer.address);
  console.log("🎉 PURCHASE SUCCESSFUL!");
  console.log("═══════════════════════════════════════");
  console.log("  Contributed: $" + hre.ethers.formatUnits(contrib, 6));
  console.log("  NEBA Tokens:", hre.ethers.formatEther(alloc));
  console.log("  Bonus Tokens:", hre.ethers.formatEther(bonus));
  console.log("═══════════════════════════════════════\n");

  console.log("✅ System is fully functional!");
  console.log("\nPrivate Sale Round:", roundAddr);
  console.log("View on Basescan: https://sepolia.basescan.org/address/" + roundAddr);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

