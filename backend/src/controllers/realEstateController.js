const { query } = require('../db');
const logger    = require('../utils/logger');

const toSqft = (value, unit) => {
  const rates = { sqft:1, sqm:10.7639, cents:435.56, acres:43560, grounds:2400, guntas:1089, perches:272.25, hectares:107639 };
  return parseFloat(value) * (rates[unit] || 1);
};

// ── REAL ESTATE ───────────────────────────────────────────────────
const getRealEstate = async (req, res) => {
  try {
    const r = await query(
      `SELECT rem.id, rem.user_id, rem.property_name, rem.property_type,
              rem.district, rem.state, rem.active, rem.sort_order,
              rem.created_at, rem.updated_at,
              red.door_flat_number, red.street_address, red.village_locality,
              red.taluk, red.pincode, red.survey_number, red.sub_division,
              red.patta_number, red.khata_number, red.ward_block,
              red.total_area, red.area_unit, red.area_in_sqft,
              red.uds_area, red.built_up_area, red.registration_number,
              red.registered_date, red.registration_office, red.document_number,
              red.purchase_price, red.current_market_value, red.guideline_value,
              red.stamp_duty_paid, red.loan_outstanding, red.lender_name,
              red.title_status, red.ec_updated_date, red.tax_paid_upto,
              red.occupancy_status, red.monthly_rental, red.co_owners,
              red.nominee_name, red.gps_lat, red.gps_lng, red.gps_address, red.notes
       FROM real_estate_master rem
       JOIN real_estate_details red ON red.property_id = rem.id
       WHERE rem.user_id = $1 AND rem.active = TRUE
       ORDER BY rem.sort_order ASC, rem.created_at DESC`,
      [req.user.id]
    );
    const total = r.rows.reduce((s,p) => s + parseFloat(p.current_market_value||0), 0);
    return res.json({ success:true, data:{ properties:r.rows, count:r.rows.length, totalValue:parseFloat(total.toFixed(2)) } });
  } catch(e) { logger.error('[getRE]', e.message); return res.status(500).json({ success:false, message:'Failed to fetch properties.' }); }
};

