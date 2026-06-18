const { query } = require('../db');
const logger    = require('../utils/logger');

// ── PROFILE ───────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const r = await query(
      `SELECT u.id, u.created_at AS registered_at,
              ua.email, ua.phone, ua.status, ua.email_verified, ua.phone_verified,
              ua.preferred_otp_channel, ua.last_login_at,
              up.full_name, up.username, up.avatar_url, up.date_of_birth, up.gender,
              up.occupation, up.aadhaar_last4, up.aadhaar_verified, up.pan_number,
              up.address_line1, up.address_line2, up.city, up.state, up.pincode, up.country,
              up.plan_type, up.plan_expires_at
       FROM users u
       JOIN user_auth    ua ON ua.user_id = u.id
       JOIN user_profile up ON up.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ success:false, message:'User not found.' });
    return res.json({ success:true, data:{ user:r.rows[0] } });
  } catch(e){ logger.error('[getProfile]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const updateProfile = async (req, res) => {
  const { fullName, username, avatarUrl, preferredOtpChannel, aadhaarLast4, panNumber,
          dateOfBirth, gender, occupation, addressLine1, addressLine2, city, state, pincode, country } = req.body;
  if (aadhaarLast4 && !/^\d{4}$/.test(aadhaarLast4))
    return res.status(400).json({ success:false, message:'Aadhaar last 4 must be exactly 4 digits.' });
  if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase()))
    return res.status(400).json({ success:false, message:'Invalid PAN format (e.g. ABCDE1234F).' });
  try {
    if (preferredOtpChannel)
      await query(`UPDATE user_auth SET preferred_otp_channel=$1 WHERE user_id=$2`, [preferredOtpChannel, req.user.id]);
    const r = await query(
      `UPDATE user_profile SET
         full_name=$1, username=COALESCE($2,username), avatar_url=COALESCE($3,avatar_url),
         date_of_birth=COALESCE($4,date_of_birth), gender=COALESCE($5,gender),
         occupation=COALESCE($6,occupation), aadhaar_last4=COALESCE($7,aadhaar_last4),
         pan_number=COALESCE($8,pan_number), address_line1=COALESCE($9,address_line1),
         address_line2=COALESCE($10,address_line2), city=COALESCE($11,city),
         state=COALESCE($12,state), pincode=COALESCE($13,pincode), country=COALESCE($14,country)
       WHERE user_id=$15
       RETURNING full_name, username, aadhaar_last4, pan_number, date_of_birth,
                 occupation, address_line1, address_line2, city, state, pincode`,
      [fullName?.trim()||req.user.full_name, username?.trim()||null, avatarUrl||null,
       dateOfBirth||null, gender||null, occupation?.trim()||null,
       aadhaarLast4||null, panNumber?.toUpperCase().trim()||null,
       addressLine1?.trim()||null, addressLine2?.trim()||null, city?.trim()||null,
       state?.trim()||null, pincode?.trim()||null, country?.trim()||null, req.user.id]
    );
    return res.json({ success:true, message:'Profile updated.', data:{ user:r.rows[0] } });
  } catch(e){ logger.error('[updateProfile]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── BANK ACCOUNTS ─────────────────────────────────────────────────
const getBankAccounts = async (req, res) => {
  try {
    const r = await query(
      `SELECT bm.id, bm.user_id, bm.bank_name, bm.account_type, bm.account_number_last4, bm.currency,
              bm.sort_order, bm.created_at, bm.updated_at,
              bd.account_holder, bd.branch, bd.ifsc_code, bd.micr_code,
              bd.balance, bd.interest_rate, bd.maturity_date, bd.nominee_name, bd.notes
       FROM bank_account_master bm
       JOIN bank_account_details bd ON bd.account_id = bm.id
       WHERE bm.user_id=$1 AND bm.active=TRUE
       ORDER BY bm.sort_order ASC, bm.created_at DESC`,
      [req.user.id]
    );
    const total = r.rows.reduce((s,a)=>s+parseFloat(a.balance||0),0);
    return res.json({ success:true, data:{ accounts:r.rows, total:parseFloat(total.toFixed(2)), count:r.rows.length } });
  } catch(e){ logger.error('[getBankAccounts]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const addBankAccount = async (req, res) => {
  const { bankName, accountType, accountNumberLast4, accountHolder, branch, ifscCode,
          micrCode, balance, interestRate, maturityDate, currency, nomineeName, notes } = req.body;
  if (!bankName || balance===undefined)
    return res.status(400).json({ success:false, message:'Bank name and balance are required.' });
  try {
    const m = await query(
      `INSERT INTO bank_account_master (user_id,bank_name,account_type,account_number_last4,currency)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, bankName.trim(), accountType||'savings',
       accountNumberLast4?String(accountNumberLast4).slice(-4):null, currency||'INR']
    );
    const aid = m.rows[0].id;
    await query(
      `INSERT INTO bank_account_details
         (account_id,account_holder,branch,ifsc_code,micr_code,balance,interest_rate,maturity_date,nominee_name,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [aid, accountHolder?.trim()||null, branch?.trim()||null,
       ifscCode?.toUpperCase().trim()||null, micrCode?.trim()||null,
       parseFloat(balance), interestRate?parseFloat(interestRate):null,
       maturityDate||null, nomineeName?.trim()||null, notes?.trim()||null]
    );
    const row = await query(
      `SELECT bm.id,bm.bank_name,bm.account_type,bm.account_number_last4,bm.currency,
              bd.account_holder,bd.branch,bd.ifsc_code,bd.balance,bd.interest_rate,
              bd.maturity_date,bd.notes,bm.created_at
       FROM bank_account_master bm JOIN bank_account_details bd ON bd.account_id=bm.id WHERE bm.id=$1`,[aid]);
    logger.info(`[addBankAccount] ${req.user.id}: ${bankName}`);
    return res.status(201).json({ success:true, message:'Account added.', data:{ account:row.rows[0] } });
  } catch(e){ logger.error('[addBankAccount]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const updateBankAccount = async (req, res) => {
  const { id } = req.params;
  const { bankName, accountType, accountNumberLast4, accountHolder, branch, ifscCode,
          micrCode, balance, interestRate, maturityDate, nomineeName, notes } = req.body;
  try {
    const own = await query(`SELECT id FROM bank_account_master WHERE id=$1 AND user_id=$2 AND active=TRUE`,[id,req.user.id]);
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    await query(
      `UPDATE bank_account_master SET bank_name=COALESCE($1,bank_name), account_type=COALESCE($2,account_type),
       account_number_last4=COALESCE($3,account_number_last4) WHERE id=$4`,
      [bankName?.trim()||null, accountType||null, accountNumberLast4?String(accountNumberLast4).slice(-4):null, id]
    );
    await query(
      `UPDATE bank_account_details SET account_holder=COALESCE($1,account_holder), branch=COALESCE($2,branch),
       ifsc_code=COALESCE($3,ifsc_code), micr_code=COALESCE($4,micr_code), balance=COALESCE($5,balance),
       interest_rate=COALESCE($6,interest_rate), maturity_date=COALESCE($7,maturity_date),
       nominee_name=COALESCE($8,nominee_name), notes=COALESCE($9,notes) WHERE account_id=$10`,
      [accountHolder?.trim()||null, branch?.trim()||null,
       ifscCode?.toUpperCase().trim()||null, micrCode?.trim()||null,
       balance!==undefined?parseFloat(balance):null, interestRate!==undefined?parseFloat(interestRate):null,
       maturityDate||null, nomineeName?.trim()||null, notes?.trim()||null, id]
    );
    const row = await query(
      `SELECT bm.id,bm.bank_name,bm.account_type,bm.account_number_last4,
              bd.account_holder,bd.branch,bd.ifsc_code,bd.balance,bd.interest_rate,
              bd.maturity_date,bd.notes,bm.updated_at
       FROM bank_account_master bm JOIN bank_account_details bd ON bd.account_id=bm.id WHERE bm.id=$1`,[id]);
    return res.json({ success:true, message:'Updated.', data:{ account:row.rows[0] } });
  } catch(e){ logger.error('[updateBankAccount]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const deleteBankAccount = async (req, res) => {
  try {
    const r = await query(`UPDATE bank_account_master SET active=FALSE WHERE id=$1 AND user_id=$2 AND active=TRUE RETURNING id`,[req.params.id,req.user.id]);
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    return res.json({ success:true, message:'Removed.' });
  } catch(e){ return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── INVESTMENTS ───────────────────────────────────────────────────
const getInvestments = async (req, res) => {
  try {
    const r = await query(
      `SELECT im.id,im.user_id,im.platform_name,im.investment_type,im.account_id_masked,
              im.currency,im.sort_order,im.created_at,im.updated_at,
              id2.instrument_name,id2.current_value,id2.invested_amount,
              id2.units,id2.avg_buy_price,id2.last_price,id2.as_of_date,id2.nominee_name,id2.notes
       FROM investment_master im
       JOIN investment_details id2 ON id2.investment_id=im.id
       WHERE im.user_id=$1 AND im.active=TRUE
       ORDER BY im.sort_order ASC, im.created_at DESC`,
      [req.user.id]
    );
    const tv=r.rows.reduce((s,i)=>s+parseFloat(i.current_value||0),0);
    const ti=r.rows.reduce((s,i)=>s+parseFloat(i.invested_amount||i.current_value||0),0);
    const pnl=tv-ti;
    return res.json({ success:true, data:{
      investments:r.rows, count:r.rows.length,
      total:parseFloat(tv.toFixed(2)), totalInvested:parseFloat(ti.toFixed(2)),
      pnl:parseFloat(pnl.toFixed(2)),
      pnlPercent:ti>0?parseFloat(((pnl/ti)*100).toFixed(2)):0,
    }});
  } catch(e){ logger.error('[getInvestments]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const addInvestment = async (req, res) => {
  const { platformName, investmentType, accountIdMasked, instrumentName, currentValue,
          investedAmount, units, avgBuyPrice, lastPrice, asOfDate, currency, nomineeName, notes } = req.body;
  if (!platformName||currentValue===undefined)
    return res.status(400).json({ success:false, message:'Platform name and current value required.' });
  try {
    const m = await query(
      `INSERT INTO investment_master (user_id,platform_name,investment_type,account_id_masked,currency)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, platformName.trim(), investmentType||'stocks', accountIdMasked?.trim()||null, currency||'INR']
    );
    const iid=m.rows[0].id;
    await query(
      `INSERT INTO investment_details
         (investment_id,instrument_name,current_value,invested_amount,units,avg_buy_price,last_price,as_of_date,nominee_name,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [iid, instrumentName?.trim()||null, parseFloat(currentValue),
       investedAmount?parseFloat(investedAmount):null, units?parseFloat(units):null,
       avgBuyPrice?parseFloat(avgBuyPrice):null, lastPrice?parseFloat(lastPrice):null,
       asOfDate||null, nomineeName?.trim()||null, notes?.trim()||null]
    );
    const row=await query(
      `SELECT im.id,im.platform_name,im.investment_type,im.account_id_masked,
              id2.instrument_name,id2.current_value,id2.invested_amount,id2.units,
              id2.avg_buy_price,id2.notes,im.created_at
       FROM investment_master im JOIN investment_details id2 ON id2.investment_id=im.id WHERE im.id=$1`,[iid]);
    return res.status(201).json({ success:true, message:'Investment added.', data:{ investment:row.rows[0] } });
  } catch(e){ logger.error('[addInvestment]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const updateInvestment = async (req, res) => {
  const { id } = req.params;
  const { platformName, investmentType, accountIdMasked, instrumentName, currentValue,
          investedAmount, units, avgBuyPrice, lastPrice, asOfDate, nomineeName, notes } = req.body;
  try {
    const own=await query(`SELECT id FROM investment_master WHERE id=$1 AND user_id=$2 AND active=TRUE`,[id,req.user.id]);
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    await query(`UPDATE investment_master SET platform_name=COALESCE($1,platform_name),
      investment_type=COALESCE($2,investment_type), account_id_masked=COALESCE($3,account_id_masked) WHERE id=$4`,
      [platformName?.trim()||null, investmentType||null, accountIdMasked?.trim()||null, id]);
    await query(`UPDATE investment_details SET instrument_name=COALESCE($1,instrument_name),
      current_value=COALESCE($2,current_value), invested_amount=COALESCE($3,invested_amount),
      units=COALESCE($4,units), avg_buy_price=COALESCE($5,avg_buy_price),
      last_price=COALESCE($6,last_price), as_of_date=COALESCE($7,as_of_date),
      nominee_name=COALESCE($8,nominee_name), notes=COALESCE($9,notes) WHERE investment_id=$10`,
      [instrumentName?.trim()||null,
       currentValue!==undefined?parseFloat(currentValue):null,
       investedAmount!==undefined?parseFloat(investedAmount):null,
       units!==undefined?parseFloat(units):null,
       avgBuyPrice!==undefined?parseFloat(avgBuyPrice):null,
       lastPrice!==undefined?parseFloat(lastPrice):null,
       asOfDate||null, nomineeName?.trim()||null, notes?.trim()||null, id]);
    const row=await query(
      `SELECT im.id,im.platform_name,im.investment_type,id2.current_value,id2.invested_amount,
              id2.units,id2.avg_buy_price,id2.notes,im.updated_at
       FROM investment_master im JOIN investment_details id2 ON id2.investment_id=im.id WHERE im.id=$1`,[id]);
    return res.json({ success:true, message:'Updated.', data:{ investment:row.rows[0] } });
  } catch(e){ logger.error('[updateInvestment]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const deleteInvestment = async (req, res) => {
  try {
    const r=await query(`UPDATE investment_master SET active=FALSE WHERE id=$1 AND user_id=$2 AND active=TRUE RETURNING id`,[req.params.id,req.user.id]);
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    return res.json({ success:true, message:'Removed.' });
  } catch(e){ return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── DASHBOARD ─────────────────────────────────────────────────────
const getDashboardSummary = async (req, res) => {
  try {
    const r=await query(`SELECT * FROM vault_dashboard_summary WHERE user_id=$1`,[req.user.id]);
    const summary=r.rows[0]||{
      total_bank_balance:0, bank_account_count:0,
      total_investment_value:0, investment_count:0,
      total_commodity_value:0, commodity_count:0,
      total_property_value:0, property_count:0,
      total_borrowed:0, total_lent:0,
      total_wealth:0, nominee_count:0, document_count:0,
    };
    return res.json({ success:true, data:{ summary } });
  } catch(e){ logger.error('[getDashboard]',e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

module.exports = {
  getProfile, updateProfile,
  getBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount,
  getInvestments, addInvestment, updateInvestment, deleteInvestment,
  getDashboardSummary,
};
