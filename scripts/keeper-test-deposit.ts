
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

    const vault = await ethers.getContractAt(
        "AutoCompoundVault",
        deployment.vault
    );

    const amount = ethers.parseEther("1000");

    if (
        await vault.totalSupply() !== 0n ||
        await vault.totalAssets() !== 0n
    ) {
        throw new Error("Vault is not empty");
    }

    if (await vlc.balanceOf(investor.address) < amount) {
        throw new Error("Insufficient VLC balance");
    }

    let nonce = await ethers.provider.getTransactionCount(
        investor.address,
        "pending"
    );

    const allowance = await vlc.allowance(
        investor.address,
        deployment.vault
    );

    if (allowance < amount) {
        const approveTx = await vlc.approve(
            deployment.vault,
            amount,
            { nonce: nonce++ }
        );

        await approveTx.wait();
        console.log("VLC approved:", approveTx.hash);
    }

    const depositTx = await vault.deposit(
        amount,
        { nonce: nonce++ }
    );

    await depositTx.wait();

    console.log("=== KEEPER TEST DEPOSIT ===");
    console.log("Deposited: 1000 VLC");
    console.log(
        "Shares:",
        ethers.formatEther(
            await vault.balanceOf(investor.address)
        ),
        "vVLC"
    );
    console.log("Transaction:", depositTx.hash);
    console.log("Deposit completed!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
