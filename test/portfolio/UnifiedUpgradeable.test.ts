import { expect } from "chai"
import { ethers, upgrades } from "hardhat"

export function testUpgradeable() {
  describe("Upgradeable", async function () {
    it("should succeed when the owner user upgrades", async function () {
      const addr_before_upgrade = await upgrades.erc1967.getImplementationAddress(this.portfolio.address)

      const TestUpgradedPortfolio = await ethers.getContractFactory("TestUpgradedPortfolio")
      const testUpgradedPortfolio = await upgrades.upgradeProxy(this.portfolio.address, TestUpgradedPortfolio, {
        call: {
          fn: "initialize",
          args: [
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
            ],
          ],
        },
      })
      await testUpgradedPortfolio.deployed()

      const addr_after_upgrade = await upgrades.erc1967.getImplementationAddress(this.portfolio.address)

      expect(addr_before_upgrade != addr_after_upgrade).to.equal(true)
    })

    it("should succeed when the portfolio is paused", async function () {
      expect(await this.portfolio.pause()).not.to.be.reverted

      const addr_before_upgrade = await upgrades.erc1967.getImplementationAddress(this.portfolio.address)

      const TestUpgradedPortfolio = await ethers.getContractFactory("TestUpgradedPortfolio")
      const testUpgradedPortfolio = await upgrades.upgradeProxy(this.portfolio.address, TestUpgradedPortfolio, {
        call: {
          fn: "initialize",
          args: [
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
            ],
          ],
        },
      })
      await testUpgradedPortfolio.deployed()

      const addr_after_upgrade = await upgrades.erc1967.getImplementationAddress(this.portfolio.address)

      expect(addr_before_upgrade != addr_after_upgrade).to.equal(true)
    })

    it("should fail when the non-owner user upgrades", async function () {
      const TestUpgradedPortfolio = await ethers.getContractFactory("TestUpgradedPortfolio", this.user0)
      await expect(
        upgrades.upgradeProxy(this.portfolio.address, TestUpgradedPortfolio, {
          call: {
            fn: "initialize",
            args: [
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
              ],
            ],
          },
        })
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("should succeed to leave all common state variables' value intact", async function () {
      // IAum
      const investmentTokenSupplyBefore = await this.portfolio.getInvestmentTokenSupply()
      // Don't check asset balances, liability balances, asset valuations, liability valuations
      // and equity valuation since they can be portfolio specific

      // IFee
      const depositFeeBefore = await this.portfolio.getDepositFee([])
      const totalDepositFeeBefore = await this.portfolio.getTotalDepositFee([])
      const withdrawalFeeBefore = await this.portfolio.getWithdrawalFee([])
      const totalWithdrawalFeeBefore = await this.portfolio.getTotalWithdrawalFee([])
      const performanceFeeBefore = await this.portfolio.getPerformanceFee([])
      const totalPerformanceFeeBefore = await this.portfolio.getTotalPerformanceFee([])
      const feeReceiverBefore = await this.portfolio.getFeeReceiver([])
      const currentAccumulatedFeeBefore = await this.portfolio.getCurrentAccumulatedFee()
      const claimedFeeBefore = await this.portfolio.getClaimedFee()

      // IInvestable
      const depositTokenBefore = await this.portfolio.getDepositToken()
      const investmentTokenBefore = await this.portfolio.getInvestmentToken()
      const totalInvestmentLimitBefore = await this.portfolio.getTotalInvestmentLimit()
      const investmentLimitPerAddressBefore = await this.portfolio.getInvestmentLimitPerAddress()
      // Don't check name, humanReadableName and version since they can be portfolio specific.

      // IReward and IPortfolio have no getter.

      const TestUpgradedPortfolio = await ethers.getContractFactory("TestUpgradedPortfolio")
      const testUpgradedPortfolio = await upgrades.upgradeProxy(this.portfolio.address, TestUpgradedPortfolio, {
        call: {
          fn: "initialize",
          args: [
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
            ],
          ],
        },
      })
      await testUpgradedPortfolio.deployed()

      // IAum
      const investmentTokenSupplyAfter = await this.portfolio.getInvestmentTokenSupply()

      // IFee
      const depositFeeAfter = await this.portfolio.getDepositFee([])
      const totalDepositFeeAfter = await this.portfolio.getTotalDepositFee([])
      const withdrawalFeeAfter = await this.portfolio.getWithdrawalFee([])
      const totalWithdrawalFeeAfter = await this.portfolio.getTotalWithdrawalFee([])
      const performanceFeeAfter = await this.portfolio.getPerformanceFee([])
      const totalPerformanceFeeAfter = await this.portfolio.getTotalPerformanceFee([])
      const feeReceiverAfter = await this.portfolio.getFeeReceiver([])
      const currentAccumulatedFeeAfter = await this.portfolio.getCurrentAccumulatedFee()
      const claimedFeeAfter = await this.portfolio.getClaimedFee()

      // IInvestable
      const depositTokenAfter = await this.portfolio.getDepositToken()
      const investmentTokenAfter = await this.portfolio.getInvestmentToken()
      const totalInvestmentLimitAfter = await this.portfolio.getTotalInvestmentLimit()
      const investmentLimitPerAddressAfter = await this.portfolio.getInvestmentLimitPerAddress()

      // IAum
      expect(investmentTokenSupplyBefore.eq(investmentTokenSupplyAfter)).to.equal(true)

      // IFee
      expect(depositFeeBefore == depositFeeAfter).to.equal(true)
      expect(totalDepositFeeBefore == totalDepositFeeAfter).to.equal(true)
      expect(withdrawalFeeBefore == withdrawalFeeAfter).to.equal(true)
      expect(totalWithdrawalFeeBefore == totalWithdrawalFeeAfter).to.equal(true)
      expect(performanceFeeBefore == performanceFeeAfter).to.equal(true)
      expect(totalPerformanceFeeBefore == totalPerformanceFeeAfter).to.equal(true)
      expect(feeReceiverBefore == feeReceiverAfter).to.equal(true)
      expect(currentAccumulatedFeeBefore.eq(currentAccumulatedFeeAfter)).to.equal(true)
      expect(claimedFeeBefore.eq(claimedFeeAfter)).to.equal(true)

      // IInvestable
      expect(depositTokenBefore == depositTokenAfter).to.equal(true)
      expect(investmentTokenBefore == investmentTokenAfter).to.equal(true)
      expect(totalInvestmentLimitBefore.eq(totalInvestmentLimitAfter)).to.equal(true)
      expect(investmentLimitPerAddressBefore.eq(investmentLimitPerAddressAfter)).to.equal(true)
    })
  })
}