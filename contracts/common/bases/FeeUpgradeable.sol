//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../interfaces/IFee.sol";
import "../libraries/Math.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

abstract contract FeeUpgradeable is ContextUpgradeable, IFee {
    uint24 internal withdrawalFee;
    uint24 internal depositFee;
    uint24 internal performanceFee;
    uint256 public currentAccumulatedFee;
    uint256 public claimedFee;
    address public feeReceiver;

    // solhint-disable-next-line func-name-mixedcase
    function __FeeOwnableUpgradeable_init(
        uint24 depositFee_,
        uint24 withdrawalFee_,
        uint24 performanceFee_
    ) internal onlyInitializing {
        __Context_init();
        setDepositFee(depositFee_);
        setWithdrawalFee(withdrawalFee_);
        setPerformanceFee(performanceFee_);
        setFeeReceiver(_msgSender());
    }

    modifier checkFee() {
        _;

        if (
            withdrawalFee + depositFee + performanceFee >=
            uint256(100) * Math.SHORT_FIXED_DECIMAL_FACTOR
        ) revert InvalidFeeError();
    }

    function getDepositFee() external virtual override returns (uint24) {
        return depositFee;
    }

    function setDepositFee(uint24 fee) public virtual override checkFee {
        depositFee = fee;
        emit DepositFeeChange(depositFee);
    }

    function getWithdrawalFee() external virtual override returns (uint24) {
        return withdrawalFee;
    }

    function setWithdrawalFee(uint24 fee) public virtual override checkFee {
        withdrawalFee = fee;
        emit WithdrawalFeeChange(withdrawalFee);
    }

    function getPerformanceFee() external virtual override returns (uint24) {
        return performanceFee;
    }

    function setPerformanceFee(uint24 fee) public virtual override checkFee {
        performanceFee = fee;
        emit PerformanceFeeChange(performanceFee);
    }

    function setFeeReceiver(address feeReceiver_) public virtual override {
        feeReceiver = feeReceiver_;
        emit FeeReceiverChange(feeReceiver);
    }
}
