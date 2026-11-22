import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const TUSD8 = (n: string) => ethers.parseUnits(n, 6);

describe("Sikio ReviewEscrow (Aevum tUSD8)", () => {
  async function deployFixture() {
    const [agency, agent, approver, editor, otherEditor, provider, attacker] =
      await ethers.getSigners();

    const MockTUSD8 = await ethers.getContractFactory("MockTUSD8");
    const token = await MockTUSD8.deploy();
    await token.waitForDeployment();

    const ReviewEscrow = await ethers.getContractFactory("ReviewEscrow");
    const escrow = await ReviewEscrow.deploy(await token.getAddress());
    await escrow.waitForDeployment();

    // Fund agency with 100 tUSD8
    await token.mint(agency.address, TUSD8("100"));
    await token.connect(agency).approve(await escrow.getAddress(), TUSD8("100"));

    const now = await time.latest();
    const batchExpiry = now + 86400; // 24h
    const labelHash = ethers.id("lagos-fintech-ep14");

    await escrow
      .connect(agency)
      .createBatch(
        agent.address,
        approver.address,
        TUSD8("20"),
        TUSD8("0.50"),
        batchExpiry,
        true,
        labelHash,
        TUSD8("20")
      );

    await escrow.connect(agency).setTrustedEditor(1, editor.address, true);

    return {
      token,
      escrow,
      agency,
      agent,
      approver,
      editor,
      otherEditor,
      provider,
      attacker,
      batchExpiry,
    };
  }

  it("runs complete end-to-end flow: x402 inference -> offer -> submit -> accept once -> withdraw", async () => {
    const { token, escrow, agency, agent, approver, editor, provider, batchExpiry } =
      await deployFixture();

    // 1. Agent pays x402 AI transcription inside batch budget (0.04 tUSD8)
    const reqId = ethers.id("x402-req-001");
    await expect(
      escrow.connect(agent).payInference(1, reqId, provider.address, TUSD8("0.04"))
    )
      .to.emit(escrow, "InferencePaid")
      .withArgs(1, reqId, provider.address, TUSD8("0.04"));

    expect(await token.balanceOf(provider.address)).to.equal(TUSD8("0.04"));
    expect(await escrow.availableBudget(1)).to.equal(TUSD8("19.96"));

    // 2. Agent offers micro-review task (0.25 tUSD8)
    const taskId = ethers.id("task-clip1-seg1");
    const excerptHash = ethers.id("audio:00:08.0-00:13.2");
    await expect(
      escrow
        .connect(agent)
        .offerTask(1, taskId, editor.address, TUSD8("0.25"), batchExpiry - 60, excerptHash)
    )
      .to.emit(escrow, "TaskOffered")
      .withArgs(1, taskId, editor.address, TUSD8("0.25"), batchExpiry - 60, excerptHash);

    expect(await escrow.availableBudget(1)).to.equal(TUSD8("19.71"));

    // 3. Editor submits correction
    const correctionHash = ethers.id("Paystack instead of Pay stark");
    await expect(escrow.connect(editor).submitCorrection(taskId, correctionHash))
      .to.emit(escrow, "CorrectionSubmitted")
      .withArgs(1, taskId, editor.address, correctionHash);

    // 4. Approver accepts -> pays editor exactly once
    await expect(escrow.connect(approver).acceptTask(taskId))
      .to.emit(escrow, "TaskAccepted")
      .withArgs(1, taskId, editor.address, TUSD8("0.25"), approver.address, correctionHash);

    expect(await token.balanceOf(editor.address)).to.equal(TUSD8("0.25"));
    expect(await escrow.availableBudget(1)).to.equal(TUSD8("19.71"));

    // 5. Agency withdraws unused balance
    const balBefore = await token.balanceOf(agency.address);
    await escrow.connect(agency).withdrawAvailable(1, agency.address);
    expect((await token.balanceOf(agency.address)) - balBefore).to.equal(TUSD8("19.71"));
  });

  it("prevents double payment on repeated acceptTask calls", async () => {
    const { token, escrow, agent, approver, editor, batchExpiry } = await deployFixture();
    const taskId = ethers.id("task-no-double-pay");

    await escrow
      .connect(agent)
      .offerTask(1, taskId, editor.address, TUSD8("0.30"), batchExpiry - 60, ethers.id("ex"));
    await escrow.connect(approver).acceptTask(taskId);

    await expect(escrow.connect(approver).acceptTask(taskId)).to.be.revertedWithCustomError(
      escrow,
      "TaskNotOpen"
    );
    expect(await token.balanceOf(editor.address)).to.equal(TUSD8("0.30"));
  });

  it("prevents double payment of the same x402 inference requestId", async () => {
    const { escrow, agent, provider } = await deployFixture();
    const reqId = ethers.id("x402-dup-req");

    await escrow.connect(agent).payInference(1, reqId, provider.address, TUSD8("0.05"));
    await expect(
      escrow.connect(agent).payInference(1, reqId, provider.address, TUSD8("0.05"))
    ).to.be.revertedWithCustomError(escrow, "InferenceAlreadyPaid");
  });

  it("enforces per-task fee ceiling (maxTaskFee)", async () => {
    const { escrow, agent, editor, batchExpiry } = await deployFixture();
    await expect(
      escrow
        .connect(agent)
        .offerTask(1, ethers.id("too-pricey"), editor.address, TUSD8("0.51"), batchExpiry - 60, ethers.id("ex"))
    ).to.be.revertedWithCustomError(escrow, "ExceedsTaskFeeCap");
  });

  it("enforces total batch budget cap across inference and tasks", async () => {
    const { escrow, agency, agent, editor, batchExpiry } = await deployFixture();
    // Create a tight 0.60 tUSD8 batch with 0.50 maxTaskFee
    await escrow
      .connect(agency)
      .createBatch(
        agent.address,
        agency.address,
        TUSD8("0.60"),
        TUSD8("0.50"),
        batchExpiry,
        false,
        ethers.id("tight-batch"),
        TUSD8("0.60")
      );

    await escrow
      .connect(agent)
      .offerTask(2, ethers.id("t1"), editor.address, TUSD8("0.40"), batchExpiry - 60, ethers.id("e1"));

    await expect(
      escrow
        .connect(agent)
        .offerTask(2, ethers.id("t2"), editor.address, TUSD8("0.25"), batchExpiry - 60, ethers.id("e2"))
    ).to.be.revertedWithCustomError(escrow, "ExceedsBudget");
  });

  it("enforces trusted editor allowlist", async () => {
    const { escrow, agent, otherEditor, batchExpiry } = await deployFixture();
    await expect(
      escrow
        .connect(agent)
        .offerTask(1, ethers.id("untrusted"), otherEditor.address, TUSD8("0.20"), batchExpiry - 60, ethers.id("ex"))
    ).to.be.revertedWithCustomError(escrow, "EditorNotTrusted");
  });

  it("blocks unauthorized approvers from accepting or rejecting tasks", async () => {
    const { escrow, agent, editor, attacker, batchExpiry } = await deployFixture();
    const taskId = ethers.id("task-auth-check");
    await escrow
      .connect(agent)
      .offerTask(1, taskId, editor.address, TUSD8("0.20"), batchExpiry - 60, ethers.id("ex"));

    await expect(escrow.connect(attacker).acceptTask(taskId)).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
    await expect(escrow.connect(agent).acceptTask(taskId)).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
    await expect(escrow.connect(editor).acceptTask(taskId)).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
  });

  it("returns reserved fee to budget on task expiry and blocks late accept", async () => {
    const { escrow, agent, approver, editor, attacker } = await deployFixture();
    const now = await time.latest();
    const shortExpiry = now + 120;
    const taskId = ethers.id("task-expiring");

    await escrow
      .connect(agent)
      .offerTask(1, taskId, editor.address, TUSD8("0.45"), shortExpiry, ethers.id("ex"));
    expect(await escrow.availableBudget(1)).to.equal(TUSD8("19.55"));

    // Cannot expire early
    await expect(escrow.connect(attacker).expireTask(taskId)).to.be.revertedWithCustomError(
      escrow,
      "TaskNotExpired"
    );

    // Advance past expiry
    await time.increaseTo(shortExpiry + 1);

    // Approver cannot accept expired task
    await expect(escrow.connect(approver).acceptTask(taskId)).to.be.revertedWithCustomError(
      escrow,
      "TaskIsExpired"
    );

    // Anyone can settle expiry -> returns 0.45 to available budget
    await expect(escrow.connect(attacker).expireTask(taskId))
      .to.emit(escrow, "TaskExpired")
      .withArgs(1, taskId, TUSD8("0.45"));

    expect(await escrow.availableBudget(1)).to.equal(TUSD8("20.00"));
  });

  it("returns reserved fee to budget when approver rejects task", async () => {
    const { escrow, agent, approver, editor, batchExpiry } = await deployFixture();
    const taskId = ethers.id("task-reject");
    await escrow
      .connect(agent)
      .offerTask(1, taskId, editor.address, TUSD8("0.35"), batchExpiry - 60, ethers.id("ex"));

    await expect(escrow.connect(approver).rejectTask(taskId, ethers.id("wrong-spelling")))
      .to.emit(escrow, "TaskRejected")
      .withArgs(1, taskId, approver.address, ethers.id("wrong-spelling"));

    expect(await escrow.availableBudget(1)).to.equal(TUSD8("20.00"));
  });

  it("blocks agent immediately after emergency revokeAgent kill-switch while preserving active tasks", async () => {
    const { escrow, agency, agent, approver, editor, batchExpiry } = await deployFixture();
    const existingTask = ethers.id("task-before-revoke");
    await escrow
      .connect(agent)
      .offerTask(1, existingTask, editor.address, TUSD8("0.20"), batchExpiry - 60, ethers.id("ex"));

    await expect(escrow.connect(agency).revokeAgent(1))
      .to.emit(escrow, "AgentRevoked")
      .withArgs(1, agent.address);

    await expect(
      escrow
        .connect(agent)
        .offerTask(1, ethers.id("after-revoke"), editor.address, TUSD8("0.20"), batchExpiry - 60, ethers.id("ex2"))
    ).to.be.revertedWithCustomError(escrow, "AgentIsRevoked");

    // Existing offered task can still be fairly accepted by approver
    await escrow.connect(approver).acceptTask(existingTask);
  });

  it("supports zero-gas editor correction via EIP-712 relayed submitCorrectionBySig", async () => {
    const { escrow, agent, approver, editor, attacker, batchExpiry } = await deployFixture();
    const taskId = ethers.id("task-gasless-sig");
    const correctionHash = ethers.id("Nairobi matatu crew");

    await escrow
      .connect(agent)
      .offerTask(1, taskId, editor.address, TUSD8("0.25"), batchExpiry - 60, ethers.id("ex"));

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deadline = (await time.latest()) + 600;
    const nonce = await escrow.editorNonces(editor.address);

    const domain = {
      name: "SikioReviewEscrow",
      version: "1",
      chainId,
      verifyingContract: await escrow.getAddress(),
    };
    const types = {
      SubmitCorrection: [
        { name: "taskId", type: "bytes32" },
        { name: "correctionHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const signature = await editor.signTypedData(domain, types, {
      taskId,
      correctionHash,
      nonce,
      deadline,
    });

    // Any third-party relayer (here `attacker` acting as sponsor) submits without editor needing tQDAY
    await expect(
      escrow.connect(attacker).submitCorrectionBySig(taskId, correctionHash, deadline, signature)
    )
      .to.emit(escrow, "CorrectionSubmitted")
      .withArgs(1, taskId, editor.address, correctionHash);

    await escrow.connect(approver).acceptTask(taskId);
  });

  it("blocks agent activity after batch expiry", async () => {
    const { escrow, agent, editor, provider, batchExpiry } = await deployFixture();
    await time.increaseTo(batchExpiry + 1);

    await expect(
      escrow.connect(agent).payInference(1, ethers.id("late-req"), provider.address, TUSD8("0.02"))
    ).to.be.revertedWithCustomError(escrow, "BatchExpired");

    await expect(
      escrow
        .connect(agent)
        .offerTask(1, ethers.id("late-task"), editor.address, TUSD8("0.10"), batchExpiry + 100, ethers.id("ex"))
    ).to.be.revertedWithCustomError(escrow, "BatchExpired");
  });
});
