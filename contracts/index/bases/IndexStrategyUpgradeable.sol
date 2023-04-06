// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { ERC165Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import { MathUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import { IIndexInit } from "../interfaces/IIndexInit.sol";
import { IIndexLimits } from "../interfaces/IIndexLimits.sol";
import { IIndexOracle } from "../interfaces/IIndexOracle.sol";
import { IIndexStrategy } from "../interfaces/IIndexStrategy.sol";
import { IIndexToken } from "../interfaces/IIndexToken.sol";
import { Constants } from "../libraries/Constants.sol";
import { Errors } from "../libraries/Errors.sol";
import { SwapAdapter } from "../libraries/SwapAdapter.sol";

abstract contract IndexStrategyUpgradeable is
    ERC165Upgradeable,
    ReentrancyGuardUpgradeable,
    ContextUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    IIndexInit,
    IIndexLimits,
    IIndexStrategy
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SwapAdapter for SwapAdapter.Setup;

    struct MintingData {
        uint256 amountIndex;
        uint256 amountWNATIVETotal;
        uint256[] amountWNATIVEs;
        address[] bestRouters;
        uint256[] amountComponents;
    }

    address public wNATIVE;

    address[] public whitelistedTokens;
    IIndexToken public indexToken;

    address[] public components;
    mapping(address => uint256) public weights; // A mapping from `component` to its `weight`.
    mapping(address => address[]) public routers; // A mapping from `token` to its list of `routers`.
    mapping(address => SwapAdapter.DEX) public dexs; // A mapping from `router` to its type of `DEX`.
    mapping(address => mapping(address => mapping(address => SwapAdapter.PairData))) // A mapping from `router`, `tokenIn` and `tokenOut` to `PairData`.
        public pairData;

    IIndexOracle public oracle;
    uint256 public equityValuationLimit;

    uint256[8] private __gap;

    modifier onlyWhitelistedToken(address token) {
        if (!isTokenWhitelisted(token)) {
            revert Errors.Index_NotWhitelistedToken(token);
        }

        _;
    }

    modifier whenNotReachedEquityValuationLimit() {
        _;

        if (equityValuation(true, true) > equityValuationLimit) {
            revert Errors.Index_ExceedEquityValuationLimit();
        }
    }

    // solhint-disable-next-line
    function __IndexStrategyUpgradeable_init(
        IndexStrategyInitParams calldata initParams
    ) internal onlyInitializing {
        __ERC165_init();
        __ReentrancyGuard_init();
        __Context_init();
        __Ownable_init();
        __Pausable_init();

        wNATIVE = initParams.wNATIVE;

        indexToken = IIndexToken(initParams.indexToken);

        for (uint256 i = 0; i < initParams.components.length; i++) {
            components.push(initParams.components[i].token);

            _setWeight(
                initParams.components[i].token,
                initParams.components[i].weight
            );
        }

        for (uint256 i = 0; i < initParams.swapRoutes.length; i++) {
            addSwapRoute(
                initParams.swapRoutes[i].token0,
                initParams.swapRoutes[i].token1,
                initParams.swapRoutes[i].router,
                initParams.swapRoutes[i].dex,
                initParams.swapRoutes[i].pairData
            );
        }

        addWhitelistedTokens(initParams.whitelistedTokens);

        setOracle(initParams.oracle);

        setEquityValuationLimit(initParams.equityValuationLimit);
    }

    function pause() external onlyOwner {
        super._pause();
    }

    function unpause() external onlyOwner {
        super._unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        return
            interfaceId == type(IIndexStrategy).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function mintIndexFromToken(
        address token,
        uint256 amountTokenMax,
        uint256 amountIndexMin,
        address recipient
    )
        external
        nonReentrant
        whenNotPaused
        onlyWhitelistedToken(token)
        whenNotReachedEquityValuationLimit
        returns (uint256 amountIndex, uint256 amountToken)
    {
        if (recipient == address(0)) {
            revert Errors.Index_ZeroAddress();
        }

        address bestRouter;
        MintingData memory mintingData;

        (amountToken, bestRouter, mintingData) = _getMintingDataFromToken(
            token,
            amountTokenMax
        );

        if (amountToken > amountTokenMax) {
            revert Errors.Index_AboveMaxAmount();
        }

        if (mintingData.amountIndex < amountIndexMin) {
            revert Errors.Index_BelowMinAmount();
        }

        amountIndex = mintingData.amountIndex;

        IERC20Upgradeable(token).safeTransferFrom(
            _msgSender(),
            address(this),
            amountToken
        );

        uint256 amountTokenSpent = _swapTokenForExactToken(
            bestRouter,
            mintingData.amountWNATIVETotal,
            amountToken,
            token,
            wNATIVE
        );

        if (amountTokenSpent != amountToken) {
            revert Errors.Index_WrongSwapAmount();
        }

        uint256 amountWNATIVESpent = _mintExactIndexFromWNATIVE(
            mintingData,
            recipient
        );

        if (amountWNATIVESpent != mintingData.amountWNATIVETotal) {
            revert Errors.Index_WrongSwapAmount();
        }

        emit Mint(_msgSender(), recipient, token, amountToken, amountIndex);
    }

    function burnExactIndexForToken(
        address token,
        uint256 amountTokenMin,
        uint256 amountIndex,
        address recipient
    )
        external
        nonReentrant
        whenNotPaused
        onlyWhitelistedToken(token)
        returns (uint256 amountToken)
    {
        if (recipient == address(0)) {
            revert Errors.Index_ZeroAddress();
        }

        uint256 amountWNATIVE = _burnExactIndexForWNATIVE(amountIndex);

        (uint256 amountTokenOut, address bestRouter) = _getAmountOutMax(
            routers[token],
            amountWNATIVE,
            wNATIVE,
            token
        );

        amountToken = _swapExactTokenForToken(
            bestRouter,
            amountWNATIVE,
            amountTokenOut,
            wNATIVE,
            token
        );

        if (amountToken != amountTokenOut) {
            revert Errors.Index_WrongSwapAmount();
        }

        if (amountToken < amountTokenMin) {
            revert Errors.Index_BelowMinAmount();
        }

        IERC20Upgradeable(token).safeTransfer(recipient, amountToken);

        emit Burn(_msgSender(), recipient, token, amountToken, amountIndex);
    }

    function getAmountIndexFromToken(address token, uint256 amountTokenMax)
        external
        view
        onlyWhitelistedToken(token)
        returns (uint256 amountIndex, uint256 amountToken)
    {
        MintingData memory mintingData;

        (amountToken, , mintingData) = _getMintingDataFromToken(
            token,
            amountTokenMax
        );

        amountIndex = mintingData.amountIndex;
    }

    function getAmountTokenFromExactIndex(address token, uint256 amountIndex)
        external
        view
        onlyWhitelistedToken(token)
        returns (uint256 amountToken)
    {
        uint256 amountWNATIVE = _getAmountWNATIVEFromExactIndex(amountIndex);

        (amountToken, ) = _getAmountOutMax(
            routers[token],
            amountWNATIVE,
            wNATIVE,
            token
        );
    }

    function setOracle(address _oracle) public onlyOwner {
        oracle = IIndexOracle(_oracle);
    }

    function addSwapRoute(
        address token0,
        address token1,
        address router,
        SwapAdapter.DEX dex,
        SwapAdapter.PairData memory _pairData
    ) public onlyOwner {
        _addRouter(token0, router);
        _addRouter(token1, router);

        _setDEX(router, dex);

        _setPairData(router, token0, token1, _pairData);
    }

    function addWhitelistedTokens(address[] memory tokens) public onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (!isTokenWhitelisted(tokens[i])) {
                whitelistedTokens.push(tokens[i]);
            }
        }
    }

    function removeWhitelistedTokens(address[] memory tokens) public onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            for (uint256 j = 0; j < whitelistedTokens.length; j++) {
                if (whitelistedTokens[j] == tokens[i]) {
                    whitelistedTokens[j] = whitelistedTokens[
                        whitelistedTokens.length - 1
                    ];
                    whitelistedTokens.pop();
                    break;
                }
            }
        }
    }

    function setEquityValuationLimit(uint256 _equityValuationLimit)
        public
        onlyOwner
    {
        equityValuationLimit = _equityValuationLimit;
    }

    function allComponents() external view override returns (address[] memory) {
        return components;
    }

    function allWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokens;
    }

    function equityValuation(bool maximize, bool includeAmmPrice)
        public
        view
        virtual
        returns (uint256);

    function isTokenWhitelisted(address token) public view returns (bool) {
        for (uint256 i = 0; i < whitelistedTokens.length; i++) {
            if (whitelistedTokens[i] == token) {
                return true;
            }
        }

        return false;
    }

    function _mintExactIndexFromWNATIVE(
        MintingData memory mintingData,
        address recipient
    ) internal returns (uint256 amountWNATIVESpent) {
        for (uint256 i = 0; i < components.length; i++) {
            if (mintingData.amountComponents[i] == 0) {
                revert Errors.Index_TooSmallAmountIndex();
            }

            amountWNATIVESpent += _swapTokenForExactToken(
                mintingData.bestRouters[i],
                mintingData.amountComponents[i],
                mintingData.amountWNATIVEs[i],
                wNATIVE,
                components[i]
            );
        }

        indexToken.mint(recipient, mintingData.amountIndex);
    }

    function _burnExactIndexForWNATIVE(uint256 amountIndex)
        internal
        returns (uint256 amountWNATIVE)
    {
        for (uint256 i = 0; i < components.length; i++) {
            uint256 amountComponent = (amountIndex * weights[components[i]]) /
                Constants.PRECISION;

            if (amountComponent == 0) {
                revert Errors.Index_TooSmallAmountIndex();
            }

            (uint256 amountWNATIVEOut, address bestRouter) = _getAmountOutMax(
                routers[components[i]],
                amountComponent,
                components[i],
                wNATIVE
            );

            amountWNATIVE += _swapExactTokenForToken(
                bestRouter,
                amountComponent,
                amountWNATIVEOut,
                components[i],
                wNATIVE
            );
        }

        indexToken.burnFrom(_msgSender(), amountIndex);
    }

    function _getMintingDataForExactIndex(uint256 amountIndex)
        internal
        view
        returns (MintingData memory mintingData)
    {
        mintingData.amountIndex = amountIndex;
        mintingData.amountWNATIVEs = new uint256[](components.length);
        mintingData.bestRouters = new address[](components.length);
        mintingData.amountComponents = new uint256[](components.length);

        for (uint256 i = 0; i < components.length; i++) {
            mintingData.amountComponents[i] =
                (amountIndex * weights[components[i]]) /
                Constants.PRECISION;

            (
                mintingData.amountWNATIVEs[i],
                mintingData.bestRouters[i]
            ) = _getAmountInMin(
                routers[components[i]],
                mintingData.amountComponents[i],
                wNATIVE,
                components[i]
            );

            mintingData.amountWNATIVETotal += mintingData.amountWNATIVEs[i];
        }
    }

    function _getMintingDataFromToken(address token, uint256 amountTokenMax)
        internal
        view
        returns (
            uint256 amountToken,
            address bestRouter,
            MintingData memory mintingData
        )
    {
        (uint256 amountWNATIVE, ) = _getAmountOutMax(
            routers[token],
            amountTokenMax,
            token,
            wNATIVE
        );

        mintingData = _getMintingDataFromWNATIVE(amountWNATIVE);

        (amountToken, bestRouter) = _getAmountInMin(
            routers[token],
            mintingData.amountWNATIVETotal,
            token,
            wNATIVE
        );
    }

    function _getMintingDataFromWNATIVE(uint256 amountWNATIVEMax)
        internal
        view
        returns (MintingData memory mintingData)
    {
        MintingData memory mintingDataUnit = _getMintingDataForExactIndex(
            Constants.PRECISION
        );

        uint256 amountIndex = type(uint256).max;

        for (uint256 i = 0; i < components.length; i++) {
            uint256 amountWNATIVE = (amountWNATIVEMax *
                mintingDataUnit.amountWNATIVEs[i]) /
                mintingDataUnit.amountWNATIVETotal;

            (uint256 amountComponent, ) = _getAmountOutMax(
                routers[components[i]],
                amountWNATIVE,
                wNATIVE,
                components[i]
            );

            amountIndex = MathUpgradeable.min(
                amountIndex,
                (amountComponent * Constants.PRECISION) / weights[components[i]]
            );
        }

        mintingData = _getMintingDataForExactIndex(amountIndex);
    }

    function _getAmountWNATIVEFromExactIndex(uint256 amountIndex)
        internal
        view
        returns (uint256 amountWNATIVE)
    {
        for (uint256 i = 0; i < components.length; i++) {
            uint256 amountComponent = (amountIndex * weights[components[i]]) /
                Constants.PRECISION;

            (uint256 amountWNATIVEOut, ) = _getAmountOutMax(
                routers[components[i]],
                amountComponent,
                components[i],
                wNATIVE
            );

            amountWNATIVE += amountWNATIVEOut;
        }
    }

    function _setWeight(address token, uint256 weight) internal {
        weights[token] = weight;
    }

    function _addRouter(address token, address router) internal {
        for (uint256 i = 0; i < routers[token].length; i++) {
            if (routers[token][i] == router) {
                return;
            }
        }

        routers[token].push(router);
    }

    function _setDEX(address router, SwapAdapter.DEX dex) internal {
        if (dexs[router] != SwapAdapter.DEX.None) {
            return;
        }

        dexs[router] = dex;
    }

    function _setPairData(
        address router,
        address token0,
        address token1,
        SwapAdapter.PairData memory _pairData
    ) internal {
        if (pairData[router][token0][token1].pair != address(0)) {
            return;
        }

        pairData[router][token0][token1] = _pairData;
        pairData[router][token1][token0] = _pairData;
    }

    function _swapExactTokenForToken(
        address router,
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address tokenOut
    ) internal returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        amountOut = SwapAdapter
            .Setup(dexs[router], router, pairData[router][tokenIn][tokenOut])
            .swapExactTokensForTokens(amountIn, amountOutMin, path);
    }

    function _swapTokenForExactToken(
        address router,
        uint256 amountOut,
        uint256 amountInMax,
        address tokenIn,
        address tokenOut
    ) internal returns (uint256 amountIn) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        amountIn = SwapAdapter
            .Setup(dexs[router], router, pairData[router][tokenIn][tokenOut])
            .swapTokensForExactTokens(amountOut, amountInMax, path);
    }

    function _getAmountOutMax(
        address[] memory _routers,
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256 amountOutMax, address bestRouter) {
        if (tokenIn == tokenOut) {
            return (amountIn, address(0));
        }

        if (_routers.length == 0) {
            revert Errors.Index_WrongPair(tokenIn, tokenOut);
        }

        amountOutMax = type(uint256).min;

        for (uint256 i = 0; i < _routers.length; i++) {
            address router = _routers[i];

            uint256 amountOut = SwapAdapter
                .Setup(
                    dexs[router],
                    router,
                    pairData[router][tokenIn][tokenOut]
                )
                .getAmountOut(amountIn, tokenIn, tokenOut);

            if (amountOut > amountOutMax) {
                amountOutMax = amountOut;
                bestRouter = router;
            }
        }
    }

    function _getAmountInMin(
        address[] memory _routers,
        uint256 amountOut,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256 amountInMin, address bestRouter) {
        if (tokenIn == tokenOut) {
            return (amountOut, address(0));
        }

        if (_routers.length == 0) {
            revert Errors.Index_WrongPair(tokenIn, tokenOut);
        }

        amountInMin = type(uint256).max;

        for (uint256 i = 0; i < _routers.length; i++) {
            address router = _routers[i];

            uint256 amountIn = SwapAdapter
                .Setup(
                    dexs[router],
                    router,
                    pairData[router][tokenIn][tokenOut]
                )
                .getAmountIn(amountOut, tokenIn, tokenOut);

            if (amountIn < amountInMin) {
                amountInMin = amountIn;
                bestRouter = router;
            }
        }
    }
}
