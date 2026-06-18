const { query } = require('../db');
const logger    = require('../utils/logger');

const MAX_NOMINEES = 10;

// GET /api/nominees
const getNominees = async (req, res) => {
  try {
    const r = await query(
      `SELECT nm.id, nm.user_id, nm.full_name, nm.relationship, nm.is_primary,
              nm.share_percent, nm.active, nm.created_at, nm.updated_at,
              nd.email, nd.phone, nd.date_of_birth, nd.aadhaar_last4,
              nd.pan_number, nd.address, nd.notes
       FROM nominee_master nm
       JOIN nominee_details nd ON nd.nominee_id = nm.id
       WHERE nm.user_id = $1 AND nm.active = TRUE
       ORDER BY nm.is_primary DESC, nm.share_percent DESC, nm.created_at ASC`,
      [req.user.id]
    );
    const totalShare = r.rows.reduce((s,n) => s + parseFloat(n.share_percent), 0);
    return res.json({
      success: true,
      data: {
        nominees: r.rows, count: r.rows.length,
        totalSharePercent: parseFloat(totalShare.toFixed(2)),
        remainingSlots: MAX_NOMINEES - r.rows.length,
      },
    });
  } catch(e) {
    logger.error('[getNominees]', e.message);
    return res.status(500).json({ success:false, message:'Failed to fetch nominees.' });
  }
};

// POST /api/nominees
const addNominee = async (req, res) => {
  const { fullName, relationship, email, phone, dateOfBirth, address,
          sharePercent, isPrimary, notes, aadhaarLast4, panNumber } = req.body;
  if (!fullName || !relationship)
    return res.status(400).json({ success:false, message:'Full name and relationship are required.' });
  try {
    // Max check
    const cnt = await query(
      `SELECT COUNT(*) FROM nominee_master WHERE user_id=$1 AND active=TRUE`, [req.user.id]
    );
    if (parseInt(cnt.rows[0].count) >= MAX_NOMINEES)
      return res.status(400).json({ success:false, message:`Maximum ${MAX_NOMINEES} nominees allowed.` });

    // Share % validation
    const share = parseFloat(sharePercent || 0);
    const existing = await query(
      `SELECT COALESCE(SUM(share_percent),0) AS total FROM nominee_master WHERE user_id=$1 AND active=TRUE`,
      [req.user.id]
    );
    if (parseFloat(existing.rows[0].total) + share > 100)
      return res.status(400).json({
        success:false,
        message:`Total share cannot exceed 100%. Available: ${(100-parseFloat(existing.rows[0].total)).toFixed(2)}%`
      });

    // Clear primary if needed
    if (isPrimary)
      await query(`UPDATE nominee_master SET is_primary=FALSE WHERE user_id=$1`, [req.user.id]);

    // Insert master
    const m = await query(
      `INSERT INTO nominee_master (user_id,full_name,relationship,is_primary,share_percent)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, fullName.trim(), relationship, isPrimary||false, share]
    );
    const nid = m.rows[0].id;

    // Insert details
    await query(
      `INSERT INTO nominee_details (nominee_id,email,phone,date_of_birth,aadhaar_last4,pan_number,address,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [nid, email?.trim()||null, phone?.trim()||null, dateOfBirth||null,
       aadhaarLast4||null, panNumber?.toUpperCase().trim()||null,
       address?.trim()||null, notes?.trim()||null]
    );

    const row = await query(
      `SELECT nm.id,nm.full_name,nm.relationship,nm.is_primary,nm.share_percent,nm.created_at,
              nd.email,nd.phone,nd.date_of_birth,nd.aadhaar_last4,nd.pan_number,nd.address,nd.notes
       FROM nominee_master nm JOIN nominee_details nd ON nd.nominee_id=nm.id WHERE nm.id=$1`, [nid]
    );
    logger.info(`[addNominee] ${req.user.id}: ${fullName}`);
    return res.status(201).json({ success:true, message:'Nominee added.', data:{ nominee:row.rows[0] } });
  } catch(e) {
    logger.error('[addNominee]', e.message);
    return res.status(500).json({ success:false, message:'Failed to add nominee.' });
  }
};

// PUT /api/nominees/:id
const updateNominee = async (req, res) => {
  const { id } = req.params;
  const { fullName, relationship, email, phone, dateOfBirth, address,
          sharePercent, isPrimary, notes, aadhaarLast4, panNumber } = req.body;
  try {
    const own = await query(
      `SELECT id FROM nominee_master WHERE id=$1 AND user_id=$2 AND active=TRUE`, [id,req.user.id]
    );
    if (!own.rows.length) return res.status(404).json({ success:false, message:'Nominee not found.' });

    if (sharePercent !== undefined) {
      const others = await query(
        `SELECT COALESCE(SUM(share_percent),0) AS total FROM nominee_master
         WHERE user_id=$1 AND active=TRUE AND id!=$2`, [req.user.id,id]
      );
      if (parseFloat(others.rows[0].total) + parseFloat(sharePercent) > 100)
        return res.status(400).json({ success:false, message:'Total share cannot exceed 100%.' });
    }
    if (isPrimary)
      await query(`UPDATE nominee_master SET is_primary=FALSE WHERE user_id=$1 AND id!=$2`, [req.user.id,id]);

    await query(
      `UPDATE nominee_master SET full_name=COALESCE($1,full_name), relationship=COALESCE($2,relationship),
       is_primary=COALESCE($3,is_primary), share_percent=COALESCE($4,share_percent) WHERE id=$5`,
      [fullName?.trim()||null, relationship||null,
       isPrimary!==undefined?isPrimary:null,
       sharePercent!==undefined?parseFloat(sharePercent):null, id]
    );
    await query(
      `UPDATE nominee_details SET email=COALESCE($1,email), phone=COALESCE($2,phone),
       date_of_birth=COALESCE($3,date_of_birth), aadhaar_last4=COALESCE($4,aadhaar_last4),
       pan_number=COALESCE($5,pan_number), address=COALESCE($6,address), notes=COALESCE($7,notes)
       WHERE nominee_id=$8`,
      [email?.trim()||null, phone?.trim()||null, dateOfBirth||null,
       aadhaarLast4||null, panNumber?.toUpperCase().trim()||null,
       address?.trim()||null, notes?.trim()||null, id]
    );
    const row = await query(
      `SELECT nm.id,nm.full_name,nm.relationship,nm.is_primary,nm.share_percent,nm.updated_at,
              nd.email,nd.phone,nd.date_of_birth,nd.aadhaar_last4,nd.pan_number,nd.address,nd.notes
       FROM nominee_master nm JOIN nominee_details nd ON nd.nominee_id=nm.id WHERE nm.id=$1`, [id]
    );
    return res.json({ success:true, message:'Nominee updated.', data:{ nominee:row.rows[0] } });
  } catch(e) {
    logger.error('[updateNominee]', e.message);
    return res.status(500).json({ success:false, message:'Failed to update nominee.' });
  }
};

// DELETE /api/nominees/:id
const deleteNominee = async (req, res) => {
  try {
    const r = await query(
      `UPDATE nominee_master SET active=FALSE WHERE id=$1 AND user_id=$2 AND active=TRUE RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ success:false, message:'Nominee not found.' });
    return res.json({ success:true, message:'Nominee removed.' });
  } catch(e) {
    logger.error('[deleteNominee]', e.message);
    return res.status(500).json({ success:false, message:'Failed.' });
  }
};

module.exports = { getNominees, addNominee, updateNominee, deleteNominee };
