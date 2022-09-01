//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../strategies/traderjoe/TraderJoeStorageLib.sol";
import "../../common/bases/StrategyOwnablePausableBaseUpgradeable.sol";
import "../../dependencies/traderjoe/ITraderJoeMasterChef.sol";
import "../../dependencies/traderjoe/ITraderJoeRouter.sol";
import "../../dependencies/traderjoe/ITraderJoePair.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract TraderJoeV2 is
    UUPSUpgradeable,
    StrategyOwnablePausableBaseUpgradeable
{
    using SafeERC20Upgradeable for IInvestmentToken;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    error InvalidTraderJoeLpToken();

    // solhint-disable-next-line const-name-snakecase
    string public constant name =
        "brokkr.traderjoe_strategy.traderjoe_strategy_v2.0.0";
    // solhint-disable-next-line const-name-snakecase
    string public constant humanReadableName = "TraderJoe Strategy";
    // solhint-disable-next-line const-name-snakecase
    string public constant version = "2.0.0";

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        StrategyArgs calldata strategyArgs,
        ITraderJoeRouter router,
        ITraderJoeMasterChef masterChef,
        ITraderJoePair lpToken,
        IERC20Upgradeable joeToken
    ) external reinitializer(2) {
        __StrategyOwnablePausableBaseUpgradeable_init(strategyArgs);

        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        strategyStorage.router = router;
        strategyStorage.masterChef = masterChef;
        strategyStorage.lpToken = lpToken;
        strategyStorage.joeToken = joeToken;

        address token0 = lpToken.token0();
        if (token0 != address(depositToken)) {
            strategyStorage.pairDepositToken = IERC20Upgradeable(token0);
        } else {
            strategyStorage.pairDepositToken = IERC20Upgradeable(
                lpToken.token1()
            );
        }

        ITraderJoeMasterChef.PoolInfo memory poolInfo;
        uint256 poolLength = masterChef.poolLength();
        for (uint256 i = 0; i < poolLength; i++) {
            poolInfo = masterChef.poolInfo(i);
            if (address(poolInfo.lpToken) == address(lpToken)) {
                strategyStorage.farmId = i;
                break;
            }
        }
        if (address(poolInfo.lpToken) != address(lpToken)) {
            revert InvalidTraderJoeLpToken();
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _deposit(uint256 amount, NameValuePair[] calldata)
        internal
        virtual
        override
    {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        (
            uint256 depositTokenReserve,
            uint256 pairDepositTokenReserve
        ) = getTraderJoeLpReserves();

        uint256 swapAmount = (amount * pairDepositTokenReserve) /
            (depositTokenReserve + pairDepositTokenReserve);
        address[] memory path = new address[](2);
        path[0] = address(depositToken);
        path[1] = address(strategyStorage.pairDepositToken);

        uint256 pairDepositTokenDesired = swapExactTokensForTokens(
            swapService,
            swapAmount,
            path
        );
        uint256 depositTokenDesired = amount - swapAmount;
        uint256 pairDepositTokenMin = pairDepositTokenDesired;
        uint256 depositTokenMin = (pairDepositTokenDesired *
            depositTokenReserve) / pairDepositTokenReserve;

        strategyStorage.pairDepositToken.approve(
            address(strategyStorage.router),
            pairDepositTokenDesired
        );
        depositToken.approve(
            address(strategyStorage.router),
            depositTokenDesired
        );
        (, , uint256 lpBalance) = strategyStorage.router.addLiquidity(
            address(strategyStorage.pairDepositToken),
            address(depositToken),
            pairDepositTokenDesired,
            depositTokenDesired,
            pairDepositTokenMin,
            depositTokenMin,
            address(this),
            block.timestamp
        );

        strategyStorage.lpToken.approve(
            address(strategyStorage.masterChef),
            lpBalance
        );
        strategyStorage.masterChef.deposit(strategyStorage.farmId, lpBalance);
    }

    function _withdraw(uint256 amount, NameValuePair[] calldata)
        internal
        virtual
        override
    {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        uint256 lpBalanceToWithdraw = (getTraderJoeLpBalance() * amount) /
            getInvestmentTokenSupply();

        (
            uint256 depositTokenReserve,
            uint256 pairDepositTokenReserve
        ) = getTraderJoeLpReserves();
        uint256 lpTotalSupply = strategyStorage.lpToken.totalSupply();
        uint256 pairDepositTokenMin = (lpBalanceToWithdraw *
            pairDepositTokenReserve) / lpTotalSupply;
        uint256 depositTokenMin = (lpBalanceToWithdraw * depositTokenReserve) /
            lpTotalSupply;

        uint256 pairDepositTokenBalanceBefore = strategyStorage
            .pairDepositToken
            .balanceOf(address(this));
        strategyStorage.masterChef.withdraw(
            strategyStorage.farmId,
            lpBalanceToWithdraw
        );
        strategyStorage.lpToken.approve(
            address(strategyStorage.router),
            lpBalanceToWithdraw
        );
        strategyStorage.router.removeLiquidity(
            address(strategyStorage.pairDepositToken),
            address(depositToken),
            lpBalanceToWithdraw,
            pairDepositTokenMin,
            depositTokenMin,
            address(this),
            block.timestamp
        );
        uint256 pairDepositTokenBalanceAfter = strategyStorage
            .pairDepositToken
            .balanceOf(address(this));

        uint256 pairDepositTokenBalanceIncrement = pairDepositTokenBalanceAfter -
                pairDepositTokenBalanceBefore;
        address[] memory path = new address[](2);
        path[0] = address(strategyStorage.pairDepositToken);
        path[1] = address(depositToken);

        swapExactTokensForTokens(
            swapService,
            pairDepositTokenBalanceIncrement,
            path
        );
    }

    function _reapReward(NameValuePair[] calldata) internal virtual override {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        strategyStorage.masterChef.deposit(strategyStorage.farmId, 0);

        address[] memory path = new address[](3);
        path[0] = address(strategyStorage.joeToken);
        path[1] = address(0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7); // USDT
        path[2] = address(depositToken);

        swapExactTokensForTokens(
            swapService,
            strategyStorage.joeToken.balanceOf(address(this)),
            path
        );
    }

    function getAssetBalances()
        external
        view
        virtual
        override
        returns (Balance[] memory assetBalances)
    {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        assetBalances = new Balance[](1);
        assetBalances[0] = Balance(
            address(strategyStorage.lpToken),
            getTraderJoeLpBalance()
        );
    }

    function getLiabilityBalances()
        external
        view
        virtual
        override
        returns (Balance[] memory liabilityBalances)
    {}

    function getAssetValuations(bool shouldMaximise, bool shouldIncludeAmmPrice)
        public
        view
        virtual
        override
        returns (Valuation[] memory assetValuations)
    {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        (
            uint256 depositTokenReserve,
            uint256 pairDepositTokenReserve
        ) = getTraderJoeLpReserves();

        uint256 lpBalance = getTraderJoeLpBalance();
        uint256 lpTotalSupply = strategyStorage.lpToken.totalSupply();

        uint256 depositTokenValuation = (lpBalance * depositTokenReserve) /
            lpTotalSupply;
        uint256 pairDepositTokenValuation = (((lpBalance *
            pairDepositTokenReserve) / lpTotalSupply) *
            priceOracle.getPrice(
                depositToken, //strategyStorage.pairDepositToken,
                shouldMaximise,
                shouldIncludeAmmPrice
            )) / InvestableLib.PRICE_PRECISION_FACTOR;

        assetValuations = new Valuation[](1);
        assetValuations[0] = Valuation(
            address(strategyStorage.lpToken),
            depositTokenValuation + pairDepositTokenValuation
        );
    }

    function getLiabilityValuations(bool, bool)
        public
        view
        virtual
        override
        returns (Valuation[] memory liabilityValuations)
    {}

    function getTraderJoeLpBalance() public view returns (uint256) {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        return
            strategyStorage
                .masterChef
                .userInfo(strategyStorage.farmId, address(this))
                .amount;
    }

    function getTraderJoeLpReserves()
        public
        view
        returns (uint256 depositTokenReserve, uint256 pairDepositTokenReserve)
    {
        TraderJoeStorage storage strategyStorage = TraderJoeStorageLib
            .getStorage();

        (uint256 reserve0, uint256 reserve1, ) = strategyStorage
            .lpToken
            .getReserves();

        if (strategyStorage.lpToken.token0() == address(depositToken)) {
            return (reserve0, reserve1);
        } else {
            return (reserve1, reserve0);
        }
    }
}