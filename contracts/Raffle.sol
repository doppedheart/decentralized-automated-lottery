//raffle
//enter a lottery with a minimum amount
//pick a winner randomly
//winer to be selected by the contract after X minutes -> completly automate
//chainlink oracle -> randomness , automated execution ( chainlink keepers )

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol';

error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers,uint256 raffleState);
error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();

contract Raffle is VRFConsumerBaseV2,AutomationCompatibleInterface{
    /*type declarations */
    enum RaffleState{
        OPEN,
        CALCULATING
    }

    /*state variables */
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATION = 3;
    uint32 private constant NUM_WORDS=1;

    /*lottery variables */
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /*event variable */
    event RaffleEnter(address indexed player);
    event RequestRandomWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(address vrfCoordinatorV2,uint256 entranceFee,bytes32 _gasLane,uint64 subscriptionId,uint32 callbackGasLimit,uint256 interval) VRFConsumerBaseV2(vrfCoordinatorV2){
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = _gasLane;
        i_subscriptionId= subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        i_interval = interval;
        s_lastTimeStamp = block.timestamp;
    }

    function enterRaffle() public payable{
        if(msg.value<i_entranceFee){
            revert Raffle__NotEnoughEthEntered();
        }
        if(s_raffleState != RaffleState.OPEN){
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }
    /**
     * they look for the upkeepup too return true
     * the following should be true in order to return true
     * 1. our set time interval should have passed
     * 2.the lottery should have atleast one player ,and have some Eth
     * 3.our subscription should be funded with link 
     * 4. the lottery should be in an open state
     */
    function checkUpkeep(bytes memory /*checkdata*/) public view override returns(bool upkeepData , bytes memory /*performdata*/){
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool hasPlayers = (s_players.length>0);
        bool hasBalance = (address(this).balance>0);
        bool timePassed = ((block.timestamp - s_lastTimeStamp)>i_interval);
        upkeepData =( isOpen && hasPlayers && hasBalance && timePassed);
    }

    function performUpkeep(bytes calldata /*performData */) external override{
        (bool upkeepData,)=checkUpkeep("");
        if(!upkeepData){
            revert Raffle__UpkeepNotNeeded(address(this).balance , s_players.length,uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId= i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestRandomWinner(requestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override{
        uint256 index= randomWords[0]%s_players.length;
        address payable recentWinner = s_players[index];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        (bool success,)=recentWinner.call{value:address(this).balance}("");
        if(!success){
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    //getter functions
    function getEntranceFee() public view returns(uint256){
        return i_entranceFee;
    }
    function getPlayer(uint256 index) public view returns(address){
        return s_players[index];
    }
    function getRaffleState() public view returns(RaffleState){
        return s_raffleState;
    }
    function getRecentWinner() public view returns(address){
        return s_recentWinner;
    }
    function getNumWords() public pure returns(uint32){
        return NUM_WORDS;
    }
    function getRequestConfirmation() public pure returns(uint16){
        return REQUEST_CONFIRMATION;
    }
    function getLastTimeStamp() public view returns(uint256){
        return s_lastTimeStamp;
    }
    function getInterval() public view returns(uint256){
        return i_interval;
    }
    function getNumberOfPlayers() public view returns(uint256){
        return s_players.length;
    }

}