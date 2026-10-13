
import { network } from "hardhat";
import { readFileSync } from "node:fs";

async function main() {
    const { ethers } = await network.create();
    const [investor] = await ethers.getSigners();

    const addresses = JSON.parse(
        readFileSync("deployments-sepolia.json", "utf8")
    );

    const deployment = JSON.parse(
        readFileSync("vault-sepolia.json", "utf8")
    );

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

    console.log("Investor:", investor.address);

    console.log(
        "Latest nonce:",
        await ethers.provider.send(
            "eth_getTransactionCount",
            [investor.address, "latest"]
        )
    );

    console.log(
        "Pending nonce:",
        await ethers.provider.send(
            "eth_getTransactionCount",
            [investor.address, "pending"]
        )
    );

    console.log(
        "VLC approved:",
        ethers.formatEther(
            await vlc.allowance(investor.address, deployment.vault)
        )
    );

    console.log(
        "Shares:",
        ethers.formatEther(
            await vault.balanceOf(investor.address)
        )
    );

    console.log(
        "Vault assets:",
        ethers.formatEther(await vault.totalAssets())
    );

    console.log(
        "Vault rewards:",
        ethers.formatEther(
            await musd.balanceOf(deployment.vault)
        )
    );
}

main().catch(console.error);
