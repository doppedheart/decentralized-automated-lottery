const fs = require("fs");

const { ethers, network } = require("hardhat");
const FRONTEND_ABI_FILE =
  "C:/Users/anura/Desktop/lottery-frontend/contracts/abi.json";

const FRONTEND_ADDRESSES_FILE =
  "C:/Users/anura/Desktop/lottery-frontend/contracts/addresses.json";
module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Updating Front End...");
    await updateContractAddresses();
    await updateABI();
  }
};

async function updateABI() {
  const raffle = await ethers.getContract("Raffle");
  fs.writeFileSync(
    FRONTEND_ABI_FILE,
    raffle.interface.format(ethers.utils.FormatTypes.json)
  );
}

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle");
  const contractAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESSES_FILE, "utf8")
  );
  if (network.config.chainId.toString() in contractAddresses) {
    if (!contractAddresses[network.config.chainId.toString()].includes(raffle.address)) {
      contractAddresses[network.config.chainId.toString()].push(raffle.address);
    }
  } else {
    contractAddresses[network.config.chainId.toString()] = [raffle.address];
  }
  fs.writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(contractAddresses));
}
module.exports.tags = ["all", "frontend"];
