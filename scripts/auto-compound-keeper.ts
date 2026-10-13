
import { network } from "hardhat";
import { readFileSync } from "node:fs";

const CHECK_INTERVAL = 15000;
const MIN_REWARDS = "50";
const EXECUTE = process.env.KEEPER_EXECUTE === "1";

async function main() {
    const { ethers, networkName } = await network.create();

    if (networkName !== "sepolia") {
        throw new Error("Use Sepolia network");
    }

    const deployment = JSON.parse(
        readFileSync("vault-sepolia.json", "utf8")
    );

    const [keeper] = await ethers.getSigners();

    const vault = await ethers.getContractAt(
        "AutoCompoundVault",
        deployment.vault
    );

    const rewardToken = await ethers.getContractAt(
        "MockUSD",
        deployment.rewardToken
    );

    const decimals = Number(await rewardToken.decimals());
    const threshold = ethers.parseUnits(MIN_REWARDS, decimals);

    let isChecking = false;

    console.log("=== AUTO COMPOUND KEEPER ===");
    console.log("Network:", networkName);
    console.log("Keeper:", keeper.address);
    console.log("Vault:", deployment.vault);
    console.log("Reward threshold:", MIN_REWARDS, "mUSD");
    console.log("Mode:", EXECUTE ? "LIVE" : "DRY RUN");
    console.log("Checking every 15 seconds...");
    console.log("Press Ctrl+C to stop.\n");

    async function checkRewards() {
        if (isChecking) return;

        isChecking = true;

        try {
            const shares = await vault.totalSupply();

            const rewards = await rewardToken.balanceOf(
                deployment.vault
            );

            console.log(
                `[${new Date().toLocaleTimeString()}] Rewards:`,
                ethers.formatUnits(rewards, decimals),
                "mUSD"
            );

            if (shares === 0n) {
                console.log("No active deposits. Waiting...");
                return;
            }

            if (rewards < threshold) {
                console.log("Reward threshold not reached.");
                return;
            }

            console.log("Reward threshold reached!");

            if (!EXECUTE) {
                console.log("Dry run: transaction not sent.");
                return;
            }

            const nonce = await ethers.provider.getTransactionCount(
                keeper.address,
                "pending"
            );

            const tx = await vault.compound({ nonce });

            console.log("Compound transaction:", tx.hash);
            console.log("Waiting for confirmation...");

            const receipt = await tx.wait();

            if (!receipt || receipt.status !== 1) {
                throw new Error("Compound transaction failed");
            }

            console.log("Compounding completed successfully!");

        } catch (error) {
            console.error("Keeper error:", error);
        } finally {
            isChecking = false;
        }
    }

    await checkRewards();

    setInterval(() => {
        void checkRewards();
    }, CHECK_INTERVAL);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
