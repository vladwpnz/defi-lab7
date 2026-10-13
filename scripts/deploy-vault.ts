
import { network } from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
    const { ethers, networkName } = await network.create();

    if (networkName !== "sepolia") {
        throw new Error("Use Sepolia network");
    }

    const addresses = JSON.parse(
        readFileSync("deployments-sepolia.json", "utf8")
    );

    const [deployer] = await ethers.getSigners();

    console.log("Network:", networkName);
    console.log("Deployer:", deployer.address);
    console.log("Base token (VLC):", addresses.vlc);
    console.log("Reward token (mUSD):", addresses.musd);
    console.log("Uniswap Router:", addresses.router);

    for (const [name, address] of [
        ["VLC", addresses.vlc],
        ["mUSD", addresses.musd],
        ["Router", addresses.router]
    ] as const) {
        if (!ethers.isAddress(address)) {
            throw new Error(`Invalid ${name} address`);
        }

        const code = await ethers.provider.getCode(address);

        if (code === "0x") {
            throw new Error(`${name} contract not found`);
        }
    }

    console.log("Deploying AutoCompoundVault...");

    const vault = await ethers.deployContract(
        "AutoCompoundVault",
        [
            addresses.vlc,
            addresses.musd,
            addresses.router
        ]
    );

    await vault.waitForDeployment();

    const vaultAddress = await vault.getAddress();

    const deployment = {
        network: networkName,
        vault: vaultAddress,
        underlyingAsset: addresses.vlc,
        rewardToken: addresses.musd,
        router: addresses.router
    };

    writeFileSync(
        "vault-sepolia.json",
        JSON.stringify(deployment, null, 2)
    );

    console.log("Vault deployed successfully!");
    console.log("Vault address:", vaultAddress);
    console.log("Deployment transaction:", vault.deploymentTransaction()?.hash);
    console.log("Saved to vault-sepolia.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
