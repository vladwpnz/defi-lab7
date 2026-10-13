
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract AutoCompoundVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlyingAsset;
    IERC20 public immutable rewardToken;
    IUniswapV2Router02 public immutable router;

    event Deposited(
        address indexed user,
        uint256 assets,
        uint256 shares
    );

    event Withdrawn(
        address indexed user,
        uint256 assets,
        uint256 shares
    );

    event Compounded(
        uint256 rewardsSold,
        uint256 assetsReceived
    );

    constructor(
        address assetAddress,
        address rewardAddress,
        address routerAddress
    ) ERC20("Spiridonov Vault VLC", "vVLC") {
        require(assetAddress != address(0), "Invalid asset");
        require(rewardAddress != address(0), "Invalid reward");
        require(routerAddress != address(0), "Invalid router");
        require(assetAddress != rewardAddress, "Same tokens");

        underlyingAsset = IERC20(assetAddress);
        rewardToken = IERC20(rewardAddress);
        router = IUniswapV2Router02(routerAddress);
    }

    function totalAssets() public view returns (uint256) {
        return underlyingAsset.balanceOf(address(this));
    }

    function convertToShares(
        uint256 assets
    ) public view returns (uint256) {
        uint256 supply = totalSupply();

        if (supply == 0) {
            return assets;
        }

        return Math.mulDiv(
            assets,
            supply,
            totalAssets()
        );
    }

    function convertToAssets(
        uint256 shares
    ) public view returns (uint256) {
        uint256 supply = totalSupply();

        if (supply == 0) {
            return shares;
        }

        return Math.mulDiv(
            shares,
            totalAssets(),
            supply
        );
    }

    function deposit(
        uint256 assets
    ) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "Zero assets");

        shares = convertToShares(assets);
        require(shares > 0, "Zero shares");

        uint256 balanceBefore = totalAssets();

        underlyingAsset.safeTransferFrom(
            msg.sender,
            address(this),
            assets
        );

        require(
            totalAssets() - balanceBefore == assets,
            "Unexpected asset transfer"
        );

        _mint(msg.sender, shares);

        emit Deposited(msg.sender, assets, shares);
    }

    function withdraw(
        uint256 shares
    ) external nonReentrant returns (uint256 assets) {
        require(shares > 0, "Zero shares");

        assets = convertToAssets(shares);
        require(assets > 0, "Zero assets");

        _burn(msg.sender, shares);

        underlyingAsset.safeTransfer(
            msg.sender,
            assets
        );

        emit Withdrawn(msg.sender, assets, shares);
    }

    function compound()
        external
        nonReentrant
        returns (uint256 newAssets)
    {
        require(totalSupply() > 0, "No deposits");

        uint256 rewardBalance = rewardToken.balanceOf(
            address(this)
        );

        require(rewardBalance > 0, "No rewards to compound");

        uint256 initialAssets = totalAssets();

        rewardToken.forceApprove(
            address(router),
            rewardBalance
        );

        address[] memory path = new address[](2);
        path[0] = address(rewardToken);
        path[1] = address(underlyingAsset);

        uint256[] memory expected = router.getAmountsOut(
            rewardBalance,
            path
        );

        uint256 amountOutMin = expected[1] * 99 / 100;
        require(amountOutMin > 0, "Output too small");

        router.swapExactTokensForTokens(
            rewardBalance,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );

        newAssets = totalAssets() - initialAssets;
        require(newAssets > 0, "No assets received");

        emit Compounded(rewardBalance, newAssets);
    }
}
