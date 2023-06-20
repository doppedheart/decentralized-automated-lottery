const {network ,ethers }=require('hardhat');
const {networkConfig,developmentChains,VERIFICATION_BLOCK_CONFIRMATION}=require('../helper-hardhat.js');

const {verify}=require('../utils/verify.js');

const FUND_AMOUNT = ethers.utils.parseEther("1");
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2, subscriptionId, vrfCoordinatorV2Mock;

  if (developmentChains.includes(network.name)) {
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2 = vrfCoordinatorV2Mock.address;
    log(`address valid invalid if ${vrfCoordinatorV2}`);
    const transcriptionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transcriptionReceipt = await transcriptionResponse.wait(5);
    subscriptionId = transcriptionReceipt.events[0].args.subId;
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
  } else {
    vrfCoordinatorV2 = networkConfig[chainId].vrfCoordinatorV2;
    subscriptionId = networkConfig[chainId].subscriptionId;
  }
  const waitBlockConfirmation = developmentChains.includes(chainId)
    ? 1
    : VERIFICATION_BLOCK_CONFIRMATION;
  log("----------------------------------------------------");

  const arguments = [
    vrfCoordinatorV2,
    networkConfig[chainId].raffleEntranceFee,
    networkConfig[chainId].gasLane,
    subscriptionId,
    networkConfig[chainId].callbackGasLimit,
    networkConfig[chainId].keepersUpdateInterval,
  ];
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmation: waitBlockConfirmation,
  });

  //ensure the raffle contract is valid consumer of the vrf coordinator mock
 if (developmentChains.includes(network.name)) {
   log(`Adding Consumer...`);
   const vrfCoordinatorV2Mock = await ethers.getContract(
     "VRFCoordinatorV2Mock"
   );
   await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
   log(`Consumer Successfully Added!`);
 }
  // if (developmentChains.includes(chainId)) {
  //   const vrfCoordinatorV2Mock = await ethers.getContract(
  //     "VRFCoordinatorV2Mock"
  //   );
  //   await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, raffle.address);
  // }
  //verify the deployment
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying contract on Etherscan...");
    await verify(raffle.address, arguments);
  }

//   log("enter lottery with command:");
//   const networkName = network.name === "hardhat" ? "localhost" : network.name;
//   log(`yarn hardhat run scripts/enterRaffle.js --network ${networkName}`);
//   log("----------------------------------------------------");
};

module.exports.tags = ["all", "Raffle"];