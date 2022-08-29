import { expect } from "chai"
import { BigNumber } from "ethers"
import { ethers, upgrades } from "hardhat"
import { getErrorRange, airdropToken } from "../../shared/utils"
import { testStrategy } from "../Unified.test"

const ADDRESSES = {
  stargateRouter: "0x45a01e4e04f14f7a4a6702c74187c5f6222033cd",
  stargateUsdcPool: "0x1205f31718499dbf1fca446663b532ef87481fe1",
  stargateUsdtPool: "0x29e38769f23701a2e4a8ef0492e19da4604be62c",
  stargateLpStaking: "0x8731d54e9d02c286767d56ac03e8037c07e01e98",
  stargateUsdcLpToken: "0x1205f31718499dbf1fca446663b532ef87481fe1",
  stargateUsdtLpToken: "0x29e38769f23701a2e4a8ef0492e19da4604be62c",
  stargateStgToken: "0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590",
}

testStrategy(
  "Stargate USDC Strategy",
  "Stargate",
  [
    ADDRESSES.stargateRouter,
    ADDRESSES.stargateUsdcPool,
    ADDRESSES.stargateLpStaking,
    ADDRESSES.stargateUsdcLpToken,
    ADDRESSES.stargateStgToken,
  ],
  [testStargateUsdcAum, testStargateUsdcInitialize, testStargateUsdcDeposit]
)

testStrategy(
  "Stargate USDT Strategy",
  "Stargate",
  [
    ADDRESSES.stargateRouter,
    ADDRESSES.stargateUsdtPool,
    ADDRESSES.stargateLpStaking,
    ADDRESSES.stargateUsdtLpToken,
    ADDRESSES.stargateStgToken,
  ],
  [testStargateUsdtAum, testStargateUsdtInitialize, testStargateUsdtDeposit]
)

function testStargateUsdcAum() {
  describe("AUM - Stargate USDC Strategy Specific", async function () {
    it("should success after a single deposit", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))

      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("100", 6))
      await this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("100", 6), this.user0.address, [])

      const assetBalances = await this.strategy.getAssetBalances()
      expect(assetBalances[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdcLpToken.toLowerCase())
      expect(assetBalances[0].balance).to.approximately(
        ethers.utils.parseUnits("100", 6),
        getErrorRange(ethers.utils.parseUnits("100", 6))
      )

      expect(await this.strategy.getLiabilityBalances()).to.be.an("array").that.is.empty

      const assetValuations = await this.strategy.getAssetValuations(true, false)
      expect(assetValuations[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdcLpToken.toLowerCase())
      expect(assetValuations[0].valuation).to.approximately(
        ethers.utils.parseUnits("100", 6),
        getErrorRange(ethers.utils.parseUnits("100", 6))
      )

      expect(await this.strategy.getLiabilityValuations(true, false)).to.be.an("array").that.is.empty

      expect(await this.strategy.getEquityValuation(true, false)).to.approximately(
        ethers.utils.parseUnits("100", 6),
        getErrorRange(ethers.utils.parseUnits("100", 6))
      )
    })

    it("should success after multiple deposits and withdrawals", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))

      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("50", 6))
      await this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])

      await this.investmentToken.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("20", 6))
      await this.strategy.connect(this.user0).withdraw(ethers.utils.parseUnits("20", 6), this.user0.address, [])

      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("50", 6))
      await this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])

      await this.investmentToken.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("10", 6))
      await this.strategy.connect(this.user0).withdraw(ethers.utils.parseUnits("10", 6), this.user0.address, [])

      const assetBalances = await this.strategy.getAssetBalances()
      expect(assetBalances[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdcLpToken.toLowerCase())
      expect(assetBalances[0].balance).to.approximately(
        ethers.utils.parseUnits("70", 6),
        getErrorRange(ethers.utils.parseUnits("70", 6))
      )

      expect(await this.strategy.getLiabilityBalances()).to.be.an("array").that.is.empty

      const assetValuations = await this.strategy.getAssetValuations(true, false)
      expect(assetValuations[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdcLpToken.toLowerCase())
      expect(assetValuations[0].valuation).to.approximately(
        ethers.utils.parseUnits("70", 6),
        getErrorRange(ethers.utils.parseUnits("70", 6))
      )

      expect(await this.strategy.getLiabilityValuations(true, false)).to.be.an("array").that.is.empty

      expect(await this.strategy.getEquityValuation(true, false)).to.approximately(
        ethers.utils.parseUnits("70", 6),
        getErrorRange(ethers.utils.parseUnits("70", 6))
      )
    })
  })
}

