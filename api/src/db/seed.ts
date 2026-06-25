import "dotenv/config";
import { db, schema } from "./index.js";
import { sql } from "drizzle-orm";

const { agents, decisions, auditLog, reviews } = schema;

// ─── Agents ──────────────────────────────────────────────────
const AGENTS = [
  {
    name: "LoanPreApprovalBot",
    workflow: "loan_pre_approval",
    autonomyThreshold: 0.85,
  },
  {
    name: "ClaimsAdjudicator",
    workflow: "insurance_claims",
    autonomyThreshold: 0.9,
  },
  {
    name: "WireTransferValidator",
    workflow: "wire_transfers",
    autonomyThreshold: 0.92,
  },
] as const;

// ─── Decision templates (hand-authored) ─────────────────────
// Each template has context facts and similar_cases that read like real cases.
// Templates are tagged with a risk tier and confidence range.

interface Fact {
  label: string;
  value: string;
  flag?: string;
}

interface SimilarCase {
  ref: string;
  summary: string;
  resolved: string;
}

interface DecisionTemplate {
  agentIndex: number;
  proposedAction: string;
  confidence: number;
  riskTier: "low" | "medium" | "high";
  context: {
    summary: string;
    facts: Fact[];
    policy_note: string;
  };
  similarCases: SimilarCase[];
}

