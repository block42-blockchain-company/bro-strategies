import "@mangrovedao/hardhat-test-solidity"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-waffle"
import "@openzeppelin/hardhat-upgrades"
import "@typechain/hardhat"
import * as dotenv from "dotenv"
//import "hardhat-contract-sizer"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import { HardhatUserConfig } from "hardhat/config"
import "solidity-coverage"

dotenv.config()

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      blockGasLimit: 30_000_000,
      forking: {
        url: "https://api.avax.network/ext/bc/C/rpc",
        enabled: true,
      },
    },

    avax_mainnet: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: [`0x${process.env.MAINNET_PRIVATE_KEY}`],
    },
    avax_testnet: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [`0x${process.env.TESTNET_PRIVATE_KEY}`],
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
    },
    tenderly: {
      url: `{process.env.TENDERLY_FORK_URL}`,
      chainId: 43114,
      accounts: [`0x${process.env.TENDERLY_PRIVATE_KEY}`],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   strict: true,
  // },
}

export default config
