const { query } = require('../db');
const logger    = require('../utils/logger');

// GET /api/policies
const getPolicies = async (req, res) => {
  const { category } = req.query;
  try {
    let sql = `
      SELECT pm.id, pm.user_id, pm.policy_name, pm.insurer_name, pm.policy_number,
             pm.category, pm.active, pm.sort_order, pm.created_at, pm.updated_at,
             pd.sum_insured, pd.premium_amount, pd.premium_frequency,
             pd.start_date, pd.expiry_date, pd.renewal_date, pd.next_premium_due,
             pd.vehicle_reg_number, pd.vehicle_make_model, pd.property_address,
             pd.nominee_name, pd.agent_name, pd.agent_phone, pd.insurer_helpline, pd.notes,
             compute_policy_status(pd.expiry_date) AS computed_status,
             (pd.expiry_date - CURRENT_DATE)       AS days_to_expiry
      FROM policy_master pm
      JOIN policy_details pd ON pd.policy_id = pm.id
      WHERE pm.user_id = $1 AND pm.active = TRUE`;
    const params = [req.user.id];
    if (category && category !== 'all') { params.push(category); sql += ` AND pm.category=$${params.length}`; }
    sql += ` ORDER BY pd.expiry_date ASC, pm.created_at DESC`;

    const result = await query(sql, params);
    const policies = result.rows;
    const expiringSoon = policies.filter(p => p.computed_status === 'expiring_soon');

    return res.json({
      success: true,
      data: {
        policies,
        counts: {
          total: policies.length,
          active: policies.filter(p => p.computed_status === 'active').length,
          expiringSoon: expiringSoon.length,
          expired: policies.filter(p => p.computed_status === 'expired').length,
        },
        notifications: expiringSoon.map(p => ({
          id: p.id, policyName: p.policy_name, insurer: p.insurer_name,
          category: p.category, daysToExpiry: p.days_to_expiry, expiryDate: p.expiry_date,
        })),
      },
    });
  } catch(e) {
    logger.error('[getPolicies]', e.message);
    return res.status(500).json({ success:false, message:'Failed to fetch policies.' });
  }
};