function testStargateUsdcInitialize() {
  describe("Initialize - Stargate USDC Strategy Specific", async function () {
    it("should fail when passed wrong LP token address", async function () {
      await expect(
        upgrades.deployProxy(
          this.Strategy,
          [
            [
              this.investmentToken.address,
              this.usdc.address,
              this.depositFee,
              this.depositFeeParams,
              this.withdrawalFee,
              this.withdrawalFeeParams,
              this.performanceFee,
              this.performanceFeeParams,
              this.feeReceiver,
              this.feeReceiverParams,
              this.totalInvestmentLimit,
              this.investmentLimitPerAddress,
              this.priceOracle.address,
              this.swapServiceProvider,
              this.swapServiceRouter,
            ],
            ADDRESSES.stargateRouter,
            ADDRESSES.stargateUsdtPool,
            ADDRESSES.stargateLpStaking,
            this.usdc.address,
            ADDRESSES.stargateStgToken,
          ],
          { kind: "uups" }
        )
      ).to.be.revertedWithCustomError(this.strategy, "InvalidStargateLpToken")
    })
  })
}

function testStargateUsdcDeposit() {
  describe("Deposit - Stargate USDC Strategy Specific", async function () {
    it("should success when a single user deposits the possible minimum USDC", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))

      await this.usdc.connect(this.user0).approve(this.strategy.address, 1)
      await this.strategy.connect(this.user0).deposit(1, this.user0.address, [])

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("100", 6).sub(1))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(1)
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(1)
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        BigNumber.from(1),
        getErrorRange(BigNumber.from(1))
      )
    })

    it("should success when multiple users deposit the possible minimum USDC - 0", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user1, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user2, this.usdc, ethers.utils.parseUnits("100", 6))

      // The first user.
      await this.usdc.connect(this.user0).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user0).deposit(1, this.user0.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user0.address, this.user0.address, 1)

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("100", 6).sub(1))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(1)
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(1)
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        BigNumber.from(1),
        getErrorRange(BigNumber.from(1))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.strategy.address, ethers.utils.parseUnits("30", 6))
      await expect(this.strategy.connect(this.user1).deposit(ethers.utils.parseUnits("30", 6), this.user1.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("70", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
      expect(await this.strategy.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("30", 6).add(1),
        getErrorRange(ethers.utils.parseUnits("30", 6).add(1))
      )
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6).add(1),
        getErrorRange(ethers.utils.parseUnits("30", 6).add(1))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user2).deposit(1, this.user2.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user2.address, this.user2.address, 1)

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("100", 6).sub(1))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.be.approximately(
        BigNumber.from(1),
        getErrorRange(BigNumber.from(1))
      )
      expect(await this.strategy.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("30", 6).add(2),
        getErrorRange(ethers.utils.parseUnits("30", 6).add(2))
      )
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6).add(2),
        getErrorRange(ethers.utils.parseUnits("30", 6).add(2))
      )
    })

    it("should success when multiple users deposit the possible minimum USDC - 1", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user1, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user2, this.usdc, ethers.utils.parseUnits("100", 6))

      // The first user.
      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("30", 6))
      await expect(this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("30", 6), this.user0.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("70", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user1).deposit(1, this.user1.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user1.address, this.user1.address, 1)

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("100", 6).sub(1))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        BigNumber.from(1),
        getErrorRange(BigNumber.from(1))
      )
      expect(await this.strategy.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("30", 6).add(1),
        getErrorRange(ethers.utils.parseUnits("30", 6).add(1))
      )
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6).add(1),
        getErrorRange(ethers.utils.parseUnits("30", 6).add(1))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.strategy.address, ethers.utils.parseUnits("30", 6))
      await expect(this.strategy.connect(this.user2).deposit(ethers.utils.parseUnits("30", 6), this.user2.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user2.address, this.user2.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("70", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
      expect(await this.strategy.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("60", 6).add(1),
        getErrorRange(ethers.utils.parseUnits("60", 6).add(1))
      )
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("60", 6).add(1),
        getErrorRange(ethers.utils.parseUnits("60", 6).add(1))
      )
    })
  })
}

function testStargateUsdtAum() {
  describe("AUM - Stargate USDT Strategy Specific", async function () {
    it("should success after a single deposit", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))

      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("100", 6))
      await this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("100", 6), this.user0.address, [])

      const assetBalances = await this.strategy.getAssetBalances()
      expect(assetBalances[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdtLpToken.toLowerCase())
      expect(assetBalances[0].balance).to.approximately(
        ethers.utils.parseUnits("100", 6),
        getErrorRange(ethers.utils.parseUnits("100", 6))
      )

      expect(await this.strategy.getLiabilityBalances()).to.be.an("array").that.is.empty

      const assetValuations = await this.strategy.getAssetValuations(true, false)
      expect(assetValuations[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdtLpToken.toLowerCase())
      expect(assetValuations[0].valuation).to.approximately(
        ethers.utils.parseUnits("100", 6),
        getErrorRange(ethers.utils.parseUnits("100", 6))
      )

      expect(await this.strategy.getLiabilityValuations(true, false)).to.be.an("array").that.is.empty

      expect(await this.strategy.getEquityValuation(true, false)).to.approximately(
        ethers.utils.parseUnits("100", 6),
        getErrorRange(ethers.utils.parseUnits("100", 6))
      )
    })

    it("should success after multiple deposits and withdrawals", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))

      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("50", 6))
      await this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])

      await this.investmentToken.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("20", 6))
      await this.strategy.connect(this.user0).withdraw(ethers.utils.parseUnits("20", 6), this.user0.address, [])

      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("50", 6))
      await this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])

      await this.investmentToken.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("10", 6))
      await this.strategy.connect(this.user0).withdraw(ethers.utils.parseUnits("10", 6), this.user0.address, [])

      const assetBalances = await this.strategy.getAssetBalances()
      expect(assetBalances[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdtLpToken.toLowerCase())
      expect(assetBalances[0].balance).to.approximately(
        ethers.utils.parseUnits("70", 6),
        getErrorRange(ethers.utils.parseUnits("70", 6))
      )

      expect(await this.strategy.getLiabilityBalances()).to.be.an("array").that.is.empty

      const assetValuations = await this.strategy.getAssetValuations(true, false)
      expect(assetValuations[0].asset.toLowerCase()).to.equal(ADDRESSES.stargateUsdtLpToken.toLowerCase())
      expect(assetValuations[0].valuation).to.approximately(
        ethers.utils.parseUnits("70", 6),
        getErrorRange(ethers.utils.parseUnits("70", 6))
      )

      expect(await this.strategy.getLiabilityValuations(true, false)).to.be.an("array").that.is.empty

      expect(await this.strategy.getEquityValuation(true, false)).to.approximately(
        ethers.utils.parseUnits("70", 6),
        getErrorRange(ethers.utils.parseUnits("70", 6))
      )
    })
  })
}

