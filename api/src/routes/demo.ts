import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { sql } from "drizzle-orm";
import { runSeed } from "../db/seed.js";

const { agents, decisions, reviews, auditLog } = schema;

// ─── Drip pool: pre-written decisions to drip during live demos ──
const DRIP_POOL = [
  {
    agentWorkflow: "loan_pre_approval",
    proposedAction: "Approve $31,000 personal loan for applicant #11200",
    confidence: 0.55,
    riskTier: "high" as const,
    context: {
      summary: "Personal loan — applicant address mismatch with employer records",
      facts: [
        { label: "Applicant income", value: "$64,000 / yr" },
        { label: "Requested amount", value: "$31,000" },
        { label: "Address on file", value: "123 Oak St, Denver CO" },
        { label: "Employer address record", value: "789 Elm Ave, Phoenix AZ", flag: "address_mismatch" },
        { label: "Credit score", value: "668" },
      ],
      policy_note: "Address discrepancy between applicant and employer records requires identity verification per policy LP-18.",
    },
    similarCases: [
      { ref: "#11100", summary: "Address mismatch, recent relocation confirmed", resolved: "approved" },
      { ref: "#11050", summary: "Address mismatch, identity fraud confirmed", resolved: "rejected" },
    ],
  },
  {
    agentWorkflow: "insurance_claims",
    proposedAction: "Approve $9,800 auto collision claim for policy #CLM-12100",
    confidence: 0.62,
    riskTier: "medium" as const,
    context: {
      summary: "Auto claim — police report conflicts with claimant statement",
      facts: [
        { label: "Claim type", value: "Rear collision at intersection" },
        { label: "Repair estimate", value: "$9,800" },
        { label: "Police report", value: "States claimant ran red light", flag: "conflicting_report" },
        { label: "Claimant statement", value: "Light was yellow" },
        { label: "Witnesses", value: "1 — supports police report" },
      ],
      policy_note: "Conflicting statements between police report and claimant require SIU referral per policy AC-15.",
    },
    similarCases: [
      { ref: "#CLM-12000", summary: "Minor conflict in statements, resolved via dash cam", resolved: "approved" },
      { ref: "#CLM-11800", summary: "Major conflict, fraud investigation opened", resolved: "rejected" },
    ],
  },
  {
    agentWorkflow: "wire_transfers",
    proposedAction: "Execute $55,000 wire transfer for account #WR-12500",
    confidence: 0.47,
    riskTier: "high" as const,
    context: {
      summary: "Wire transfer — account owner reported phone stolen yesterday",
      facts: [
        { label: "Transfer amount", value: "$55,000" },
        { label: "Phone stolen report", value: "Filed yesterday", flag: "compromised_device" },
        { label: "Wire initiated via", value: "Mobile app" },
        { label: "Payee", value: "New — first transaction" },
        { label: "Destination", value: "International — Nigeria", flag: "high_risk_jurisdiction" },
      ],
      policy_note: "Wire requests from potentially compromised devices require verbal confirmation per policy WT-10.",
    },
    similarCases: [
      { ref: "#WR-12400", summary: "$40k mobile wire after phone theft, unauthorized", resolved: "rejected" },
      { ref: "#WR-12300", summary: "Phone replaced, customer confirmed in branch", resolved: "approved" },
    ],
  },
  {
    agentWorkflow: "loan_pre_approval",
    proposedAction: "Approve $19,500 auto loan for applicant #11500",
    confidence: 0.88,
    riskTier: "low" as const,
    context: {
      summary: "Auto loan — standard application, all metrics within guidelines",
      facts: [
        { label: "Applicant income", value: "$71,000 / yr" },
        { label: "Vehicle value", value: "$24,000" },
        { label: "Requested loan", value: "$19,500" },
        { label: "LTV", value: "81%" },
        { label: "Credit score", value: "742" },
      ],
      policy_note: "All metrics within standard approval thresholds.",
    },
    similarCases: [
      { ref: "#11480", summary: "$20k auto loan, 78% LTV, 750 FICO", resolved: "approved" },
    ],
  },
  {
    agentWorkflow: "insurance_claims",
    proposedAction: "Approve $2,400 glass replacement claim for policy #CLM-12800",
    confidence: 0.91,
    riskTier: "low" as const,
    context: {
      summary: "Auto glass claim — rock chip escalated to full replacement",
      facts: [
        { label: "Claim type", value: "Windshield replacement" },
        { label: "Repair cost", value: "$2,400" },
        { label: "Cause", value: "Highway rock chip — crack spread" },
        { label: "Prior glass claims", value: "0" },
        { label: "Deductible", value: "$0 (comprehensive)" },
      ],
      policy_note: "Standard glass claim under comprehensive coverage. No flags.",
    },
    similarCases: [
      { ref: "#CLM-12700", summary: "Rock chip windshield, $2,200", resolved: "approved" },
    ],
  },
  {
    agentWorkflow: "wire_transfers",
    proposedAction: "Execute $28,000 wire transfer for account #WR-13000",
    confidence: 0.64,
    riskTier: "medium" as const,
    context: {
      summary: "Wire transfer — round-number amount to newly added payee",
      facts: [
        { label: "Transfer amount", value: "$28,000", flag: "round_amount" },
        { label: "Payee added", value: "2 hours ago", flag: "recent_payee" },
        { label: "Stated purpose", value: "Vehicle purchase" },
        { label: "Prior similar transactions", value: "0" },
        { label: "Account age", value: "4 years" },
      ],
      policy_note: "Round amounts to recently added payees flagged for confirmation per policy WT-07.",
    },
    similarCases: [
      { ref: "#WR-12900", summary: "$30k to new payee, vehicle purchase verified via title", resolved: "approved" },
      { ref: "#WR-12850", summary: "$25k to new payee, social engineering scam", resolved: "rejected" },
    ],
  },
  {
    agentWorkflow: "loan_pre_approval",
    proposedAction: "Approve $85,000 home renovation loan for applicant #11800",
    confidence: 0.58,
    riskTier: "high" as const,
    context: {
      summary: "Renovation loan — amount exceeds property improvement cap",
      facts: [
        { label: "Property value", value: "$280,000" },
        { label: "Renovation budget", value: "$85,000", flag: "exceeds_cap" },
        { label: "Max improvement loan (25%)", value: "$70,000" },
        { label: "Contractor licensed", value: "Yes" },
        { label: "Credit score", value: "715" },
      ],
      policy_note: "Renovation loans exceeding 25% of property value require additional appraisal per policy HL-06.",
    },
    similarCases: [
      { ref: "#11750", summary: "$60k reno on $250k property (24%), approved", resolved: "approved" },
      { ref: "#11700", summary: "$90k reno on $270k property (33%), denied", resolved: "rejected" },
    ],
  },
  {
    agentWorkflow: "insurance_claims",
    proposedAction: "Approve $35,000 jewelry theft claim for policy #CLM-13200",
    confidence: 0.42,
    riskTier: "high" as const,
    context: {
      summary: "Valuable articles claim — no appraisal on file for claimed items",
      facts: [
        { label: "Claim type", value: "Burglary — jewelry" },
        { label: "Claimed value", value: "$35,000", flag: "no_appraisal" },
        { label: "Scheduled items", value: "None — blanket coverage only" },
        { label: "Police report", value: "Filed — no suspects" },
        { label: "Blanket limit", value: "$10,000", flag: "exceeds_sublimit" },
      ],
      policy_note: "Claim exceeds unscheduled jewelry sublimit. Maximum payout capped at $10,000 unless rider exists.",
    },
    similarCases: [
      { ref: "#CLM-13100", summary: "Jewelry theft, scheduled items, full payout", resolved: "approved" },
      { ref: "#CLM-13000", summary: "Jewelry theft, no schedule, capped at sublimit", resolved: "rejected" },
    ],
  },
];