const DECISION_TEMPLATES: DecisionTemplate[] = [
  // ── HIGH RISK (8 templates) ────────────────────────────────
  {
    agentIndex: 0,
    proposedAction: "Approve $42,000 personal loan for applicant #8841",
    confidence: 0.52,
    riskTier: "high",
    context: {
      summary: "Personal loan pre-approval — high DTI with stale documentation",
      facts: [
        { label: "Applicant income", value: "$78,000 / yr" },
        { label: "Debt-to-income ratio", value: "41%", flag: "borderline" },
        { label: "Requested amount", value: "$42,000" },
        { label: "Income document age", value: "60 days", flag: "stale" },
        { label: "Credit score", value: "681" },
      ],
      policy_note: "DTI above 40% requires manual review per policy LP-12.",
    },
    similarCases: [
      { ref: "#8722", summary: "DTI 39%, fresh docs", resolved: "approved" },
      { ref: "#8610", summary: "DTI 43%, stale income doc", resolved: "rejected" },
      { ref: "#8455", summary: "DTI 41%, verified employer", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $95,000 home equity line for applicant #7203",
    confidence: 0.41,
    riskTier: "high",
    context: {
      summary: "HELOC application — amount exceeds 80% of available equity",
      facts: [
        { label: "Property value", value: "$310,000" },
        { label: "Outstanding mortgage", value: "$195,000" },
        { label: "Available equity", value: "$115,000" },
        { label: "Requested HELOC", value: "$95,000", flag: "exceeds_guideline" },
        { label: "Combined LTV", value: "93.5%", flag: "high_ltv" },
      ],
      policy_note: "Combined LTV above 90% requires VP-level approval per policy HE-04.",
    },
    similarCases: [
      { ref: "#7101", summary: "CLTV 88%, $80k HELOC", resolved: "approved" },
      { ref: "#6844", summary: "CLTV 94%, $110k HELOC", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $28,000 auto loan for applicant #9102",
    confidence: 0.48,
    riskTier: "high",
    context: {
      summary: "Auto loan — recent bankruptcy on record",
      facts: [
        { label: "Applicant income", value: "$55,000 / yr" },
        { label: "Requested amount", value: "$28,000" },
        { label: "Credit score", value: "592", flag: "subprime" },
        { label: "Bankruptcy discharge", value: "11 months ago", flag: "recent_bankruptcy" },
        { label: "Down payment", value: "5%" },
      ],
      policy_note: "Applicants within 12 months of bankruptcy discharge require director approval per policy AL-07.",
    },
    similarCases: [
      { ref: "#8990", summary: "BK 14 months ago, 620 FICO", resolved: "approved" },
      { ref: "#8875", summary: "BK 8 months ago, 580 FICO", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $18,500 water damage claim for policy #CLM-4419",
    confidence: 0.44,
    riskTier: "high",
    context: {
      summary: "Homeowner claim — repair estimate significantly exceeds adjuster average",
      facts: [
        { label: "Claim type", value: "Water damage — burst pipe" },
        { label: "Submitted estimate", value: "$18,500", flag: "above_avg" },
        { label: "Adjuster avg for similar", value: "$11,200" },
        { label: "Variance", value: "+65%", flag: "high_variance" },
        { label: "Policy deductible", value: "$1,000" },
      ],
      policy_note: "Claims exceeding adjuster average by >40% require field inspection per policy CL-22.",
    },
    similarCases: [
      { ref: "#CLM-4301", summary: "Water damage, $12k estimate, +15% variance", resolved: "approved" },
      { ref: "#CLM-4105", summary: "Water damage, $22k estimate, +80% variance", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $47,200 fire damage claim for policy #CLM-5501",
    confidence: 0.38,
    riskTier: "high",
    context: {
      summary: "Fire claim — policy purchased 45 days before incident",
      facts: [
        { label: "Claim type", value: "Kitchen fire — total loss" },
        { label: "Claim amount", value: "$47,200" },
        { label: "Policy inception", value: "45 days before loss", flag: "new_policy" },
        { label: "Prior claims", value: "2 claims in 18 months", flag: "frequent_claimant" },
        { label: "Investigation status", value: "Pending" },
      ],
      policy_note: "Claims within 60 days of policy inception flagged for SIU review per policy FR-03.",
    },
    similarCases: [
      { ref: "#CLM-5200", summary: "Fire claim, policy 30 days old, SIU found fraud", resolved: "rejected" },
      { ref: "#CLM-5388", summary: "Fire claim, policy 90 days old, legitimate", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $125,000 wire transfer to new payee for account #WR-8831",
    confidence: 0.39,
    riskTier: "high",
    context: {
      summary: "Wire transfer — new international payee with amount spike",
      facts: [
        { label: "Transfer amount", value: "$125,000", flag: "amount_spike" },
        { label: "Avg transfer (90d)", value: "$8,200" },
        { label: "Payee", value: "First registered today", flag: "new_payee" },
        { label: "Destination", value: "Offshore intermediary bank" },
        { label: "Account age", value: "6 months" },
      ],
      policy_note: "Transfers >10x 90-day average to new payees require enhanced due diligence per BSA/AML policy WT-01.",
    },
    similarCases: [
      { ref: "#WR-8700", summary: "$95k to new payee, confirmed business acquisition", resolved: "approved" },
      { ref: "#WR-8622", summary: "$150k to new offshore payee, flagged SAR", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $78,000 wire transfer for account #WR-9044",
    confidence: 0.45,
    riskTier: "high",
    context: {
      summary: "Wire transfer — structured below CTR threshold across multiple transactions",
      facts: [
        { label: "Transfer amount", value: "$78,000" },
        { label: "Related transfers (7d)", value: "3 wires totaling $28,500", flag: "structuring_pattern" },
        { label: "Combined 7-day total", value: "$106,500" },
        { label: "Payee country", value: "Cayman Islands", flag: "high_risk_jurisdiction" },
        { label: "Customer risk rating", value: "Elevated" },
      ],
      policy_note: "Potential structuring pattern detected. Review required under BSA policy WT-05.",
    },
    similarCases: [
      { ref: "#WR-8900", summary: "$60k wire, 2 related transfers, verified business", resolved: "approved" },
      { ref: "#WR-8811", summary: "$85k wire, structuring pattern, SAR filed", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $150,000 business line of credit for applicant #6050",
    confidence: 0.43,
    riskTier: "high",
    context: {
      summary: "Business LOC — negative cash flow in recent quarters",
      facts: [
        { label: "Business revenue", value: "$420,000 / yr" },
        { label: "Net cash flow (Q3)", value: "-$18,000", flag: "negative_cashflow" },
        { label: "Net cash flow (Q4)", value: "-$6,500", flag: "negative_cashflow" },
        { label: "Requested LOC", value: "$150,000" },
        { label: "Existing debt", value: "$210,000" },
      ],
      policy_note: "Two consecutive quarters of negative cash flow triggers enhanced review per policy BL-09.",
    },
    similarCases: [
      { ref: "#6001", summary: "1 quarter negative CF, strong Q4 rebound", resolved: "approved" },
      { ref: "#5877", summary: "3 quarters negative CF, declining revenue", resolved: "rejected" },
    ],
  },

  // ── MEDIUM RISK (15 templates) ─────────────────────────────
  {
    agentIndex: 0,
    proposedAction: "Approve $22,000 personal loan for applicant #9310",
    confidence: 0.72,
    riskTier: "medium",
    context: {
      summary: "Personal loan — employment gap in recent history",
      facts: [
        { label: "Applicant income", value: "$65,000 / yr" },
        { label: "DTI ratio", value: "34%" },
        { label: "Employment gap", value: "3 months (ended 6 months ago)", flag: "employment_gap" },
        { label: "Credit score", value: "710" },
        { label: "Requested amount", value: "$22,000" },
      ],
      policy_note: "Employment gaps within 12 months require verification of current employer stability.",
    },
    similarCases: [
      { ref: "#9205", summary: "2-month gap, re-employed 8 months", resolved: "approved" },
      { ref: "#9150", summary: "5-month gap, temp contract", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $35,000 debt consolidation loan for applicant #8550",
    confidence: 0.68,
    riskTier: "medium",
    context: {
      summary: "Debt consolidation — multiple recent credit inquiries",
      facts: [
        { label: "Applicant income", value: "$82,000 / yr" },
        { label: "Outstanding debts", value: "$38,500 across 4 accounts" },
        { label: "Credit inquiries (6mo)", value: "7", flag: "multiple_inquiries" },
        { label: "Credit score", value: "695" },
        { label: "Requested amount", value: "$35,000" },
      ],
      policy_note: "More than 5 inquiries in 6 months may indicate credit-seeking behavior. Verify purpose.",
    },
    similarCases: [
      { ref: "#8490", summary: "5 inquiries, consolidating student loans", resolved: "approved" },
      { ref: "#8301", summary: "9 inquiries, multiple new accounts", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $18,500 auto loan for applicant #9455",
    confidence: 0.74,
    riskTier: "medium",
    context: {
      summary: "Auto loan — vehicle value below loan amount",
      facts: [
        { label: "Applicant income", value: "$58,000 / yr" },
        { label: "Vehicle value (KBB)", value: "$16,200" },
        { label: "Requested loan", value: "$18,500", flag: "underwater" },
        { label: "LTV", value: "114%", flag: "high_ltv" },
        { label: "Credit score", value: "720" },
      ],
      policy_note: "Auto loans with LTV > 110% require additional collateral or gap insurance verification.",
    },
    similarCases: [
      { ref: "#9400", summary: "LTV 108%, gap insurance purchased", resolved: "approved" },
      { ref: "#9322", summary: "LTV 120%, no gap insurance", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $8,400 fender-bender claim for policy #CLM-6622",
    confidence: 0.70,
    riskTier: "medium",
    context: {
      summary: "Auto claim — third claim in 12 months",
      facts: [
        { label: "Claim type", value: "Rear-end collision" },
        { label: "Repair estimate", value: "$8,400" },
        { label: "Claims in 12 months", value: "3", flag: "frequent_claimant" },
        { label: "At-fault", value: "Yes" },
        { label: "Policy premium", value: "$2,100 / yr" },
      ],
      policy_note: "Third at-fault claim within 12 months triggers loss-ratio review per policy AC-11.",
    },
    similarCases: [
      { ref: "#CLM-6500", summary: "3rd claim, $5k repair, retained with surcharge", resolved: "approved" },
      { ref: "#CLM-6311", summary: "4th claim, $12k repair, policy non-renewed", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $14,200 roof damage claim for policy #CLM-7788",
    confidence: 0.66,
    riskTier: "medium",
    context: {
      summary: "Homeowner claim — roof age near end of coverage",
      facts: [
        { label: "Claim type", value: "Wind/hail damage" },
        { label: "Roof age", value: "18 years", flag: "aging_roof" },
        { label: "Roof coverage limit", value: "ACV (actual cash value)" },
        { label: "Repair estimate", value: "$14,200" },
        { label: "Depreciation applied", value: "$5,800" },
      ],
      policy_note: "Roofs older than 15 years are subject to ACV depreciation. Confirm customer expectations.",
    },
    similarCases: [
      { ref: "#CLM-7650", summary: "16yr roof, ACV applied, customer accepted", resolved: "approved" },
      { ref: "#CLM-7500", summary: "20yr roof, customer disputed depreciation", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $45,000 wire transfer for account #WR-7200",
    confidence: 0.71,
    riskTier: "medium",
    context: {
      summary: "Wire transfer — first international wire for this account",
      facts: [
        { label: "Transfer amount", value: "$45,000" },
        { label: "Destination", value: "United Kingdom" },
        { label: "Account history", value: "Domestic only until now", flag: "first_international" },
        { label: "Account age", value: "3 years" },
        { label: "Stated purpose", value: "Property deposit" },
      ],
      policy_note: "First international wire requires one-time enhanced verification per policy WT-03.",
    },
    similarCases: [
      { ref: "#WR-7100", summary: "$50k first intl wire, property purchase verified", resolved: "approved" },
      { ref: "#WR-7055", summary: "$30k first intl wire, could not verify purpose", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $22,000 wire transfer for account #WR-8100",
    confidence: 0.69,
    riskTier: "medium",
    context: {
      summary: "Wire transfer — payee name mismatch with invoice",
      facts: [
        { label: "Transfer amount", value: "$22,000" },
        { label: "Payee on wire", value: "Oceanic Trading LLC" },
        { label: "Payee on invoice", value: "Oceanic Trade Corp", flag: "name_mismatch" },
        { label: "Destination", value: "Domestic — Florida" },
        { label: "Customer relationship", value: "5 years" },
      ],
      policy_note: "Payee name discrepancies require customer confirmation per policy WT-04.",
    },
    similarCases: [
      { ref: "#WR-8010", summary: "Minor name variant, confirmed by customer", resolved: "approved" },
      { ref: "#WR-7990", summary: "Different entity entirely, wire blocked", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $55,000 small business loan for applicant #7780",
    confidence: 0.65,
    riskTier: "medium",
    context: {
      summary: "SBA loan — business less than 2 years old",
      facts: [
        { label: "Business age", value: "14 months", flag: "young_business" },
        { label: "Annual revenue", value: "$180,000" },
        { label: "Requested amount", value: "$55,000" },
        { label: "Personal guarantee", value: "Yes" },
        { label: "Owner credit score", value: "735" },
      ],
      policy_note: "Businesses under 24 months require personal guarantee and additional revenue documentation.",
    },
    similarCases: [
      { ref: "#7700", summary: "18-month-old business, strong revenue trend", resolved: "approved" },
      { ref: "#7650", summary: "10-month-old business, declining revenue", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $12,000 credit limit increase for applicant #9988",
    confidence: 0.73,
    riskTier: "medium",
    context: {
      summary: "Credit limit increase — utilization spike in recent month",
      facts: [
        { label: "Current limit", value: "$15,000" },
        { label: "Requested limit", value: "$27,000" },
        { label: "Avg utilization (6mo)", value: "32%" },
        { label: "Current utilization", value: "89%", flag: "high_utilization" },
        { label: "Payment history", value: "On time — 24 months" },
      ],
      policy_note: "Utilization above 80% at time of request requires review of spending pattern changes.",
    },
    similarCases: [
      { ref: "#9950", summary: "Spike due to one-time purchase, paid down next month", resolved: "approved" },
      { ref: "#9900", summary: "Sustained high utilization, minimum payments", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $6,200 medical equipment claim for policy #CLM-8900",
    confidence: 0.67,
    riskTier: "medium",
    context: {
      summary: "Business insurance claim — equipment not on declared asset list",
      facts: [
        { label: "Claim type", value: "Theft — medical equipment" },
        { label: "Claimed value", value: "$6,200" },
        { label: "On asset schedule", value: "Not listed", flag: "undeclared_asset" },
        { label: "Purchase receipt", value: "Provided" },
        { label: "Policy type", value: "Business property" },
      ],
      policy_note: "Undeclared assets may be covered under blanket provision. Verify purchase date vs. policy inception.",
    },
    similarCases: [
      { ref: "#CLM-8800", summary: "Undeclared laptop, purchased after inception", resolved: "approved" },
      { ref: "#CLM-8700", summary: "Undeclared equipment, purchased before inception", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $33,000 wire transfer for account #WR-6500",
    confidence: 0.68,
    riskTier: "medium",
    context: {
      summary: "Wire transfer — unusually late submission time",
      facts: [
        { label: "Transfer amount", value: "$33,000" },
        { label: "Submission time", value: "11:47 PM EST", flag: "after_hours" },
        { label: "Usual activity window", value: "9 AM – 5 PM EST" },
        { label: "Payee", value: "Established vendor (2 years)" },
        { label: "Destination", value: "Domestic — New York" },
      ],
      policy_note: "After-hours wire submissions above $10k require next-business-day confirmation per policy WT-06.",
    },
    similarCases: [
      { ref: "#WR-6400", summary: "$25k after-hours, customer on business trip", resolved: "approved" },
      { ref: "#WR-6350", summary: "$50k after-hours, compromised credentials", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $40,000 personal loan for applicant #8200",
    confidence: 0.70,
    riskTier: "medium",
    context: {
      summary: "Personal loan — income from multiple gig-economy sources",
      facts: [
        { label: "Total reported income", value: "$72,000 / yr" },
        { label: "Income sources", value: "4 gig platforms", flag: "variable_income" },
        { label: "Income consistency", value: "±30% monthly variance" },
        { label: "Credit score", value: "705" },
        { label: "Requested amount", value: "$40,000" },
      ],
      policy_note: "Variable income from 3+ sources requires 12-month bank statement review per policy LP-15.",
    },
    similarCases: [
      { ref: "#8150", summary: "3 gig sources, 12mo avg stable", resolved: "approved" },
      { ref: "#8090", summary: "5 gig sources, declining trend", resolved: "rejected" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $3,800 windshield replacement claim for policy #CLM-9100",
    confidence: 0.75,
    riskTier: "medium",
    context: {
      summary: "Auto glass claim — aftermarket parts requested at OEM price",
      facts: [
        { label: "Claim type", value: "Windshield replacement" },
        { label: "Quoted price", value: "$3,800" },
        { label: "OEM part price", value: "$3,800" },
        { label: "Aftermarket available", value: "$1,900", flag: "price_discrepancy" },
        { label: "Policy terms", value: "OEM parts not guaranteed" },
      ],
      policy_note: "Policy allows aftermarket equivalent parts unless OEM endorsement is active.",
    },
    similarCases: [
      { ref: "#CLM-9050", summary: "OEM endorsement active, OEM price paid", resolved: "approved" },
      { ref: "#CLM-8990", summary: "No OEM endorsement, aftermarket price approved", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $15,000 wire transfer for account #WR-5500",
    confidence: 0.72,
    riskTier: "medium",
    context: {
      summary: "Wire transfer — payee in OFAC advisory jurisdiction",
      facts: [
        { label: "Transfer amount", value: "$15,000" },
        { label: "Destination country", value: "Turkey" },
        { label: "OFAC status", value: "Advisory — not sanctioned", flag: "ofac_advisory" },
        { label: "Stated purpose", value: "Family support" },
        { label: "Prior wires to region", value: "2 in 12 months" },
      ],
      policy_note: "Wires to OFAC advisory jurisdictions require documented purpose verification per policy WT-08.",
    },
    similarCases: [
      { ref: "#WR-5400", summary: "$10k to Turkey, family support verified", resolved: "approved" },
      { ref: "#WR-5300", summary: "$20k to advisory country, no documentation", resolved: "rejected" },
    ],
  },

  // ── LOW RISK (25+ templates) ────────────────────────────────
  {
    agentIndex: 0,
    proposedAction: "Approve $8,000 personal loan for applicant #9900",
    confidence: 0.94,
    riskTier: "low",
    context: {
      summary: "Personal loan — strong credit, well within guidelines",
      facts: [
        { label: "Applicant income", value: "$92,000 / yr" },
        { label: "DTI ratio", value: "22%" },
        { label: "Credit score", value: "762" },
        { label: "Requested amount", value: "$8,000" },
        { label: "Employment tenure", value: "4 years" },
      ],
      policy_note: "All metrics within standard approval thresholds.",
    },
    similarCases: [
      { ref: "#9850", summary: "DTI 25%, $10k loan, strong profile", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $15,000 auto loan for applicant #9920",
    confidence: 0.91,
    riskTier: "low",
    context: {
      summary: "Auto loan — excellent credit, low LTV",
      facts: [
        { label: "Applicant income", value: "$74,000 / yr" },
        { label: "Vehicle value", value: "$22,000" },
        { label: "Requested loan", value: "$15,000" },
        { label: "LTV", value: "68%" },
        { label: "Credit score", value: "745" },
      ],
      policy_note: "Standard auto loan within all guidelines.",
    },
    similarCases: [
      { ref: "#9880", summary: "LTV 72%, 750 FICO", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $5,000 credit limit increase for applicant #10050",
    confidence: 0.93,
    riskTier: "low",
    context: {
      summary: "Credit limit increase — low utilization, long history",
      facts: [
        { label: "Current limit", value: "$10,000" },
        { label: "Requested limit", value: "$15,000" },
        { label: "Avg utilization", value: "18%" },
        { label: "Account age", value: "7 years" },
        { label: "Payment history", value: "Perfect — 84 months" },
      ],
      policy_note: "Qualifies for automatic increase under policy CL-02.",
    },
    similarCases: [
      { ref: "#10020", summary: "8yr account, 15% utilization, auto-approved", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $12,000 personal loan for applicant #10100",
    confidence: 0.89,
    riskTier: "low",
    context: {
      summary: "Personal loan — returning customer with clean history",
      facts: [
        { label: "Applicant income", value: "$68,000 / yr" },
        { label: "DTI ratio", value: "28%" },
        { label: "Prior loans with us", value: "2 — both repaid on time" },
        { label: "Credit score", value: "730" },
        { label: "Requested amount", value: "$12,000" },
      ],
      policy_note: "Returning customer with clean repayment history qualifies for streamlined approval.",
    },
    similarCases: [
      { ref: "#10080", summary: "Returning customer, $15k loan, clean history", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $6,500 personal loan for applicant #10200",
    confidence: 0.96,
    riskTier: "low",
    context: {
      summary: "Personal loan — small amount, excellent profile",
      facts: [
        { label: "Applicant income", value: "$105,000 / yr" },
        { label: "DTI ratio", value: "15%" },
        { label: "Credit score", value: "790" },
        { label: "Requested amount", value: "$6,500" },
        { label: "Loan purpose", value: "Home improvement" },
      ],
      policy_note: "All metrics well within standard approval thresholds.",
    },
    similarCases: [
      { ref: "#10180", summary: "$8k loan, 800 FICO, instant approval", resolved: "approved" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $2,100 fender-bender claim for policy #CLM-10300",
    confidence: 0.92,
    riskTier: "low",
    context: {
      summary: "Auto claim — minor damage, first claim, clean history",
      facts: [
        { label: "Claim type", value: "Parking lot scrape" },
        { label: "Repair estimate", value: "$2,100" },
        { label: "Claims history", value: "First claim in 5 years" },
        { label: "At-fault", value: "No — hit while parked" },
        { label: "Deductible", value: "$500" },
      ],
      policy_note: "Straightforward not-at-fault claim. No flags.",
    },
    similarCases: [
      { ref: "#CLM-10250", summary: "Parking lot damage, $1,800, first claim", resolved: "approved" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $950 windshield chip repair for policy #CLM-10400",
    confidence: 0.95,
    riskTier: "low",
    context: {
      summary: "Glass claim — small repair, no deductible state",
      facts: [
        { label: "Claim type", value: "Windshield chip repair" },
        { label: "Repair cost", value: "$950" },
        { label: "State", value: "Florida — zero deductible for glass" },
        { label: "Prior glass claims", value: "0" },
        { label: "Policy status", value: "Active, current" },
      ],
      policy_note: "Florida statute requires zero-deductible glass coverage. Auto-approve eligible.",
    },
    similarCases: [
      { ref: "#CLM-10350", summary: "FL glass repair, $800, auto-approved", resolved: "approved" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $4,600 hail damage claim for policy #CLM-10500",
    confidence: 0.88,
    riskTier: "low",
    context: {
      summary: "Auto claim — hail event confirmed by weather service",
      facts: [
        { label: "Claim type", value: "Hail damage — body dents" },
        { label: "Repair estimate", value: "$4,600" },
        { label: "Weather event verified", value: "NWS confirmed hail event" },
        { label: "Vehicles affected in area", value: "47 claims filed" },
        { label: "Deductible", value: "$1,000" },
      ],
      policy_note: "Catastrophe event verified. Batch processing approved per policy CAT-01.",
    },
    similarCases: [
      { ref: "#CLM-10480", summary: "Same hail event, $3,900 repair", resolved: "approved" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $1,200 theft claim for policy #CLM-10600",
    confidence: 0.90,
    riskTier: "low",
    context: {
      summary: "Renters insurance — stolen bicycle with police report",
      facts: [
        { label: "Claim type", value: "Theft — bicycle" },
        { label: "Claimed value", value: "$1,200" },
        { label: "Police report", value: "Filed — case #PD-44102" },
        { label: "Purchase receipt", value: "Provided — matches value" },
        { label: "Deductible", value: "$250" },
      ],
      policy_note: "Documented theft with police report and receipt. Standard processing.",
    },
    similarCases: [
      { ref: "#CLM-10550", summary: "Stolen bike, $900, police report filed", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $5,000 wire transfer for account #WR-10700",
    confidence: 0.94,
    riskTier: "low",
    context: {
      summary: "Wire transfer — recurring payment to established payee",
      facts: [
        { label: "Transfer amount", value: "$5,000" },
        { label: "Payee", value: "Monthly rent — landlord (18 months)" },
        { label: "Destination", value: "Domestic — same bank" },
        { label: "Frequency", value: "Monthly — consistent amount" },
        { label: "Account standing", value: "Good" },
      ],
      policy_note: "Recurring domestic wire to established payee. No flags.",
    },
    similarCases: [
      { ref: "#WR-10650", summary: "$5k monthly rent wire, 12-month history", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $8,200 wire transfer for account #WR-10800",
    confidence: 0.91,
    riskTier: "low",
    context: {
      summary: "Wire transfer — tuition payment to known university",
      facts: [
        { label: "Transfer amount", value: "$8,200" },
        { label: "Payee", value: "State University — Bursar" },
        { label: "Destination", value: "Domestic — verified institution" },
        { label: "Stated purpose", value: "Spring semester tuition" },
        { label: "Prior tuition wires", value: "3 in 18 months" },
      ],
      policy_note: "Payment to verified educational institution. Standard processing.",
    },
    similarCases: [
      { ref: "#WR-10750", summary: "$9k tuition wire, same university", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $3,500 wire transfer for account #WR-10900",
    confidence: 0.93,
    riskTier: "low",
    context: {
      summary: "Wire transfer — small domestic transfer, established account",
      facts: [
        { label: "Transfer amount", value: "$3,500" },
        { label: "Payee", value: "Known vendor (3 years)" },
        { label: "Destination", value: "Domestic — California" },
        { label: "Account age", value: "8 years" },
        { label: "Transaction consistent with history", value: "Yes" },
      ],
      policy_note: "Routine domestic wire within normal parameters.",
    },
    similarCases: [
      { ref: "#WR-10850", summary: "$4k to same vendor, routine", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $20,000 auto loan for applicant #10300",
    confidence: 0.90,
    riskTier: "low",
    context: {
      summary: "Auto loan — new vehicle, strong down payment",
      facts: [
        { label: "Applicant income", value: "$85,000 / yr" },
        { label: "Vehicle price", value: "$32,000" },
        { label: "Down payment", value: "$12,000 (37.5%)" },
        { label: "Requested loan", value: "$20,000" },
        { label: "Credit score", value: "755" },
      ],
      policy_note: "Strong down payment and credit profile. Standard approval.",
    },
    similarCases: [
      { ref: "#10280", summary: "$18k auto loan, 35% down, 740 FICO", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $10,000 personal loan for applicant #10400",
    confidence: 0.92,
    riskTier: "low",
    context: {
      summary: "Personal loan — medical expense, excellent credit",
      facts: [
        { label: "Applicant income", value: "$70,000 / yr" },
        { label: "DTI ratio", value: "20%" },
        { label: "Credit score", value: "748" },
        { label: "Requested amount", value: "$10,000" },
        { label: "Loan purpose", value: "Medical procedure" },
      ],
      policy_note: "Well-qualified applicant. Standard approval path.",
    },
    similarCases: [
      { ref: "#10380", summary: "$12k medical loan, 740 FICO", resolved: "approved" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $3,200 water damage claim for policy #CLM-11000",
    confidence: 0.89,
    riskTier: "low",
    context: {
      summary: "Homeowner claim — minor pipe leak, quick response",
      facts: [
        { label: "Claim type", value: "Slow pipe leak — kitchen" },
        { label: "Repair estimate", value: "$3,200" },
        { label: "Time to report", value: "Same day" },
        { label: "Mitigation taken", value: "Shut off water, called plumber" },
        { label: "Prior claims", value: "0 in 10 years" },
      ],
      policy_note: "Prompt reporting and mitigation. No coverage concerns.",
    },
    similarCases: [
      { ref: "#CLM-10950", summary: "Pipe leak, $2,800, same-day report", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $12,000 wire transfer for account #WR-11100",
    confidence: 0.88,
    riskTier: "low",
    context: {
      summary: "Wire transfer — down payment to real estate escrow",
      facts: [
        { label: "Transfer amount", value: "$12,000" },
        { label: "Payee", value: "First American Title — Escrow" },
        { label: "Destination", value: "Domestic — verified escrow account" },
        { label: "Stated purpose", value: "Earnest money deposit" },
        { label: "Supporting docs", value: "Purchase agreement provided" },
      ],
      policy_note: "Verified escrow company. Standard real estate transaction.",
    },
    similarCases: [
      { ref: "#WR-11050", summary: "$15k escrow deposit, verified title company", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $7,500 personal loan for applicant #10500",
    confidence: 0.95,
    riskTier: "low",
    context: {
      summary: "Personal loan — small amount, long-term customer",
      facts: [
        { label: "Applicant income", value: "$88,000 / yr" },
        { label: "DTI ratio", value: "19%" },
        { label: "Credit score", value: "770" },
        { label: "Customer since", value: "2016" },
        { label: "Requested amount", value: "$7,500" },
      ],
      policy_note: "Preferred customer with clean 8-year history. Fast-track eligible.",
    },
    similarCases: [
      { ref: "#10480", summary: "Long-term customer, $9k loan, instant approval", resolved: "approved" },
    ],
  },
  {
    agentIndex: 1,
    proposedAction: "Approve $5,500 liability claim for policy #CLM-11200",
    confidence: 0.87,
    riskTier: "low",
    context: {
      summary: "Liability claim — guest injury, clear coverage",
      facts: [
        { label: "Claim type", value: "Guest slip-and-fall — medical bills" },
        { label: "Medical costs", value: "$5,500" },
        { label: "Liability limit", value: "$100,000" },
        { label: "Incident report", value: "Filed with photos" },
        { label: "Policy coverage", value: "Personal liability — confirmed" },
      ],
      policy_note: "Clear liability coverage. Medical payments within sub-limit.",
    },
    similarCases: [
      { ref: "#CLM-11150", summary: "Guest injury, $4k medical, straightforward", resolved: "approved" },
    ],
  },
  {
    agentIndex: 0,
    proposedAction: "Approve $25,000 home improvement loan for applicant #10600",
    confidence: 0.87,
    riskTier: "low",
    context: {
      summary: "Home improvement loan — strong equity position",
      facts: [
        { label: "Home value", value: "$450,000" },
        { label: "Outstanding mortgage", value: "$220,000" },
        { label: "Equity", value: "$230,000 (51%)" },
        { label: "Requested amount", value: "$25,000" },
        { label: "Credit score", value: "738" },
      ],
      policy_note: "Strong equity position. Standard home improvement loan approval.",
    },
    similarCases: [
      { ref: "#10580", summary: "$30k home improvement, 55% equity", resolved: "approved" },
    ],
  },
  {
    agentIndex: 2,
    proposedAction: "Execute $6,800 wire transfer for account #WR-11300",
    confidence: 0.92,
    riskTier: "low",
    context: {
      summary: "Wire transfer — contractor payment, recurring",
      facts: [
        { label: "Transfer amount", value: "$6,800" },
        { label: "Payee", value: "Contractor — 14 prior payments" },
        { label: "Destination", value: "Domestic — Texas" },
        { label: "Average payment", value: "$6,500" },
        { label: "Variance", value: "+4.6%" },
      ],
      policy_note: "Recurring contractor payment within normal variance. Auto-approve eligible.",
    },
    similarCases: [
      { ref: "#WR-11250", summary: "$7k contractor wire, 15th payment", resolved: "approved" },
    ],
  },
];

// ─── Reusable seed function (used by CLI and reset endpoint) ─
export async function runSeed() {
  // Disable triggers temporarily for cleanup
  await db.execute(sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_delete`);
  await db.execute(sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update`);
  await db.execute(sql`DELETE FROM audit_log`);
  await db.execute(sql`DELETE FROM reviews`);
  await db.execute(sql`DELETE FROM decisions`);
  await db.execute(sql`DELETE FROM agents`);
  await db.execute(sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_delete`);
  await db.execute(sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update`);

  const insertedAgents = await db
    .insert(agents)
    .values(AGENTS.map((a) => ({ ...a })))
    .returning();

  let count = 0;
  for (const template of DECISION_TEMPLATES) {
    const agent = insertedAgents[template.agentIndex];

    // Slight time jitter so decisions aren't all at the same timestamp
    const jitterMs = Math.floor(Math.random() * 3600000); // up to 1 hour
    const createdAt = new Date(Date.now() - jitterMs);

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
        createdAt,
      })
      .returning();

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
      createdAt,
    });

    count++;
  }

  return count;
}

// ─── CLI runner ──────────────────────────────────────────────
// Only run when executed directly (not imported)
const isDirectRun = process.argv[1]?.includes("seed");
if (isDirectRun) {
  runSeed()
    .then((count) => {
      console.log(`✅ Seeded ${count} decisions`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