function testStargateUsdtInitialize() {
  describe("Initialize - Stargate USDT Strategy Specific", async function () {
    it("should fail when passed wrong LP token address", async function () {
      await expect(
        upgrades.deployProxy(
          this.Strategy,
          [
            [
              this.investmentToken.address,
              this.usdc.address,
              this.depositFee,
              this.depositFeeParams,
              this.withdrawalFee,
              this.withdrawalFeeParams,
              this.performanceFee,
              this.performanceFeeParams,
              this.feeReceiver,
              this.feeReceiverParams,
              this.totalInvestmentLimit,
              this.investmentLimitPerAddress,
              this.priceOracle.address,
              this.swapServiceProvider,
              this.swapServiceRouter,
            ],
            ADDRESSES.stargateRouter,
            ADDRESSES.stargateUsdtPool,
            ADDRESSES.stargateLpStaking,
            this.usdc.address,
            ADDRESSES.stargateStgToken,
          ],
          { kind: "uups" }
        )
      ).to.be.revertedWithCustomError(this.strategy, "InvalidStargateLpToken")
    })
  })
}

function testStargateUsdtDeposit() {
  describe("Deposit - Stargate USDT Strategy Specific", async function () {
    it("should fail when a single user deposits the possible minimum USDC", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))

      await this.usdc.connect(this.user0).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user0).deposit(1, this.user0.address, [])).to.be.revertedWith(
        "Joe: INSUFFICIENT_OUTPUT_AMOUNT"
      )

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("100", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.strategy.getEquityValuation(true, false)).to.equal(0)
    })

    it("should success when multiple users deposit the possible minimum USDC - 0", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user1, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user2, this.usdc, ethers.utils.parseUnits("100", 6))

      // The first user.
      await this.usdc.connect(this.user0).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user0).deposit(1, this.user0.address, [])).to.be.revertedWith(
        "Joe: INSUFFICIENT_OUTPUT_AMOUNT"
      )

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("100", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.strategy.getEquityValuation(true, false)).to.equal(0)

      // The second user.
      await this.usdc.connect(this.user1).approve(this.strategy.address, ethers.utils.parseUnits("30", 6))
      await expect(this.strategy.connect(this.user1).deposit(ethers.utils.parseUnits("30", 6), this.user1.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("70", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user2).deposit(1, this.user0.address, [])).to.be.revertedWith(
        "Joe: INSUFFICIENT_OUTPUT_AMOUNT"
      )

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("100", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.equal(0)
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
    })

    it("should success when multiple users deposit the possible minimum USDC - 1", async function () {
      airdropToken(this.impersonatedSigner, this.user0, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user1, this.usdc, ethers.utils.parseUnits("100", 6))
      airdropToken(this.impersonatedSigner, this.user2, this.usdc, ethers.utils.parseUnits("100", 6))

      // The first user.
      await this.usdc.connect(this.user0).approve(this.strategy.address, ethers.utils.parseUnits("30", 6))
      await expect(this.strategy.connect(this.user0).deposit(ethers.utils.parseUnits("30", 6), this.user0.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("70", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.strategy.address, 1)
      await expect(this.strategy.connect(this.user1).deposit(1, this.user0.address, [])).to.be.revertedWith(
        "Joe: INSUFFICIENT_OUTPUT_AMOUNT"
      )

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("100", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.equal(0)
      expect(await this.strategy.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.strategy.address, ethers.utils.parseUnits("30", 6))
      await expect(this.strategy.connect(this.user2).deposit(ethers.utils.parseUnits("30", 6), this.user2.address, []))
        .to.emit(this.strategy, "Deposit")
        .withArgs(this.user2.address, this.user2.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("70", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
      expect(await this.strategy.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )
      expect(await this.strategy.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )
    })
  })
}