// POST /api/policies
const addPolicy = async (req, res) => {
  const { policyName, insurerName, policyNumber, category, sumInsured, premiumAmount,
          premiumFrequency, startDate, expiryDate, renewalDate, nextPremiumDue,
          vehicleRegNumber, vehicleMakeModel, propertyAddress, nomineeName,
          agentName, agentPhone, insurerHelpline, notes } = req.body;

  if (!policyName || !insurerName || !category || !premiumAmount || !expiryDate)
    return res.status(400).json({ success:false, message:'Policy name, insurer, category, premium and expiry date required.' });

  try {
    // Insert master
    const m = await query(
      `INSERT INTO policy_master (user_id, policy_name, insurer_name, policy_number, category,
       status)
       VALUES ($1,$2,$3,$4,$5, compute_policy_status($6::date)) RETURNING id`,
      [req.user.id, policyName.trim(), insurerName.trim(), policyNumber?.trim()||null,
       category, expiryDate]
    );
    const pid = m.rows[0].id;

    // Insert details
    await query(
      `INSERT INTO policy_details (policy_id, sum_insured, premium_amount, premium_frequency,
       start_date, expiry_date, renewal_date, next_premium_due, vehicle_reg_number,
       vehicle_make_model, property_address, nominee_name, agent_name, agent_phone,
       insurer_helpline, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [pid, sumInsured?parseFloat(sumInsured):null, parseFloat(premiumAmount),
       premiumFrequency||'annual', startDate||null, expiryDate,
       renewalDate||null, nextPremiumDue||null, vehicleRegNumber?.trim()||null,
       vehicleMakeModel?.trim()||null, propertyAddress?.trim()||null,
       nomineeName?.trim()||null, agentName?.trim()||null, agentPhone?.trim()||null,
       insurerHelpline?.trim()||null, notes?.trim()||null]
    );

    const row = await query(
      `SELECT pm.id, pm.policy_name, pm.insurer_name, pm.policy_number, pm.category,
              pd.sum_insured, pd.premium_amount, pd.premium_frequency,
              pd.start_date, pd.expiry_date, pd.renewal_date, pd.next_premium_due,
              pd.nominee_name, pd.agent_name, pd.agent_phone, pd.insurer_helpline, pd.notes,
              compute_policy_status(pd.expiry_date) AS computed_status,
              (pd.expiry_date - CURRENT_DATE) AS days_to_expiry, pm.created_at
       FROM policy_master pm JOIN policy_details pd ON pd.policy_id=pm.id WHERE pm.id=$1`, [pid]
    );
    logger.info(`[addPolicy] ${req.user.id}: ${policyName}`);
    return res.status(201).json({ success:true, message:'Policy added.', data:{ policy:row.rows[0] } });
  } catch(e) {
    logger.error('[addPolicy]', e.message);
    return res.status(500).json({ success:false, message:'Failed to add policy.' });
  }
};

// PUT /api/policies/:id
const updatePolicy = async (req, res) => {
  const { id } = req.params;
  const { policyName, insurerName, policyNumber, category, sumInsured, premiumAmount,
          premiumFrequency, startDate, expiryDate, renewalDate, nextPremiumDue,
          vehicleRegNumber, vehicleMakeModel, propertyAddress, nomineeName,
          agentName, agentPhone, insurerHelpline, notes } = req.body;
  try {
    const own = await query(
      `SELECT id FROM policy_master WHERE id=$1 AND user_id=$2 AND active=TRUE`, [id,req.user.id]
    );
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Policy not found.' });

    await query(
      `UPDATE policy_master SET policy_name=COALESCE($1,policy_name),
       insurer_name=COALESCE($2,insurer_name), policy_number=COALESCE($3,policy_number),
       category=COALESCE($4,category),
       status=compute_policy_status(COALESCE($5::date, (SELECT expiry_date FROM policy_details WHERE policy_id=$6)))
       WHERE id=$6`,
      [policyName?.trim()||null, insurerName?.trim()||null, policyNumber?.trim()||null,
       category||null, expiryDate||null, id]
    );
    await query(
      `UPDATE policy_details SET sum_insured=COALESCE($1,sum_insured),
       premium_amount=COALESCE($2,premium_amount), premium_frequency=COALESCE($3,premium_frequency),
       start_date=COALESCE($4,start_date), expiry_date=COALESCE($5,expiry_date),
       renewal_date=COALESCE($6,renewal_date), next_premium_due=COALESCE($7,next_premium_due),
       vehicle_reg_number=COALESCE($8,vehicle_reg_number), vehicle_make_model=COALESCE($9,vehicle_make_model),
       property_address=COALESCE($10,property_address), nominee_name=COALESCE($11,nominee_name),
       agent_name=COALESCE($12,agent_name), agent_phone=COALESCE($13,agent_phone),
       insurer_helpline=COALESCE($14,insurer_helpline), notes=COALESCE($15,notes)
       WHERE policy_id=$16`,
      [sumInsured!==undefined?parseFloat(sumInsured):null,
       premiumAmount!==undefined?parseFloat(premiumAmount):null,
       premiumFrequency||null, startDate||null, expiryDate||null,
       renewalDate||null, nextPremiumDue||null, vehicleRegNumber?.trim()||null,
       vehicleMakeModel?.trim()||null, propertyAddress?.trim()||null,
       nomineeName?.trim()||null, agentName?.trim()||null, agentPhone?.trim()||null,
       insurerHelpline?.trim()||null, notes?.trim()||null, id]
    );
    const row = await query(
      `SELECT pm.id, pm.policy_name, pm.insurer_name, pm.category,
              pd.premium_amount, pd.expiry_date, pd.nominee_name, pd.notes,
              compute_policy_status(pd.expiry_date) AS computed_status,
              (pd.expiry_date - CURRENT_DATE) AS days_to_expiry, pm.updated_at
       FROM policy_master pm JOIN policy_details pd ON pd.policy_id=pm.id WHERE pm.id=$1`, [id]
    );
    return res.json({ success:true, message:'Policy updated.', data:{ policy:row.rows[0] } });
  } catch(e) {
    logger.error('[updatePolicy]', e.message);
    return res.status(500).json({ success:false, message:'Failed.' });
  }
};

// DELETE /api/policies/:id
const deletePolicy = async (req, res) => {
  try {
    const r = await query(
      `UPDATE policy_master SET active=FALSE WHERE id=$1 AND user_id=$2 AND active=TRUE RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    return res.json({ success:true, message:'Policy removed.' });
  } catch(e) { return res.status(500).json({ success:false, message:'Failed.' }); }
};

// GET /api/policies/notifications
const getNotifications = async (req, res) => {
  try {
    const r = await query(
      `SELECT pm.id, pm.policy_name, pm.insurer_name, pm.category,
              pd.expiry_date, (pd.expiry_date - CURRENT_DATE) AS days_to_expiry,
              compute_policy_status(pd.expiry_date) AS computed_status
       FROM policy_master pm
       JOIN policy_details pd ON pd.policy_id = pm.id
       WHERE pm.user_id=$1 AND pm.active=TRUE
         AND pd.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
       ORDER BY pd.expiry_date ASC`,
      [req.user.id]
    );
    return res.json({ success:true, data:{ notifications:r.rows, count:r.rows.length } });
  } catch(e) { return res.status(500).json({ success:false, message:'Failed.' }); }
};

module.exports = { getPolicies, addPolicy, updatePolicy, deletePolicy, getNotifications };
