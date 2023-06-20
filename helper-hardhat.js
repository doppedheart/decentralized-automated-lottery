const {ethers}=require('hardhat');

const networkConfig = {
  default: {
    name: "hardhat",
    keepersUpdateInterval: "30",
  },
  31337: {
    name: "localhost",
    keepersUpdateInterval: "30",
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    subscriptionId: "588",
    raffleEntranceFee: ethers.utils.parseEther("0.1"),
    callbackGasLimit: "500000",
  },
  11155111: {
    name: "sepolia",
    keepersUpdateInterval: "30",
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    subscriptionId: "2994",
    raffleEntranceFee: ethers.utils.parseEther("0.1"),
    callbackGasLimit: "500000",
    vrfCoordinatorV2: "0x8103b0a8a00be2ddc778e6e7eaa21791cd364625",
  },
};

const developmentChains = ["hardhat", "localhost"];
const VERIFICATION_BLOCK_CONFIRMATIONS = 6;


module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS
}
