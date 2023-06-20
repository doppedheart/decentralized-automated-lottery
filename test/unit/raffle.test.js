const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat.js");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit tests", function () {
      let raffle,
        vrfCoordinatorV2Mock,
        raffleEntranceFee,
        raffleContract,
        interval,
        player,
        accounts;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        accounts = await ethers.getSigners();
        player = accounts[1];
        await deployments.fixture(["mocks", "Raffle"]);
        raffleContract = await ethers.getContract("Raffle");
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        raffle = raffleContract.connect(player);
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });
      describe("constructor", function () {
        it("initializes the contract correctly", async function () {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(
            interval.toString(),
            networkConfig[chainId].keepersUpdateInterval
          );
        });
      });
      describe("enter Raffle", function () {
        it("revert when you don't pay the entrance fee enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughEthEntered"
          );
        });
        it("records player when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const contractPlayer = await raffle.getPlayer(0);
          assert.equal(player.address, contractPlayer);
        });
        it("emit on when enter", async function () {
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, "RaffleEnter");
        });
        it("does not allow to enter when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep([]);
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWith("Raffle__NotOpen");
        });
      });
      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any Eth", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({
            method: "evm_mine",
            params: [],
          });
          const { upkeepData } = await raffle.callStatic.checkUpkeep("0x");
          assert(!upkeepData);
        });
        it("returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepData } = await raffle.callStatic.checkUpkeep("0x");
          assert.equal(raffleState.toString() == "1", upkeepData == false);
        });
        it("returns false if enough time hasn't passed", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepData } = await raffle.callStatic.checkUpkeep("0x");
          assert(!upkeepData);
        });
        it("returns true if enough time has passed ,has players,and is open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepData } = await raffle.callStatic.checkUpkeep("0x");
          assert(upkeepData);
        });
      });
      describe("performUpkeep", function () {
        it("can only run if the checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.performUpkeep("0x");
          assert(tx);
        });
        it("reverts if the checkupkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWith(
            "Raffle__UpkeepNotNeeded"
          );
        });
        it("updates the raffle state and emits the requestId", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x");
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "1");
          assert(requestId.toNumber() > 0);
        });
      });
      describe("fulfillRandomWords", function () {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });
        it("can only be call after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request");
        });
        //very big test
        //this test simulates the raffle and wraps entire functionality of raffle
        //inside a promise that will resole if everything is successful
        //an event listener for the winner picked is set up
        //mocks of the chainKeeper and vrf coordinator are used to kickoff this winner picked event
        //all the assertions are done once the winner picked event is fired
        it("pick a winner", async function () {
          const additionalEntrances = 3;
          const statingIndex = 2;
          for (
            let i = statingIndex;
            i < statingIndex + additionalEntrances;
            i++
          ) {
            raffle = raffleContract.connect(accounts[i]);
            await raffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimeStamp = await raffle.getLastTimeStamp();
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("found winner picked event!");
              try {
                const recentWinner = await raffle.getRecentWinner();
                const recentTimeStamp = await raffle.getLastTimeStamp();
                const winnerBalance = await accounts[2].getBalance();
                const raffleState = await raffle.getRaffleState();
                const numPlayers = await raffle.getNumberOfPlayers();
                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[2].address);
                assert.equal(raffleState.toString(), "0");
                
                assert.equal(
                    winnerBalance.toString(),
                    startingBalance.add((raffleEntranceFee.mul(additionalEntrances)).add(raffleEntranceFee)).toString()
                )
              } catch (error) {
                reject(error);
              }
              resolve();
            });

            const tx = await raffle.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            const startingBalance = await accounts[2].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