let dripIndex = 0;

export async function demoRoutes(app: FastifyInstance) {
  // POST /api/demo/drip — insert one new pending decision
  app.post("/api/demo/drip", async () => {
    const template = DRIP_POOL[dripIndex % DRIP_POOL.length];
    dripIndex++;

    // Find the matching agent
    const [agent] = await db
      .select()
      .from(agents)
      .where(sql`${agents.workflow} = ${template.agentWorkflow}`);

    if (!agent) {
      return { error: "No matching agent found" };
    }

    const [decision] = await db
      .insert(decisions)
      .values({
        agentId: agent.id,
        status: "pending",
        proposedAction: template.proposedAction,
        confidence: template.confidence,
        riskTier: template.riskTier,
        context: template.context,
        similarCases: template.similarCases,
      })
      .returning();

    // Audit log entry
    await db.insert(auditLog).values({
      decisionId: decision.id,
      eventType: "decision_created",
      snapshot: {
        decision_id: decision.id,
        agent: agent.name,
        proposed_action: decision.proposedAction,
        confidence: decision.confidence,
        risk_tier: decision.riskTier,
        context: template.context,
      },
    });

    return { dripped: decision.id, action: decision.proposedAction };
  });

  // POST /api/demo/reset — wipe and re-seed with full hand-authored data
  app.post("/api/demo/reset", async () => {
    const count = await runSeed();
    dripIndex = 0;
    return { status: "reset", decisions_seeded: count };
  });
}
