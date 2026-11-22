// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ReviewEscrow
 * @notice Budget-bounded stablecoin escrow for Sikio's AI captioning agent and native-speaker micro-reviews
 *         on QDay Aevum Testnet (Chain ID 44005, tUSD8).
 *
 * Security invariants enforced on-chain:
 * 1. Budget cap: The agent can never spend or reserve beyond min(batch.funded, batch.maxBudget).
 * 2. Per-task ceiling: No AI inference payment or human review fee can exceed batch.maxTaskFee.
 * 3. Session expiry: The agent cannot spend or offer new tasks after batch.expiry.
 * 4. Exact-once settlement: Each taskId and each inference requestId settles at most once.
 * 5. Refund safety: Expired or rejected tasks return reserved tUSD8 cleanly to available budget.
 * 6. Approver authority: Only the batch's named approver (or agency owner) can accept/reject tasks.
 * 7. Editor zero-gas UX: Editors can submit corrections via EIP-712 signatures relayed by the agency/sponsor
 *    and receive ERC-20 tUSD8 payouts directly without ever holding native tQDAY.
 *
 * What the chain proves (and does not prove):
 * - Proves the agreed tUSD8 fee was paid exactly once for that accepted task within the approved batch budget.
 * - Does NOT prove linguistic correctness; the named approver attests to quality and is recorded in TaskAccepted.
 */
