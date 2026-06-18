// backend/src/controllers/policyAnalysisController.js

const { query } = require("../db");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── helpers ──────────────────────────────────────────────────────
const TTL_HOURS = 24;

function expiresAt() {
  const d = new Date();
  d.setHours(d.getHours() + TTL_HOURS);
  return d;
}

/** Delete all expired rows for any user (call before reads) */
async function purgeExpired() {
  await query(`DELETE FROM policy_analyses WHERE expires_at < NOW()`);
}

// ── extract via Gemini ────────────────────────────────────────────
async function extractFromPDF(base64Data) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `You are an expert insurance policy analyst. Analyse the attached insurance policy PDF carefully.

Auto-detect the policy type (Health, Motor - Car, Motor - Bike, Home, Life, Travel, Commercial, or Other).

Return ONLY a valid JSON object with this exact structure. Use null for fields not found in the document.
Numbers must be plain integers or decimals (no currency symbols, no commas).

{
  "policyType": "Health | Motor - Car | Motor - Bike | Home | Life | Travel | Commercial | Other",
  "policyHolder": "string or null",
  "policyNumber": "string or null",
  "planName": "string or null",
  "insurer": "Insurance company name or null",
  "policyPeriod": "e.g. 01-Jan-2025 to 31-Dec-2025 or null",
  "preExistingConditions": "description or null",

  "insuredItems": [
    {
      "name": "string",
      "type": "Person | Vehicle | Property | Asset",
      "relation": "Self | Spouse | Son | Daughter | Father | Mother | Vehicle | Property or null",
      "age": 0,
      "idNumber": "vehicle reg / property ID / Aadhaar last4 or null",
      "baseCoverage": 0,
      "bonus": 0,
      "totalCoverage": 0
    }
  ],

  "nominee": { "name": "string or null", "relation": "string or null", "share": "string or null" },

  "premium": { "base": 0, "addons": 0, "discounts": 0, "final": 0 },

  "taxBenefit": 0,
  "totalEffectiveCoverage": 0,
  "bonusAccumulated": 0,
  "bonusType": "e.g. No Claim Bonus / Supreme Bonus or null",

  "coverageProjection": [{ "year": "string", "amount": 0 }],

  "keyBenefits": [{ "text": "string", "covered": true }],

  "waitingPeriods": [{ "label": "string", "duration": "string" }],

  "addons": ["string"],

  "policySpecificDetails": {
    "vehicleDetails": {
      "make": "string or null",
      "model": "string or null",
      "year": 0,
      "registrationNumber": "string or null",
      "engineNumber": "string or null",
      "chassisNumber": "string or null",
      "fuelType": "Petrol | Diesel | Electric | CNG or null",
      "idv": 0,
      "cubicCapacity": "string or null"
    },
    "propertyDetails": {
      "address": "string or null",
      "propertyType": "Apartment | Villa | Independent House | Commercial or null",
      "builtUpArea": "string or null",
      "constructionType": "string or null",
      "sumInsuredBuilding": 0,
      "sumInsuredContents": 0
    },
    "lifeDetails": {
      "sumAssured": 0,
      "maturityAge": 0,
      "policyTerm": "string or null",
      "paymentTerm": "string or null",
      "surrenderValue": 0,
      "deathBenefit": 0,
      "maturityBenefit": 0
    },
    "travelDetails": {
      "destination": "string or null",
      "tripType": "Single Trip | Multi Trip or null",
      "emergencyLimit": 0,
      "medicalLimit": 0,
      "tripDuration": "string or null"
    }
  },

  "zone": "string or null",
  "zoneRule": "string or null",
  "premiumWaiver": "string or null",
  "claimProcess": "Brief claim procedure or null",
  "networkHospitals": "number or description or null",
  "ncbDiscount": "e.g. 20% after 1 claim-free year or null",
  "thirdPartyLiability": 0,
  "ownDamageLimit": 0
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: base64Data,
      },
    },
    { text: prompt },
  ]);

  const text = result.response.text();
  // Strip any accidental markdown fences
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

// ── POST /api/policy-analysis/upload ─────────────────────────────
async function uploadAndAnalyse(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No PDF file uploaded." });
    }

    const userId   = req.user.id;
    const fileName = req.file.originalname;

    // Convert buffer → base64
    const base64Data = req.file.buffer.toString("base64");

    // Call Gemini
    let extracted;
    try {
      extracted = await extractFromPDF(base64Data);
    } catch (err) {
      console.error("Gemini extraction error:", err);
      return res.status(422).json({
        success: false,
        message: "Could not extract policy data from the PDF. Please ensure it is a valid insurance policy document.",
      });
    }

    // Purge expired rows, then delete any prior analysis for this user
    await purgeExpired();
    await query(`DELETE FROM policy_analyses WHERE user_id = $1`, [userId]);

    // Build legacy insured_members from insuredItems (for backward compat)
    const legacyMembers = (extracted.insuredItems ?? []).map((item) => ({
      name:           item.name,
      relation:       item.relation,
      age:            item.age,
      baseSumInsured: item.baseCoverage,
      bonus:          item.bonus,
      totalCoverage:  item.totalCoverage,
    }));

    const result = await query(
      `INSERT INTO policy_analyses (
        user_id, file_name,
        policy_holder, policy_number, plan_name, policy_type, policy_period,
        zone, pre_existing_diseases,
        insured_members, nominee, premium,
        tax_benefit, total_effective_coverage, bonus_accumulated, bonus_type,
        coverage_projection, key_benefits, waiting_periods,
        zone_rule, addons, premium_waiver,
        insurer, insured_items, policy_specific_details,
        pre_existing_conditions, claim_process, network_hospitals,
        ncb_discount, third_party_liability, own_damage_limit,
        expires_at
      ) VALUES (
        $1,$2,
        $3,$4,$5,$6,$7,
        $8,$9,
        $10,$11,$12,
        $13,$14,$15,$16,
        $17,$18,$19,
        $20,$21,$22,
        $23,$24,$25,
        $26,$27,$28,
        $29,$30,$31,
        $32
      ) RETURNING *`,
      [
        userId, fileName,
        extracted.policyHolder            ?? null,
        extracted.policyNumber            ?? null,
        extracted.planName                ?? null,
        extracted.policyType              ?? null,
        extracted.policyPeriod            ?? null,
        extracted.zone                    ?? null,
        extracted.preExistingConditions   ?? null,
        JSON.stringify(legacyMembers),
        JSON.stringify(extracted.nominee              ?? {}),
        JSON.stringify(extracted.premium              ?? {}),
        extracted.taxBenefit               ?? 0,
        extracted.totalEffectiveCoverage   ?? 0,
        extracted.bonusAccumulated         ?? 0,
        extracted.bonusType                ?? null,
        JSON.stringify(extracted.coverageProjection   ?? []),
        JSON.stringify(extracted.keyBenefits          ?? []),
        JSON.stringify(extracted.waitingPeriods        ?? []),
        extracted.zoneRule                 ?? null,
        JSON.stringify(extracted.addons               ?? []),
        extracted.premiumWaiver            ?? null,
        extracted.insurer                  ?? null,
        JSON.stringify(extracted.insuredItems         ?? []),
        JSON.stringify(extracted.policySpecificDetails ?? {}),
        extracted.preExistingConditions    ?? null,
        extracted.claimProcess             ?? null,
        extracted.networkHospitals         ?? null,
        extracted.ncbDiscount              ?? null,
        extracted.thirdPartyLiability      ?? 0,
        extracted.ownDamageLimit           ?? 0,
        expiresAt(),
      ]
    );

    const inserted = result.rows[0];

    return res.status(201).json({
      success: true,
      message: "Policy analysed successfully.",
      data: { analysis: formatRow(inserted) },
    });
  } catch (err) {
    console.error("uploadAndAnalyse error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

// ── GET /api/policy-analysis ──────────────────────────────────────
async function getAnalysis(req, res) {
  try {
    await purgeExpired();

    const result = await query(
      `SELECT * FROM policy_analyses
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(200).json({ success: true, data: { analysis: null } });
    }

    return res.status(200).json({
      success: true,
      data: { analysis: formatRow(result.rows[0]) },
    });
  } catch (err) {
    console.error("getAnalysis error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

// ── DELETE /api/policy-analysis ───────────────────────────────────
async function deleteAnalysis(req, res) {
  try {
    await query(`DELETE FROM policy_analyses WHERE user_id = $1`, [req.user.id]);
    return res.status(200).json({ success: true, message: "Analysis deleted." });
  } catch (err) {
    console.error("deleteAnalysis error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

// ── Format DB row → camelCase for frontend ────────────────────────
function formatRow(row) {
  const parse = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  };

  // Prefer the new insured_items; fall back to legacy insured_members
  const insuredItems   = parse(row.insured_items)   || [];
  const insuredMembers = parse(row.insured_members)  || [];

  return {
    id:                     row.id,
    fileName:               row.file_name,
    policyHolder:           row.policy_holder,
    policyNumber:           row.policy_number,
    planName:               row.plan_name,
    policyType:             row.policy_type,
    policyPeriod:           row.policy_period,
    zone:                   row.zone,
    preExistingConditions:  row.pre_existing_conditions ?? row.pre_existing_diseases,
    insurer:                row.insurer,
    insuredItems:           insuredItems.length ? insuredItems : insuredMembers,
    insuredMembers:         insuredMembers,
    policySpecificDetails:  parse(row.policy_specific_details) ?? {},
    claimProcess:           row.claim_process,
    networkHospitals:       row.network_hospitals,
    ncbDiscount:            row.ncb_discount,
    thirdPartyLiability:    Number(row.third_party_liability ?? 0),
    ownDamageLimit:         Number(row.own_damage_limit       ?? 0),
    nominee:                parse(row.nominee),
    premium:                parse(row.premium),
    taxBenefit:             Number(row.tax_benefit),
    totalEffectiveCoverage: Number(row.total_effective_coverage),
    bonusAccumulated:       Number(row.bonus_accumulated),
    bonusType:              row.bonus_type,
    coverageProjection:     parse(row.coverage_projection) ?? [],
    keyBenefits:            parse(row.key_benefits)        ?? [],
    waitingPeriods:         parse(row.waiting_periods)     ?? [],
    zoneRule:               row.zone_rule,
    addons:                 parse(row.addons)              ?? [],
    premiumWaiver:          row.premium_waiver,
    expiresAt:              row.expires_at,
    createdAt:              row.created_at,
  };
}

module.exports = { uploadAndAnalyse, getAnalysis, deleteAnalysis };
