import { expect } from "chai"
import { ethers } from "hardhat"
import erc20Abi from "../shared/abi/erc20.json"
import investableAbi from "../shared/abi/investable.json"
import { getErrorRange } from "../shared/utils"

export function testDeposit() {
  describe("Deposit", async function () {
    it("should success when a single user deposits USDC that he/she has - 0", async function () {
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3000", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3000", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
    })

    it("should success when a single user deposits USDC that he/she has - 1", async function () {
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3701.810393", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3701.810393", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3701.810393", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("6298.189607", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(
        ethers.utils.parseUnits("3701.810393", 6)
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3701.810393", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3701.810393", 6),
        getErrorRange(ethers.utils.parseUnits("3701.810393", 6))
      )
    })

    it("should fail when a single user deposits zero amount", async function () {
      await this.usdc.connect(this.user0).approve(this.portfolio.address, 0)
      await expect(this.portfolio.connect(this.user0).deposit(0, this.user0.address, [])).to.be.revertedWithCustomError(
        this.portfolio,
        "ZeroAmountDeposited"
      )

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.portfolio.getEquityValuation(true, false)).to.equal(0)
    })

    it("should fail when a single user deposits USDC that he/she doesn't have", async function () {
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("10001", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("10001", 6), this.user0.address, [])
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance")

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.portfolio.getEquityValuation(true, false)).to.equal(0)
    })

    it("should fail when a single user deposits exceeding limit per address", async function () {
      await this.portfolio.connect(this.owner).setInvestmentLimitPerAddress(ethers.utils.parseUnits("49", 6))

      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("50", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])
      ).to.be.revertedWithCustomError(this.portfolio, "InvestmentLimitPerAddressExceeded")

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.portfolio.getEquityValuation(true, false)).to.equal(0)
    })

    it("should fail when a single user deposits exceeding total limit", async function () {
      await this.portfolio.connect(this.owner).setTotalInvestmentLimit(ethers.utils.parseUnits("49", 6))

      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("50", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])
      ).to.be.revertedWithCustomError(this.portfolio, "TotalInvestmentLimitExceeded")

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.portfolio.getEquityValuation(true, false)).to.equal(0)
    })

    it("should success when a single user deposits USDC that he/she has and another user deposited into investable directly before that", async function () {
      const investableDesc = await this.portfolio.investableDescs(0)
      const investable = await ethers.getContractAt(investableAbi, await investableDesc.investable)
      const investableInvestmentToken = await ethers.getContractAt(erc20Abi, await investable.getInvestmentToken())
      const investableAllocationPercentage = await investableDesc.allocationPercentage

      await this.usdc.connect(this.user1).approve(investable.address, ethers.utils.parseUnits("3000", 6))
      await expect(investable.connect(this.user1).deposit(ethers.utils.parseUnits("3000", 6), this.user1.address, []))
        .not.to.be.reverted

      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3000", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3000", 6))

      const investableDepositAmount = ethers.utils.parseUnits("3000", 6).mul(investableAllocationPercentage).div(100000)

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await investableInvestmentToken.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await investable.getInvestmentTokenSupply()).to.equal(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount)
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await investable.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
    })

    it("should success when a single user deposits USDC that he/she has and another user deposits into investable directly after that", async function () {
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3000", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3000", 6))

      const investableDesc = await this.portfolio.investableDescs(0)
      const investable = await ethers.getContractAt(investableAbi, await investableDesc.investable)
      const investableInvestmentToken = await ethers.getContractAt(erc20Abi, await investable.getInvestmentToken())
      const investableAllocationPercentage = await investableDesc.allocationPercentage

      await this.usdc.connect(this.user1).approve(investable.address, ethers.utils.parseUnits("3000", 6))
      await expect(investable.connect(this.user1).deposit(ethers.utils.parseUnits("3000", 6), this.user1.address, []))
        .not.to.be.reverted

      const investableDepositAmount = ethers.utils.parseUnits("3000", 6).mul(investableAllocationPercentage).div(100000)

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await investableInvestmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await investable.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await investable.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
    })

    it("should success when multiple users deposit USDC that they have - 0", async function () {
      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("30", 6), this.user0.address, []))
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("9970", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("30", 6), this.user1.address, []))
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("9970", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(this.portfolio.connect(this.user2).deposit(ethers.utils.parseUnits("30", 6), this.user2.address, []))
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user2.address, this.user2.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("9970", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("90", 6),
        getErrorRange(ethers.utils.parseUnits("90", 6))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("90", 6),
        getErrorRange(ethers.utils.parseUnits("90", 6))
      )
    })

    it("should success when multiple users deposit USDC that they have - 1", async function () {
      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3701.810393", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3701.810393", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3701.810393", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("6298.189607", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(
        ethers.utils.parseUnits("3701.810393", 6)
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3701.810393", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3701.810393", 6),
        getErrorRange(ethers.utils.parseUnits("3701.810393", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("3701.810393", 6))
      await expect(
        this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("3701.810393", 6), this.user1.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("3701.810393", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("6298.189607", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("3701.810393", 6),
        getErrorRange(ethers.utils.parseUnits("3701.810393", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("7403.620786", 6),
        getErrorRange(ethers.utils.parseUnits("7403.620786", 6))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("7403.620786", 6),
        getErrorRange(ethers.utils.parseUnits("7403.620786", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.portfolio.address, ethers.utils.parseUnits("3701.810393", 6))
      await expect(
        this.portfolio.connect(this.user2).deposit(ethers.utils.parseUnits("3701.810393", 6), this.user2.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user2.address, this.user2.address, ethers.utils.parseUnits("3701.810393", 6))

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("6298.189607", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.be.approximately(
        ethers.utils.parseUnits("3701.810393", 6),
        getErrorRange(ethers.utils.parseUnits("3701.810393", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("11105.431179", 6),
        getErrorRange(ethers.utils.parseUnits("11105.431179", 6))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("11105.431179", 6),
        getErrorRange(ethers.utils.parseUnits("11105.431179", 6))
      )
    })

    it("should fail when multiple users deposit zero amount", async function () {
      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, 0)
      await expect(this.portfolio.connect(this.user0).deposit(0, this.user0.address, [])).to.be.revertedWithCustomError(
        this.portfolio,
        "ZeroAmountDeposited"
      )

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.portfolio.getEquityValuation(true, false)).to.equal(0)

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("3000", 6), this.user1.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("3000", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.portfolio.address, 0)
      await expect(this.portfolio.connect(this.user2).deposit(0, this.user2.address, [])).to.be.revertedWithCustomError(
        this.portfolio,
        "ZeroAmountDeposited"
      )

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
    })

    it("should fail when multiple users deposit USDC that they don't have", async function () {
      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3000", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3000", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("10001", 6))
      await expect(
        this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("10001", 6), this.user1.address, [])
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance")

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
    })

    it("should fail when multiple users deposit exceeding limit per address", async function () {
      await this.portfolio.connect(this.owner).setInvestmentLimitPerAddress(ethers.utils.parseUnits("49", 6))

      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("50", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("50", 6), this.user0.address, [])
      ).to.be.revertedWithCustomError(this.portfolio, "InvestmentLimitPerAddressExceeded")

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(0)
      expect(await this.portfolio.getEquityValuation(true, false)).to.equal(0)

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("30", 6), this.user1.address, []))
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("9970", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.portfolio.address, ethers.utils.parseUnits("50", 6))
      await expect(
        this.portfolio.connect(this.user2).deposit(ethers.utils.parseUnits("50", 6), this.user2.address, [])
      ).to.be.revertedWithCustomError(this.portfolio, "InvestmentLimitPerAddressExceeded")

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
    })

    it("should fail when multiple users deposit exceeding total limit", async function () {
      await this.portfolio.connect(this.owner).setTotalInvestmentLimit(ethers.utils.parseUnits("89", 6))

      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("30", 6), this.user0.address, []))
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("9970", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("30", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("30", 6), this.user1.address, []))
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("30", 6))

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("9970", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("30", 6),
        getErrorRange(ethers.utils.parseUnits("30", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )

      // The third user.
      await this.usdc.connect(this.user2).approve(this.portfolio.address, ethers.utils.parseUnits("30", 6))
      await expect(
        this.portfolio.connect(this.user2).deposit(ethers.utils.parseUnits("30", 6), this.user2.address, [])
      ).to.be.revertedWithCustomError(this.portfolio, "TotalInvestmentLimitExceeded")

      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("10000", 6))
      expect(await this.investmentToken.balanceOf(this.user2.address)).to.equal(0)
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("60", 6),
        getErrorRange(ethers.utils.parseUnits("60", 6))
      )
    })

    it("should success when multiple users deposit USDC that they have and another user deposited into investable directly before that", async function () {
      const investableDesc = await this.portfolio.investableDescs(0)
      const investable = await ethers.getContractAt(investableAbi, await investableDesc.investable)
      const investableInvestmentToken = await ethers.getContractAt(erc20Abi, await investable.getInvestmentToken())
      const investableAllocationPercentage = await investableDesc.allocationPercentage

      await this.usdc.connect(this.user2).approve(investable.address, ethers.utils.parseUnits("3000", 6))
      await expect(investable.connect(this.user2).deposit(ethers.utils.parseUnits("3000", 6), this.user2.address, []))
        .not.to.be.reverted

      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3000", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3000", 6))

      let investableDepositAmount = ethers.utils.parseUnits("3000", 6).mul(investableAllocationPercentage).div(100000)

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await investableInvestmentToken.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await investable.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await investable.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("3000", 6), this.user1.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("3000", 6))

      investableDepositAmount = ethers.utils.parseUnits("6000", 6).mul(investableAllocationPercentage).div(100000)

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await investableInvestmentToken.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("6000", 6),
        getErrorRange(ethers.utils.parseUnits("6000", 6))
      )
      expect(await investable.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("6000", 6),
        getErrorRange(ethers.utils.parseUnits("6000", 6))
      )
      expect(await investable.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
    })

    it("should success when multiple users deposit USDC that they have and another user deposits into investable directly after that", async function () {
      // The first user.
      await this.usdc.connect(this.user0).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user0).deposit(ethers.utils.parseUnits("3000", 6), this.user0.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user0.address, this.user0.address, ethers.utils.parseUnits("3000", 6))

      expect(await this.usdc.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user0.address)).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getInvestmentTokenSupply()).to.equal(ethers.utils.parseUnits("3000", 6))
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )

      // The second user.
      await this.usdc.connect(this.user1).approve(this.portfolio.address, ethers.utils.parseUnits("3000", 6))
      await expect(
        this.portfolio.connect(this.user1).deposit(ethers.utils.parseUnits("3000", 6), this.user1.address, [])
      )
        .to.emit(this.portfolio, "Deposit")
        .withArgs(this.user1.address, this.user1.address, ethers.utils.parseUnits("3000", 6))

      const investableDesc = await this.portfolio.investableDescs(0)
      const investable = await ethers.getContractAt(investableAbi, await investableDesc.investable)
      const investableInvestmentToken = await ethers.getContractAt(erc20Abi, await investable.getInvestmentToken())
      const investableAllocationPercentage = await investableDesc.allocationPercentage

      await this.usdc.connect(this.user2).approve(investable.address, ethers.utils.parseUnits("3000", 6))
      await expect(investable.connect(this.user2).deposit(ethers.utils.parseUnits("3000", 6), this.user2.address, []))
        .not.to.be.reverted

      const investableDepositAmount = ethers.utils.parseUnits("6000", 6).mul(investableAllocationPercentage).div(100000)

      expect(await this.usdc.balanceOf(this.user1.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.usdc.balanceOf(this.user2.address)).to.equal(ethers.utils.parseUnits("7000", 6))
      expect(await this.investmentToken.balanceOf(this.user1.address)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await investableInvestmentToken.balanceOf(this.user2.address)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6),
        getErrorRange(ethers.utils.parseUnits("3000", 6))
      )
      expect(await this.portfolio.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("6000", 6),
        getErrorRange(ethers.utils.parseUnits("6000", 6))
      )
      expect(await investable.getInvestmentTokenSupply()).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
      expect(await this.portfolio.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("6000", 6),
        getErrorRange(ethers.utils.parseUnits("6000", 6))
      )
      expect(await investable.getEquityValuation(true, false)).to.be.approximately(
        ethers.utils.parseUnits("3000", 6).add(investableDepositAmount),
        getErrorRange(ethers.utils.parseUnits("3000", 6).add(investableDepositAmount))
      )
    })
  })
}