contract ReviewEscrow is ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum TaskStatus {
        None,
        Offered,
        Submitted,
        Accepted,
        Rejected,
        Expired
    }

    struct Batch {
        address agency;
        address agent;
        address approver;
        uint256 maxBudget;
        uint256 funded;
        uint256 spent;
        uint256 reserved;
        uint256 maxTaskFee;
        uint64 expiry;
        bool enforceEditorAllowlist;
        bool agentRevoked;
        bytes32 labelHash;
    }

    struct ReviewTask {
        uint256 batchId;
        address editor;
        uint256 fee;
        uint64 expiry;
        TaskStatus status;
        bytes32 excerptHash;
        bytes32 correctionHash;
    }

    bytes32 public constant SUBMIT_CORRECTION_TYPEHASH = keccak256(
        "SubmitCorrection(bytes32 taskId,bytes32 correctionHash,uint256 nonce,uint256 deadline)"
    );

    IERC20 public immutable token;
    uint256 public nextBatchId = 1;

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => mapping(address => bool)) public trustedEditors;
    mapping(bytes32 => ReviewTask) public tasks;
    mapping(bytes32 => bool) public inferencePaid;
    mapping(address => uint256) public editorNonces;

    event BatchCreated(
        uint256 indexed batchId,
        address indexed agency,
        address indexed agent,
        address approver,
        uint256 maxBudget,
        uint256 maxTaskFee,
        uint64 expiry,
        bool enforceEditorAllowlist,
        bytes32 labelHash
    );
    event BatchFunded(uint256 indexed batchId, address indexed funder, uint256 amount, uint256 newFunded);
    event TrustedEditorSet(uint256 indexed batchId, address indexed editor, bool allowed);
    event AgentRevoked(uint256 indexed batchId, address indexed agent);
    event InferencePaid(
        uint256 indexed batchId,
        bytes32 indexed requestId,
        address indexed provider,
        uint256 amount
    );
    event TaskOffered(
        uint256 indexed batchId,
        bytes32 indexed taskId,
        address indexed editor,
        uint256 fee,
        uint64 expiry,
        bytes32 excerptHash
    );
    event CorrectionSubmitted(
        uint256 indexed batchId,
        bytes32 indexed taskId,
        address indexed editor,
        bytes32 correctionHash
    );
    event TaskAccepted(
        uint256 indexed batchId,
        bytes32 indexed taskId,
        address indexed editor,
        uint256 fee,
        address approver,
        bytes32 correctionHash
    );
    event TaskRejected(
        uint256 indexed batchId,
        bytes32 indexed taskId,
        address indexed approver,
        bytes32 reasonHash
    );
    event TaskExpired(uint256 indexed batchId, bytes32 indexed taskId, uint256 refundedFee);
    event FundsWithdrawn(uint256 indexed batchId, address indexed to, uint256 amount);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidExpiry();
    error Unauthorized();
    error BatchNotFound();
    error BatchExpired();
    error AgentIsRevoked();
    error ExceedsBudget();
    error ExceedsTaskFeeCap();
    error EditorNotTrusted();
    error InferenceAlreadyPaid();
    error TaskAlreadyExists();
    error TaskNotOpen();
    error TaskNotExpired();
    error TaskIsExpired();
    error SignatureExpired();
    error InvalidSignature();

    constructor(address tokenAddress) EIP712("SikioReviewEscrow", "1") {
        if (tokenAddress == address(0)) revert InvalidAddress();
        token = IERC20(tokenAddress);
    }

    /**
     * @notice Creates a new budget-bounded batch and optionally funds it with initial tUSD8.
     */
    function createBatch(
        address agent,
        address approver,
        uint256 maxBudget,
        uint256 maxTaskFee,
        uint64 expiry,
        bool enforceEditorAllowlist,
        bytes32 labelHash,
        uint256 initialDeposit
    ) external nonReentrant returns (uint256 batchId) {
        if (agent == address(0) || approver == address(0)) revert InvalidAddress();
        if (maxBudget == 0 || maxTaskFee == 0 || maxTaskFee > maxBudget) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (initialDeposit > maxBudget) revert ExceedsBudget();

        batchId = nextBatchId++;
        batches[batchId] = Batch({
            agency: msg.sender,
            agent: agent,
            approver: approver,
            maxBudget: maxBudget,
            funded: initialDeposit,
            spent: 0,
            reserved: 0,
            maxTaskFee: maxTaskFee,
            expiry: expiry,
            enforceEditorAllowlist: enforceEditorAllowlist,
            agentRevoked: false,
            labelHash: labelHash
        });

        if (initialDeposit > 0) {
            token.safeTransferFrom(msg.sender, address(this), initialDeposit);
            emit BatchFunded(batchId, msg.sender, initialDeposit, initialDeposit);
        }

        emit BatchCreated(
            batchId,
            msg.sender,
            agent,
            approver,
            maxBudget,
            maxTaskFee,
            expiry,
            enforceEditorAllowlist,
            labelHash
        );
    }

    /**
     * @notice Top up an existing batch's funded balance (up to maxBudget).
     */
    function fundBatch(uint256 batchId, uint256 amount) external nonReentrant {
        Batch storage b = _getBatch(batchId);
        if (amount == 0) revert InvalidAmount();
        if (b.funded + amount > b.maxBudget) revert ExceedsBudget();

        b.funded += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit BatchFunded(batchId, msg.sender, amount, b.funded);
    }

    /**
     * @notice Agency allowlists or removes a trusted editor for a batch.
     */
    function setTrustedEditor(uint256 batchId, address editor, bool allowed) external {
        Batch storage b = _getBatch(batchId);
        if (msg.sender != b.agency) revert Unauthorized();
        if (editor == address(0)) revert InvalidAddress();

        trustedEditors[batchId][editor] = allowed;
        emit TrustedEditorSet(batchId, editor, allowed);
    }

    /**
     * @notice Emergency kill-switch: agency immediately revokes the AI agent for this batch.
     */
    function revokeAgent(uint256 batchId) external {
        Batch storage b = _getBatch(batchId);
        if (msg.sender != b.agency) revert Unauthorized();

        b.agentRevoked = true;
        emit AgentRevoked(batchId, b.agent);
    }

    /**
     * @notice Agent pays an x402 AI transcription provider inside its approved batch budget.
     *         Each requestId can be settled at most once.
     */
    function payInference(
        uint256 batchId,
        bytes32 requestId,
        address provider,
        uint256 amount
    ) external nonReentrant {
        Batch storage b = _getBatch(batchId);
        _requireActiveAgent(b);
        if (provider == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > b.maxTaskFee) revert ExceedsTaskFeeCap();
        if (inferencePaid[requestId]) revert InferenceAlreadyPaid();
        if (availableBudget(batchId) < amount) revert ExceedsBudget();

        inferencePaid[requestId] = true;
        b.spent += amount;
        token.safeTransfer(provider, amount);

        emit InferencePaid(batchId, requestId, provider, amount);
    }

    /**
     * @notice Agent reserves a tUSD8 fee for a human micro-review task inside the batch budget.
     */
    function offerTask(
        uint256 batchId,
        bytes32 taskId,
        address editor,
        uint256 fee,
        uint64 taskExpiry,
        bytes32 excerptHash
    ) external nonReentrant {
        Batch storage b = _getBatch(batchId);
        _requireActiveAgent(b);
        if (editor == address(0)) revert InvalidAddress();
        if (tasks[taskId].status != TaskStatus.None) revert TaskAlreadyExists();
        if (fee == 0) revert InvalidAmount();
        if (fee > b.maxTaskFee) revert ExceedsTaskFeeCap();
        if (taskExpiry <= block.timestamp || taskExpiry > b.expiry) revert InvalidExpiry();
        if (b.enforceEditorAllowlist && !trustedEditors[batchId][editor]) revert EditorNotTrusted();
        if (availableBudget(batchId) < fee) revert ExceedsBudget();

        b.reserved += fee;
        tasks[taskId] = ReviewTask({
            batchId: batchId,
            editor: editor,
            fee: fee,
            expiry: taskExpiry,
            status: TaskStatus.Offered,
            excerptHash: excerptHash,
            correctionHash: bytes32(0)
        });

        emit TaskOffered(batchId, taskId, editor, fee, taskExpiry, excerptHash);
    }

    /**
     * @notice Direct editor submission of a correction hash.
     */
    function submitCorrection(bytes32 taskId, bytes32 correctionHash) external {
        ReviewTask storage t = tasks[taskId];
        if (t.status != TaskStatus.Offered) revert TaskNotOpen();
        if (msg.sender != t.editor) revert Unauthorized();
        if (block.timestamp > t.expiry) revert TaskIsExpired();

        t.status = TaskStatus.Submitted;
        t.correctionHash = correctionHash;
        emit CorrectionSubmitted(t.batchId, taskId, t.editor, correctionHash);
    }

    /**
     * @notice Gasless EIP-712 relayed submission so editors never need native tQDAY gas.
     */
    function submitCorrectionBySig(
        bytes32 taskId,
        bytes32 correctionHash,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        ReviewTask storage t = tasks[taskId];
        if (t.status != TaskStatus.Offered) revert TaskNotOpen();
        if (block.timestamp > t.expiry) revert TaskIsExpired();

        uint256 nonce = editorNonces[t.editor]++;
        bytes32 structHash = keccak256(
            abi.encode(SUBMIT_CORRECTION_TYPEHASH, taskId, correctionHash, nonce, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != t.editor) revert InvalidSignature();

        t.status = TaskStatus.Submitted;
        t.correctionHash = correctionHash;
        emit CorrectionSubmitted(t.batchId, taskId, t.editor, correctionHash);
    }

    /**
     * @notice Named approver (or agency owner) accepts a review task and settles tUSD8 to editor EXACTLY ONCE.
     */
    function acceptTask(bytes32 taskId) external nonReentrant {
        ReviewTask storage t = tasks[taskId];
        if (t.status != TaskStatus.Offered && t.status != TaskStatus.Submitted) revert TaskNotOpen();
        if (block.timestamp > t.expiry) revert TaskIsExpired();

        Batch storage b = batches[t.batchId];
        if (msg.sender != b.approver && msg.sender != b.agency) revert Unauthorized();

        t.status = TaskStatus.Accepted;
        b.reserved -= t.fee;
        b.spent += t.fee;

        token.safeTransfer(t.editor, t.fee);
        emit TaskAccepted(t.batchId, taskId, t.editor, t.fee, msg.sender, t.correctionHash);
    }

    /**
     * @notice Named approver (or agency owner) rejects an open/submitted task and returns the fee to budget.
     */
    function rejectTask(bytes32 taskId, bytes32 reasonHash) external nonReentrant {
        ReviewTask storage t = tasks[taskId];
        if (t.status != TaskStatus.Offered && t.status != TaskStatus.Submitted) revert TaskNotOpen();

        Batch storage b = batches[t.batchId];
        if (msg.sender != b.approver && msg.sender != b.agency) revert Unauthorized();

        t.status = TaskStatus.Rejected;
        b.reserved -= t.fee;

        emit TaskRejected(t.batchId, taskId, msg.sender, reasonHash);
    }

    /**
     * @notice Permissionless expiry settlement: returns reserved tUSD8 to the batch budget after taskExpiry.
     */
    function expireTask(bytes32 taskId) external nonReentrant {
        ReviewTask storage t = tasks[taskId];
        if (t.status != TaskStatus.Offered && t.status != TaskStatus.Submitted) revert TaskNotOpen();
        if (block.timestamp <= t.expiry) revert TaskNotExpired();

        Batch storage b = batches[t.batchId];
        t.status = TaskStatus.Expired;
        b.reserved -= t.fee;

        emit TaskExpired(t.batchId, taskId, t.fee);
    }

    /**
     * @notice Agency reclaims unspent, unreserved tUSD8 from the batch.
     *         Active reserved task escrows remain protected until accepted, rejected, or expired.
     */
    function withdrawAvailable(uint256 batchId, address to) external nonReentrant returns (uint256 amount) {
        Batch storage b = _getBatch(batchId);
        if (msg.sender != b.agency) revert Unauthorized();
        if (to == address(0)) revert InvalidAddress();

        amount = availableBudget(batchId);
        if (amount == 0) revert InvalidAmount();

        b.funded -= amount;
        token.safeTransfer(to, amount);
        emit FundsWithdrawn(batchId, to, amount);
    }

    /**
     * @notice Returns the currently spendable/reservable tUSD8 remaining in a batch.
     */
    function availableBudget(uint256 batchId) public view returns (uint256) {
        Batch storage b = batches[batchId];
        uint256 effectiveCap = b.funded < b.maxBudget ? b.funded : b.maxBudget;
        uint256 committed = b.spent + b.reserved;
        if (committed >= effectiveCap) return 0;
        return effectiveCap - committed;
    }

    function _getBatch(uint256 batchId) internal view returns (Batch storage b) {
        b = batches[batchId];
        if (b.agency == address(0)) revert BatchNotFound();
    }

    function _requireActiveAgent(Batch storage b) internal view {
        if (msg.sender != b.agent) revert Unauthorized();
        if (b.agentRevoked) revert AgentIsRevoked();
        if (block.timestamp > b.expiry) revert BatchExpired();
    }
}
