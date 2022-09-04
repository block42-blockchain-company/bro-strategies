//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../../strategies/cash/CashStorageLib.sol";
import "../../../common/bases/StrategyOwnablePausableBaseUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract CashV2 is UUPSUpgradeable, StrategyOwnablePausableBaseUpgradeable {
    // solhint-disable-next-line const-name-snakecase
    string public constant name = "block42.cash_strategy.cash_strategy_initial";
    // solhint-disable-next-line const-name-snakecase
    string public constant humanReadableName = "Cash strategy";
    // solhint-disable-next-line const-name-snakecase
    string public constant version = "2.0.0";

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(StrategyArgs calldata strategyArgs)
        external
        reinitializer(2)
    {
        __StrategyOwnablePausableBaseUpgradeable_init(strategyArgs);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _deposit(
        uint256 amount,
        NameValuePair[] calldata /* params */
    ) internal virtual override {
        CashStorage storage strategyStorage = CashStorageLib.getStorage();
        strategyStorage.balance += amount;
    }

    function _beforeWithdraw(uint256, NameValuePair[] calldata)
        internal
        virtual
        override
        returns (uint256)
    {
        return 0;
    }

    function _withdraw(uint256 amount, NameValuePair[] calldata)
        internal
        virtual
        override
    {
        CashStorage storage strategyStorage = CashStorageLib.getStorage();
        strategyStorage.balance -= amount;
    }

    function _afterWithdraw(uint256 amount, NameValuePair[] calldata)
        internal
        virtual
        override
        returns (uint256)
    {
        return amount;
    }

    function _reapReward(NameValuePair[] calldata params)
        internal
        virtual
        override
    {}

    function getAssetBalances()
        external
        view
        virtual
        override
        returns (Balance[] memory assetBalances)
    {
        CashStorage storage strategyStorage = CashStorageLib.getStorage();
        assetBalances = new Balance[](1);
        assetBalances[0] = Balance(
            address(depositToken),
            strategyStorage.balance
        );
    }

    function getLiabilityBalances()
        external
        view
        virtual
        override
        returns (Balance[] memory liabilityBalances)
    {}

    function getAssetValuations(
        bool, /*shouldMaximise*/
        bool /*shouldIncludeAmmPrice*/
    )
        public
        view
        virtual
        override
        returns (Valuation[] memory assetValuations)
    {
        CashStorage storage strategyStorage = CashStorageLib.getStorage();
        assetValuations = new Valuation[](1);
        assetValuations[0] = Valuation(
            address(depositToken),
            strategyStorage.balance
        );
    }

    function getLiabilityValuations(
        bool, /*shouldMaximise*/
        bool /*shouldIncludeAmmPrice*/
    )
        public
        view
        virtual
        override
        returns (Valuation[] memory liabilityValuations)
    {}
}