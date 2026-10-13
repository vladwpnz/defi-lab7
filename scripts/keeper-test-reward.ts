
import { network } from "hardhat";
import { readFileSync } from "node:fs";

async function main() {
    const { ethers, networkName } = await network.create();

    if (networkName !== "sepolia") {
        throw new Error("Use Sepolia network");
    }

    const deployment = JSON.parse(
        readFileSync("vault-sepolia.json", "utf8")
    );

    const [investor] = await ethers.getSigners();

    const musd = await ethers.getContractAt(
        "MockUSD",
        deployment.rewardToken
    );

    const vault = await ethers.getContractAt(
        "AutoCompoundVault",
        deployment.vault
    );

    const rewardAmount = ethers.parseEther("100");

    const shares = await vault.balanceOf(investor.address);
    const existingRewards = await musd.balanceOf(deployment.vault);

    if (shares === 0n) {
        throw new Error("No active investor deposit");
    }

    if (existingRewards !== 0n) {
        throw new Error("Vault already has rewards");
    }

    if (await musd.balanceOf(investor.address) < rewardAmount) {
        throw new Error("Insufficient mUSD balance");
    }

    const nonce = await ethers.provider.getTransactionCount(
        investor.address,
        "pending"
    );

    console.log("=== KEEPER TEST REWARDS ===");
    console.log("Vault:", deployment.vault);
    console.log("Sending: 100 mUSD");

    const tx = await musd.transfer(
        deployment.vault,
        rewardAmount,
        { nonce }
    );

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
        throw new Error("Reward transfer failed");
    }

    const rewards = await musd.balanceOf(deployment.vault);

    console.log("Transaction:", tx.hash);
    console.log("Vault rewards:", ethers.formatEther(rewards), "mUSD");
    console.log("Reward transfer completed!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
