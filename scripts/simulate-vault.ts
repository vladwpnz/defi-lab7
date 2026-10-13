
import { network } from "hardhat";
import { readFileSync } from "node:fs";

async function main() {
    const { ethers, networkName } = await network.create();

    if (networkName !== "sepolia") {
        throw new Error("Use Sepolia network");
    }

    const addresses = JSON.parse(
        readFileSync("deployments-sepolia.json", "utf8")
    );

    const deployment = JSON.parse(
        readFileSync("vault-sepolia.json", "utf8")
    );

    const [investor] = await ethers.getSigners();

    const vlc = await ethers.getContractAt(
        "VLCToken",
        addresses.vlc
    );

    const musd = await ethers.getContractAt(
        "MockUSD",
        addresses.musd
    );

    const vault = await ethers.getContractAt(
        "AutoCompoundVault",
        deployment.vault
    );

    const depositAmount = ethers.parseEther("1000");
    const rewardAmount = ethers.parseEther("100");

    console.log("Network:", networkName);
    console.log("Investor:", investor.address);
    console.log("Vault:", deployment.vault);

    const initialSupply = await vault.totalSupply();
    const initialAssets = await vault.totalAssets();
    const initialRewards = await musd.balanceOf(deployment.vault);

    if (
        initialSupply !== 0n ||
        initialAssets !== 0n ||
        initialRewards !== 0n
    ) {
        throw new Error("Vault is not empty. Check state before continuing.");
    }

    const vlcBalance = await vlc.balanceOf(investor.address);
    const musdBalance = await musd.balanceOf(investor.address);

    if (vlcBalance < depositAmount) {
        throw new Error("Insufficient VLC balance");
    }

    if (musdBalance < rewardAmount) {
        throw new Error("Insufficient mUSD balance");
    }

    // Assign consecutive nonces to avoid stale nonce errors.
    let nonce = await ethers.provider.getTransactionCount(
        investor.address,
        "pending"
    );

    console.log("Starting nonce:", nonce);

    console.log("\n=== STEP 1: DEPOSIT ===");

    const allowance = await vlc.allowance(
        investor.address,
        deployment.vault
    );

    if (allowance < depositAmount) {
        const approveTx = await vlc.approve(
            deployment.vault,
            depositAmount,
            { nonce: nonce++ }
        );

        await approveTx.wait();
        console.log("VLC approved:", approveTx.hash);
    } else {
        console.log("VLC already approved. Skipping approval.");
    }

    const depositTx = await vault.deposit(
        depositAmount,
        { nonce: nonce++ }
    );

    await depositTx.wait();

    const shares = await vault.balanceOf(investor.address);
    const assetsBefore = await vault.convertToAssets(shares);

    console.log("Deposited:", ethers.formatEther(depositAmount), "VLC");
    console.log("Shares received:", ethers.formatEther(shares), "vVLC");
    console.log("Share value before:", ethers.formatEther(assetsBefore), "VLC");
    console.log("Deposit transaction:", depositTx.hash);

    console.log("\n=== STEP 2: REWARDS ===");

    const rewardTx = await musd.transfer(
        deployment.vault,
        rewardAmount,
        { nonce: nonce++ }
    );

    await rewardTx.wait();

    console.log("Rewards transferred:", ethers.formatEther(rewardAmount), "mUSD");
    console.log("Reward transaction:", rewardTx.hash);

    console.log("\n=== STEP 3: COMPOUND ===");

    const compoundTx = await vault.compound(
        { nonce: nonce++ }
    );

    await compoundTx.wait();

    const sharesAfter = await vault.balanceOf(investor.address);
    const assetsAfter = await vault.convertToAssets(sharesAfter);
    const profit = assetsAfter - assetsBefore;

    console.log("Shares after:", ethers.formatEther(sharesAfter), "vVLC");
    console.log("Share value after:", ethers.formatEther(assetsAfter), "VLC");
    console.log("Profit:", ethers.formatEther(profit), "VLC");
    console.log("Compound transaction:", compoundTx.hash);

    if (sharesAfter !== shares) {
        throw new Error("Shares changed unexpectedly");
    }

    if (assetsAfter <= depositAmount) {
        throw new Error("Compounding did not increase share value");
    }

    console.log("\n=== STEP 4: WITHDRAW ===");

    const balanceBefore = await vlc.balanceOf(investor.address);

    const withdrawTx = await vault.withdraw(
        sharesAfter,
        { nonce: nonce++ }
    );

    await withdrawTx.wait();

    const balanceAfter = await vlc.balanceOf(investor.address);
    const withdrawn = balanceAfter - balanceBefore;

    console.log("Assets withdrawn:", ethers.formatEther(withdrawn), "VLC");
    console.log("Withdraw transaction:", withdrawTx.hash);

    if (withdrawn <= depositAmount) {
        throw new Error("Withdrawal did not exceed initial deposit");
    }

    console.log("\nALL VERIFICATIONS PASSED!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
