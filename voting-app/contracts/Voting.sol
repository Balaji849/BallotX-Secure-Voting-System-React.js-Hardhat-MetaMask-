// SPDX-License-Identifier: MIT
// Specifies the license (use MIT for open source examples typically)

// Defines the Solidity compiler version to use.
// ^0.8.9 means use version 0.8.9 or any higher version within the 0.8.x series
// but not 0.9.0 or higher.
pragma solidity ^0.8.9;

// Optional: Import Hardhat's console.log for debugging during local development
// You can remove this for production deployment to save gas.
import "hardhat/console.sol";

/**
 * @title Voting
 * @dev A simple smart contract for conducting a decentralized vote on predefined proposals.
 */
contract Voting {

    // --- State Variables ---

    // Structure to hold details about each proposal
    struct Proposal {
        string name;        // Short description or title of the proposal
        uint voteCount;     // Number of votes received (uint is an alias for uint256)
    }

    // Address of the account that deployed the contract (or designated owner)
    // 'public' automatically creates a getter function `owner()`
    address public owner;

    // An array to store all the proposals.
    // 'public' creates a getter, but reading arrays of structs directly can be complex
    // for web3 libraries, so we add helper functions later.
    Proposal[] public proposals;

    // A mapping to keep track of which addresses have already voted.
    // mapping(KeyType => ValueType) public mappingName;
    // Key: voter's address, Value: boolean (true if voted, false otherwise)
    // 'public' creates a getter `hasVoted(address)` that returns the boolean.
    mapping(address => bool) public hasVoted;

    // --- Events ---

    // Event emitted when a vote is successfully cast.
    // Helps off-chain applications (like our React frontend) listen for vote actions.
    // 'indexed' allows filtering events based on these parameters more easily.
    event Voted(address indexed voter, uint indexed proposalIndex);

    // Event emitted when a new proposal is added.
    event ProposalAdded(uint proposalIndex, string name);


    // --- Modifiers ---

    // Modifier to restrict certain functions to only be callable by the 'owner'.
    modifier onlyOwner() {
        // Checks if the address calling the function (msg.sender) is the owner.
        // If not, it reverts the transaction with the given error message.
        require(msg.sender == owner, "Only owner can call this function.");
        _; // Placeholder: Executes the rest of the function code where the modifier is used.
    }

    // --- Constructor ---

    /**
     * @dev Contract constructor sets the owner and adds initial proposals.
     * Runs only once when the contract is deployed.
     */
    constructor() {
        // Set the owner to the address that deployed the contract.
        owner = msg.sender;

        // Add some initial proposals for demonstration purposes.
        // In a real application, proposals might be added via `addProposal` calls
        // after deployment, or through a more complex governance mechanism.
        _addProposalInternal("Proposal A: Fund Project Alpha");
        _addProposalInternal("Proposal B: Support Initiative Beta");
        _addProposalInternal("Proposal C: Allocate Resources Gamma");
    }

    // --- Functions ---

    /**
     * @dev Adds a new proposal to the list. Restricted to the owner.
     * @param _name The name/description of the new proposal.
     */
    function addProposal(string memory _name) public onlyOwner {
         // Use internal function to avoid code duplication and handle event emission
        _addProposalInternal(_name);
    }

    /**
     * @dev Internal function to add a proposal and emit an event.
     * @param _name The name/description of the new proposal.
     */
    function _addProposalInternal(string memory _name) internal {
        // Basic validation: Ensure the proposal name is not empty and not excessively long
        // (bytes(_name).length checks the length in bytes, which is often relevant for gas).
        require(bytes(_name).length > 0, "Proposal name cannot be empty.");
        require(bytes(_name).length < 100, "Proposal name is too long."); // Adjust length limit as needed

        uint newProposalIndex = proposals.length;

        // Create a new Proposal struct in memory and add it to the 'proposals' array (in storage).
        proposals.push(Proposal({
            name: _name,
            voteCount: 0  // Initialize vote count to zero
        }));

        // Emit an event signifying that a new proposal has been added.
        emit ProposalAdded(newProposalIndex, _name);

        // Optional: Log for local debugging
        console.log("Proposal added:", _name, "at index", newProposalIndex);
    }


    /**
     * @dev Allows a user to cast their vote for a specific proposal.
     * @param _proposalIndex The index of the proposal to vote for in the `proposals` array.
     */
    function vote(uint _proposalIndex) public {
        // Check 1: Ensure the provided proposal index is valid (exists in the array).
        require(_proposalIndex < proposals.length, "Voting: Invalid proposal index.");

        // Check 2: Ensure the caller (msg.sender) has not already voted.
        require(!hasVoted[msg.sender], "Voting: You have already voted.");

        // --- Actions ---
        // Mark the caller as having voted.
        hasVoted[msg.sender] = true;

        // Increment the vote count for the chosen proposal.
        // We access the proposal struct in the array using the index.
        proposals[_proposalIndex].voteCount++;

        // Emit the Voted event to log this action on the blockchain.
        emit Voted(msg.sender, _proposalIndex);

        // Optional: Log for local debugging
        console.log("Address", msg.sender, "voted for proposal index", _proposalIndex);
    }

    // --- View Functions (Read-only) ---

    /**
     * @dev Gets the total number of proposals.
     * 'view' indicates this function does not modify the contract's state.
     * @return The current count of proposals.
     */
    function getProposalsCount() public view returns (uint) {
        return proposals.length;
    }

    /**
     * @dev Gets the details of a specific proposal by its index.
     * This is helpful for frontends as directly accessing struct elements in an array
     * via web3 calls can be cumbersome.
     * @param _index The index of the proposal to retrieve.
     * @return name The name of the proposal.
     * @return voteCount The current vote count for the proposal.
     */
    function getProposal(uint _index) public view returns (string memory name, uint voteCount) {
        // Ensure the index is valid before accessing the array.
        require(_index < proposals.length, "GetProposal: Invalid proposal index.");

        // Retrieve the proposal from storage using the index.
        // 'storage' keyword means we are creating a reference to the data in storage, not copying it to memory.
        Proposal storage proposal = proposals[_index];

        // Return the individual fields of the struct.
        return (proposal.name, proposal.voteCount);
    }

    /**
     * @dev Determines the winning proposal based on the highest vote count.
     * Note: This simple implementation doesn't handle ties explicitly; it returns
     * the first proposal encountered with the highest vote count.
     * @return winningProposalName The name of the proposal with the most votes.
     */
    function getWinner() public view returns (string memory winningProposalName) {
        uint winningVoteCount = 0;
        uint winningProposalIndex = 0; // Default to the first proposal if no votes or tie

        // Handle the edge case where there are no proposals yet.
        if (proposals.length == 0) {
            return "No proposals available";
        }

        // Loop through all proposals
        for (uint i = 0; i < proposals.length; i++) {
            // If the current proposal's vote count is higher than the highest seen so far...
            if (proposals[i].voteCount > winningVoteCount) {
                // Update the highest vote count and the index of the winning proposal.
                winningVoteCount = proposals[i].voteCount;
                winningProposalIndex = i;
            }
        }

        // Retrieve the winning proposal's name using the determined index.
        // We are safe to access this index because we checked proposals.length earlier
        // and winningProposalIndex is initialized/updated within bounds.
        return proposals[winningProposalIndex].name;
    }
}