const addRealEstate = async (req, res) => {
  const b = req.body;
  if (!b.propertyName||!b.propertyType||!b.district||!b.state||!b.totalArea||!b.areaUnit)
    return res.status(400).json({ success:false, message:'Property name, type, district, state, area and unit required.' });
  try {
    const sqft = toSqft(b.totalArea, b.areaUnit);
    // Insert master
    const m = await query(
      `INSERT INTO real_estate_master (user_id, property_name, property_type, district, state)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, b.propertyName.trim(), b.propertyType, b.district.trim(), b.state.trim()]
    );
    const pid = m.rows[0].id;
    // Insert details
    await query(
      `INSERT INTO real_estate_details (
         property_id, door_flat_number, street_address, village_locality, taluk, pincode,
         survey_number, sub_division, patta_number, khata_number, ward_block,
         total_area, area_unit, area_in_sqft, uds_area, built_up_area,
         registration_number, registered_date, registration_office, document_number,
         purchase_price, current_market_value, guideline_value, stamp_duty_paid,
         loan_outstanding, lender_name, title_status, ec_updated_date, tax_paid_upto,
         occupancy_status, monthly_rental, co_owners, nominee_name,
         gps_lat, gps_lng, gps_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
               $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)`,
      [pid,
       b.doorFlatNumber?.trim()||null, b.streetAddress?.trim()||null,
       b.villageLocality?.trim()||null, b.taluk?.trim()||null, b.pincode?.trim()||null,
       b.surveyNumber?.trim()||null, b.subDivision?.trim()||null, b.pattaNumber?.trim()||null,
       b.khataNumber?.trim()||null, b.wardBlock?.trim()||null,
       parseFloat(b.totalArea), b.areaUnit, parseFloat(sqft.toFixed(4)),
       b.udsArea?parseFloat(b.udsArea):null, b.builtUpArea?parseFloat(b.builtUpArea):null,
       b.registrationNumber?.trim()||null, b.registeredDate||null,
       b.registrationOffice?.trim()||null, b.documentNumber?.trim()||null,
       b.purchasePrice?parseFloat(b.purchasePrice):null,
       b.currentMarketValue?parseFloat(b.currentMarketValue):null,
       b.guidelineValue?parseFloat(b.guidelineValue):null,
       b.stampDutyPaid?parseFloat(b.stampDutyPaid):null,
       b.loanOutstanding?parseFloat(b.loanOutstanding):0,
       b.lenderName?.trim()||null, b.titleStatus||'clear',
       b.ecUpdatedDate||null, b.taxPaidUpto||null,
       b.occupancyStatus?.trim()||null,
       b.monthlyRental?parseFloat(b.monthlyRental):null,
       b.coOwners?.trim()||null, b.nomineeName?.trim()||null,
       b.gpsLat?parseFloat(b.gpsLat):null, b.gpsLng?parseFloat(b.gpsLng):null,
       b.gpsAddress?.trim()||null, b.notes?.trim()||null]
    );
    const row = await query(
      `SELECT rem.id, rem.property_name, rem.property_type, rem.district, rem.state,
              red.total_area, red.area_unit, red.survey_number, red.current_market_value,
              red.title_status, red.loan_outstanding, red.gps_lat, red.gps_lng, rem.created_at
       FROM real_estate_master rem
       JOIN real_estate_details red ON red.property_id = rem.id
       WHERE rem.id = $1`, [pid]
    );
    logger.info(`[addRE] ${req.user.id}: ${b.propertyName}`);
    return res.status(201).json({ success:true, message:'Property added.', data:{ property:row.rows[0] } });
  } catch(e) { logger.error('[addRE]', e.message); return res.status(500).json({ success:false, message:'Failed to add property.' }); }
};

const updateRealEstate = async (req, res) => {
  const { id } = req.params; const b = req.body;
  try {
    const own = await query(
      `SELECT id FROM real_estate_master WHERE id=$1 AND user_id=$2 AND active=TRUE`, [id, req.user.id]
    );
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Property not found.' });
    const sqft = b.totalArea&&b.areaUnit ? toSqft(b.totalArea, b.areaUnit) : null;
    // Update master
    await query(
      `UPDATE real_estate_master SET
         property_name=COALESCE($1,property_name),
         property_type=COALESCE($2,property_type),
         district=COALESCE($3,district),
         state=COALESCE($4,state)
       WHERE id=$5`,
      [b.propertyName?.trim()||null, b.propertyType||null,
       b.district?.trim()||null, b.state?.trim()||null, id]
    );
    // Update details
    await query(
      `UPDATE real_estate_details SET
         door_flat_number=COALESCE($1,door_flat_number),
         street_address=COALESCE($2,street_address),
         village_locality=COALESCE($3,village_locality),
         taluk=COALESCE($4,taluk), pincode=COALESCE($5,pincode),
         survey_number=COALESCE($6,survey_number), sub_division=COALESCE($7,sub_division),
         patta_number=COALESCE($8,patta_number), khata_number=COALESCE($9,khata_number),
         ward_block=COALESCE($10,ward_block),
         total_area=COALESCE($11,total_area), area_unit=COALESCE($12,area_unit),
         area_in_sqft=COALESCE($13,area_in_sqft),
         uds_area=COALESCE($14,uds_area), built_up_area=COALESCE($15,built_up_area),
         registration_number=COALESCE($16,registration_number),
         registered_date=COALESCE($17,registered_date),
         registration_office=COALESCE($18,registration_office),
         document_number=COALESCE($19,document_number),
         purchase_price=COALESCE($20,purchase_price),
         current_market_value=COALESCE($21,current_market_value),
         guideline_value=COALESCE($22,guideline_value),
         stamp_duty_paid=COALESCE($23,stamp_duty_paid),
         loan_outstanding=COALESCE($24,loan_outstanding),
         lender_name=COALESCE($25,lender_name),
         title_status=COALESCE($26,title_status),
         ec_updated_date=COALESCE($27,ec_updated_date),
         tax_paid_upto=COALESCE($28,tax_paid_upto),
         occupancy_status=COALESCE($29,occupancy_status),
         monthly_rental=COALESCE($30,monthly_rental),
         co_owners=COALESCE($31,co_owners),
         nominee_name=COALESCE($32,nominee_name),
         gps_lat=COALESCE($33,gps_lat), gps_lng=COALESCE($34,gps_lng),
         gps_address=COALESCE($35,gps_address), notes=COALESCE($36,notes)
       WHERE property_id=$37`,
      [b.doorFlatNumber?.trim()||null, b.streetAddress?.trim()||null,
       b.villageLocality?.trim()||null, b.taluk?.trim()||null, b.pincode?.trim()||null,
       b.surveyNumber?.trim()||null, b.subDivision?.trim()||null,
       b.pattaNumber?.trim()||null, b.khataNumber?.trim()||null, b.wardBlock?.trim()||null,
       b.totalArea?parseFloat(b.totalArea):null, b.areaUnit||null,
       sqft?parseFloat(sqft.toFixed(4)):null,
       b.udsArea?parseFloat(b.udsArea):null, b.builtUpArea?parseFloat(b.builtUpArea):null,
       b.registrationNumber?.trim()||null, b.registeredDate||null,
       b.registrationOffice?.trim()||null, b.documentNumber?.trim()||null,
       b.purchasePrice?parseFloat(b.purchasePrice):null,
       b.currentMarketValue?parseFloat(b.currentMarketValue):null,
       b.guidelineValue?parseFloat(b.guidelineValue):null,
       b.stampDutyPaid?parseFloat(b.stampDutyPaid):null,
       b.loanOutstanding?parseFloat(b.loanOutstanding):null,
       b.lenderName?.trim()||null, b.titleStatus||null,
       b.ecUpdatedDate||null, b.taxPaidUpto||null,
       b.occupancyStatus?.trim()||null,
       b.monthlyRental?parseFloat(b.monthlyRental):null,
       b.coOwners?.trim()||null, b.nomineeName?.trim()||null,
       b.gpsLat?parseFloat(b.gpsLat):null, b.gpsLng?parseFloat(b.gpsLng):null,
       b.gpsAddress?.trim()||null, b.notes?.trim()||null, id]
    );
    const row = await query(
      `SELECT rem.id, rem.property_name, rem.property_type, rem.district, rem.state,
              red.total_area, red.area_unit, red.survey_number, red.current_market_value,
              red.title_status, red.loan_outstanding, rem.updated_at
       FROM real_estate_master rem
       JOIN real_estate_details red ON red.property_id = rem.id
       WHERE rem.id = $1`, [id]
    );
    return res.json({ success:true, message:'Updated.', data:{ property:row.rows[0] } });
  } catch(e) { logger.error('[updateRE]', e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const deleteRealEstate = async (req, res) => {
  try {
    const r = await query(
      `UPDATE real_estate_master SET active=FALSE WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    return res.json({ success:true, message:'Removed.' });
  } catch(e) { return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── LIABILITIES ───────────────────────────────────────────────────
const getLiabilities = async (req, res) => {
  const { direction } = req.query;
  try {
    let sql = `
      SELECT lm.id, lm.user_id, lm.direction, lm.liability_type, lm.label,
             lm.counterparty_name, lm.is_settled, lm.active, lm.sort_order,
             lm.created_at, lm.updated_at,
             ld.counterparty_phone, ld.counterparty_relation,
             ld.principal_amount, ld.outstanding_amount, ld.interest_rate, ld.emi_amount,
             ld.start_date, ld.due_date, ld.next_payment_date, ld.settled_date,
             ld.repayment_frequency, ld.loan_date, ld.transaction_mode, ld.transaction_ref,
             ld.account_number_masked, ld.loan_purpose, ld.collateral, ld.notes
      FROM liability_master lm
      JOIN liability_details ld ON ld.liability_id = lm.id
      WHERE lm.user_id = $1 AND lm.active = TRUE`;
    const params = [req.user.id];
    if (direction && direction !== 'all') {
      params.push(direction);
      sql += ` AND lm.direction = $${params.length}`;
    }
    sql += ` ORDER BY lm.is_settled ASC, ld.due_date ASC NULLS LAST, lm.created_at DESC`;
    const r = await query(sql, params);
    const borrowed = r.rows.filter(l=>l.direction==='borrowed'&&!l.is_settled).reduce((s,l)=>s+parseFloat(l.outstanding_amount),0);
    const lent     = r.rows.filter(l=>l.direction==='lent'&&!l.is_settled).reduce((s,l)=>s+parseFloat(l.outstanding_amount),0);
    return res.json({ success:true, data:{
      liabilities:r.rows, count:r.rows.length,
      totalBorrowed:parseFloat(borrowed.toFixed(2)),
      totalLent:parseFloat(lent.toFixed(2)),
    }});
  } catch(e) { logger.error('[getLiab]', e.message); return res.status(500).json({ success:false, message:'Failed to fetch liabilities.' }); }
};

const addLiability = async (req, res) => {
  const b = req.body;
  if (!b.direction||!b.liabilityType||!b.label||!b.counterpartyName||!b.principalAmount||!b.outstandingAmount)
    return res.status(400).json({ success:false, message:'Direction, type, label, counterparty, principal and outstanding required.' });
  try {
    // Insert master
    const m = await query(
      `INSERT INTO liability_master (user_id, direction, liability_type, label, counterparty_name)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, b.direction, b.liabilityType, b.label.trim(), b.counterpartyName.trim()]
    );
    const lid = m.rows[0].id;
    // Insert details
    await query(
      `INSERT INTO liability_details (
         liability_id, counterparty_phone, counterparty_relation,
         principal_amount, outstanding_amount, interest_rate, emi_amount,
         start_date, due_date, next_payment_date, repayment_frequency,
         loan_date, transaction_mode, transaction_ref,
         account_number_masked, loan_purpose, collateral, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [lid, b.counterpartyPhone?.trim()||null, b.counterpartyRelation?.trim()||null,
       parseFloat(b.principalAmount), parseFloat(b.outstandingAmount),
       b.interestRate?parseFloat(b.interestRate):null, b.emiAmount?parseFloat(b.emiAmount):null,
       b.startDate||null, b.dueDate||null, b.nextPaymentDate||null, b.repaymentFrequency||null,
       b.loanDate||null, b.transactionMode||null, b.transactionRef?.trim()||null,
       b.accountNumberMasked?.trim()||null, b.loanPurpose?.trim()||null,
       b.collateral?.trim()||null, b.notes?.trim()||null]
    );
    const row = await query(
      `SELECT lm.id, lm.direction, lm.liability_type, lm.label, lm.counterparty_name,
              ld.principal_amount, ld.outstanding_amount, ld.interest_rate,
              ld.due_date, ld.loan_date, ld.transaction_mode, lm.created_at
       FROM liability_master lm
       JOIN liability_details ld ON ld.liability_id = lm.id
       WHERE lm.id = $1`, [lid]
    );
    logger.info(`[addLiab] ${req.user.id}: ${b.label}`);
    return res.status(201).json({ success:true, message:'Liability added.', data:{ liability:row.rows[0] } });
  } catch(e) { logger.error('[addLiab]', e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const updateLiability = async (req, res) => {
  const { id } = req.params; const b = req.body;
  try {
    const own = await query(
      `SELECT id FROM liability_master WHERE id=$1 AND user_id=$2 AND active=TRUE`, [id, req.user.id]
    );
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    // Update master
    await query(
      `UPDATE liability_master SET
         label=COALESCE($1,label),
         counterparty_name=COALESCE($2,counterparty_name),
         is_settled=COALESCE($3,is_settled)
       WHERE id=$4`,
      [b.label?.trim()||null, b.counterpartyName?.trim()||null,
       b.isSettled!==undefined?b.isSettled:null, id]
    );
    // Update details
    await query(
      `UPDATE liability_details SET
         counterparty_phone=COALESCE($1,counterparty_phone),
         counterparty_relation=COALESCE($2,counterparty_relation),
         principal_amount=COALESCE($3,principal_amount),
         outstanding_amount=COALESCE($4,outstanding_amount),
         interest_rate=COALESCE($5,interest_rate),
         emi_amount=COALESCE($6,emi_amount),
         start_date=COALESCE($7,start_date),
         due_date=COALESCE($8,due_date),
         next_payment_date=COALESCE($9,next_payment_date),
         settled_date=COALESCE($10,settled_date),
         repayment_frequency=COALESCE($11,repayment_frequency),
         loan_date=COALESCE($12,loan_date),
         transaction_mode=COALESCE($13,transaction_mode),
         transaction_ref=COALESCE($14,transaction_ref),
         account_number_masked=COALESCE($15,account_number_masked),
         loan_purpose=COALESCE($16,loan_purpose),
         collateral=COALESCE($17,collateral),
         notes=COALESCE($18,notes)
       WHERE liability_id=$19`,
      [b.counterpartyPhone?.trim()||null, b.counterpartyRelation?.trim()||null,
       b.principalAmount?parseFloat(b.principalAmount):null,
       b.outstandingAmount!==undefined?parseFloat(b.outstandingAmount):null,
       b.interestRate?parseFloat(b.interestRate):null,
       b.emiAmount?parseFloat(b.emiAmount):null,
       b.startDate||null, b.dueDate||null, b.nextPaymentDate||null,
       b.settledDate||null, b.repaymentFrequency||null,
       b.loanDate||null, b.transactionMode||null, b.transactionRef?.trim()||null,
       b.accountNumberMasked?.trim()||null, b.loanPurpose?.trim()||null,
       b.collateral?.trim()||null, b.notes?.trim()||null, id]
    );
    const row = await query(
      `SELECT lm.id, lm.direction, lm.liability_type, lm.label, lm.is_settled,
              ld.outstanding_amount, ld.due_date, lm.updated_at
       FROM liability_master lm
       JOIN liability_details ld ON ld.liability_id = lm.id
       WHERE lm.id = $1`, [id]
    );
    return res.json({ success:true, message:'Updated.', data:{ liability:row.rows[0] } });
  } catch(e) { logger.error('[updateLiab]', e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const deleteLiability = async (req, res) => {
  try {
    const r = await query(
      `UPDATE liability_master SET active=FALSE WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    return res.json({ success:true, message:'Removed.' });
  } catch(e) { return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── COMMODITIES ───────────────────────────────────────────────────
const getCommodities = async (req, res) => {
  const { type } = req.query;
  try {
    let sql = `SELECT * FROM commodities WHERE user_id=$1 AND active=TRUE`;
    const p = [req.user.id];
    if (type&&type!=='all'){ p.push(type); sql+=` AND commodity_type=$${p.length}`; }
    sql += ' ORDER BY sort_order ASC, created_at DESC';
    const r = await query(sql, p);
    const total = r.rows.reduce((s,c)=>s+parseFloat(c.current_value||0),0);
    return res.json({ success:true, data:{ commodities:r.rows, count:r.rows.length, totalValue:parseFloat(total.toFixed(2)) } });
  } catch(e) { logger.error('[getCom]', e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const addCommodity = async (req, res) => {
  const b = req.body;
  if (!b.commodityType||!b.name||b.currentValue===undefined)
    return res.status(400).json({ success:false, message:'Type, name and current value required.' });
  try {
    const r = await query(
      `INSERT INTO commodities (user_id,commodity_type,name,description,weight,weight_unit,
       purity,quantity,purchase_price,current_value,purchase_date,storage_location,
       insurance_policy_no,certificate_number,maturity_date,face_value,interest_rate,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [req.user.id, b.commodityType, b.name.trim(), b.description?.trim()||null,
       b.weight?parseFloat(b.weight):null, b.weightUnit||null, b.purity?.trim()||null,
       b.quantity?parseInt(b.quantity):null, b.purchasePrice?parseFloat(b.purchasePrice):null,
       parseFloat(b.currentValue), b.purchaseDate||null, b.storageLocation?.trim()||null,
       b.insurancePolicyNo?.trim()||null, b.certificateNumber?.trim()||null,
       b.maturityDate||null, b.faceValue?parseFloat(b.faceValue):null,
       b.interestRate?parseFloat(b.interestRate):null, b.notes?.trim()||null]
    );
    return res.status(201).json({ success:true, message:'Commodity added.', data:{ commodity:r.rows[0] } });
  } catch(e) { logger.error('[addCom]', e.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

const updateCommodity = async (req, res) => {
  const { id } = req.params; const b = req.body;
  try {
    const own = await query(`SELECT id FROM commodities WHERE id=$1 AND user_id=$2 AND active=TRUE`,[id,req.user.id]);
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    const r = await query(
      `UPDATE commodities SET name=COALESCE($1,name), description=COALESCE($2,description),
       weight=COALESCE($3,weight), weight_unit=COALESCE($4,weight_unit),
       purity=COALESCE($5,purity), quantity=COALESCE($6,quantity),
       purchase_price=COALESCE($7,purchase_price), current_value=COALESCE($8,current_value),
       purchase_date=COALESCE($9,purchase_date), storage_location=COALESCE($10,storage_location),
       certificate_number=COALESCE($11,certificate_number), maturity_date=COALESCE($12,maturity_date),
       face_value=COALESCE($13,face_value), interest_rate=COALESCE($14,interest_rate),
       notes=COALESCE($15,notes)
       WHERE id=$16 AND user_id=$17 RETURNING *`,
      [b.name?.trim()||null, b.description?.trim()||null,
       b.weight?parseFloat(b.weight):null, b.weightUnit||null, b.purity?.trim()||null,
       b.quantity?parseInt(b.quantity):null, b.purchasePrice?parseFloat(b.purchasePrice):null,
       b.currentValue?parseFloat(b.currentValue):null, b.purchaseDate||null,
       b.storageLocation?.trim()||null, b.certificateNumber?.trim()||null,
       b.maturityDate||null, b.faceValue?parseFloat(b.faceValue):null,
       b.interestRate?parseFloat(b.interestRate):null, b.notes?.trim()||null,
       id, req.user.id]
    );
    return res.json({ success:true, message:'Updated.', data:{ commodity:r.rows[0] } });
  } catch(e) { return res.status(500).json({ success:false, message:'Failed.' }); }
};

const deleteCommodity = async (req, res) => {
  try {
    const r = await query(`UPDATE commodities SET active=FALSE WHERE id=$1 AND user_id=$2 RETURNING id`,[req.params.id,req.user.id]);
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Not found.' });
    return res.json({ success:true, message:'Removed.' });
  } catch { return res.status(500).json({ success:false, message:'Failed.' }); }
};

module.exports = {
  getRealEstate, addRealEstate, updateRealEstate, deleteRealEstate,
  getLiabilities, addLiability, updateLiability, deleteLiability,
  getCommodities, addCommodity, updateCommodity, deleteCommodity,
};
