/* =================================================================
   VAULTLIFE — FOLLOW-THE-SUN REPLICATION REGION PAIRS
   
   Rule: Primary and Standby are ~12 hours apart so that when
   one region is at peak business hours (Day), the other is at
   off-peak (Night). The Night region handles backup, archiving
   and maintenance without affecting user-facing performance.
   
   Primary: Chennai/Mumbai (IST UTC+5:30)
   ↓
   Pick the standby that is closest to UTC±0 from IST:
   IST = UTC+5:30  →  opposite = UTC-6:30 (roughly UTC-6 or UTC-7)
   = US Central / Mountain Time
   ================================================================= */

const REGION_PAIRS = [

  // ── INDIA PRIMARY ─────────────────────────────────────────────
  {
    primary:  { name:'Mumbai / Chennai',  cloud:'AWS ap-south-1 / GCP asia-south1',    utc:'+5:30', daytime:'09:00–18:00 IST' },
    standby:  { name:'São Paulo',         cloud:'AWS sa-east-1 / GCP southamerica-east1', utc:'-3:00', daytime:'09:00–18:00 BRT',
                note:'When IST is 09:00 (day), São Paulo is 00:30 (night). 12.5h apart.' },
    recommended: true,
  },
  {
    primary:  { name:'Mumbai / Chennai',  cloud:'AWS ap-south-1',  utc:'+5:30' },
    standby:  { name:'US Central (Dallas)',cloud:'AWS us-east-2 / GCP us-central1', utc:'-6:00',
                note:'When IST is 09:00 (day), US Central is 21:30 previous day (night). 14.5h apart.' },
    recommended: true,
  },

  // ── SINGAPORE / SOUTHEAST ASIA PRIMARY ───────────────────────
  {
    primary:  { name:'Singapore',         cloud:'AWS ap-southeast-1 / GCP asia-southeast1', utc:'+8:00' },
    standby:  { name:'London / Ireland',  cloud:'AWS eu-west-2 / GCP europe-west2',          utc:'+0:00 / +1:00 BST',
                note:'When SGT is 09:00 (day), London is 01:00 (night). 8h apart (good enough).' },
    recommended: true,
  },
  {
    primary:  { name:'Singapore',         cloud:'AWS ap-southeast-1', utc:'+8:00' },
    standby:  { name:'US West (Oregon)',  cloud:'AWS us-west-2 / GCP us-west1',    utc:'-8:00',
                note:'When SGT is 09:00 (day), US West is 17:00 previous day. 16h apart.' },
  },

  // ── JAPAN / KOREA PRIMARY ─────────────────────────────────────
  {
    primary:  { name:'Tokyo',             cloud:'AWS ap-northeast-1 / GCP asia-northeast1', utc:'+9:00' },
    standby:  { name:'Frankfurt',         cloud:'AWS eu-central-1 / GCP europe-west3',       utc:'+1:00 / +2:00 CEST',
                note:'When JST is 09:00 (day), Frankfurt is 01:00 (night). 8h apart.' },
    recommended: true,
  },

  // ── US EAST PRIMARY ───────────────────────────────────────────
  {
    primary:  { name:'N. Virginia (US East)', cloud:'AWS us-east-1 / GCP us-east4', utc:'-5:00 EST / -4:00 EDT' },
    standby:  { name:'Mumbai',               cloud:'AWS ap-south-1 / GCP asia-south1', utc:'+5:30',
                note:'When EST is 09:00 (day), IST is 19:30 (evening/night). 10.5h apart.' },
    recommended: true,
  },
  {
    primary:  { name:'N. Virginia (US East)', cloud:'AWS us-east-1', utc:'-5:00' },
    standby:  { name:'Sydney',               cloud:'AWS ap-southeast-2 / GCP australia-southeast1', utc:'+11:00',
                note:'When EST is 09:00 (day), Sydney is 00:00 (midnight). 16h apart.' },
  },

  // ── EUROPE PRIMARY ────────────────────────────────────────────
  {
    primary:  { name:'Frankfurt / Ireland', cloud:'AWS eu-central-1 / GCP europe-west3', utc:'+1:00 CET' },
    standby:  { name:'Sydney',              cloud:'AWS ap-southeast-2',                   utc:'+11:00',
                note:'When CET is 09:00 (day), Sydney is 19:00 (evening). 10h apart.' },
  },
  {
    primary:  { name:'Frankfurt / Ireland', cloud:'AWS eu-central-1', utc:'+1:00' },
    standby:  { name:'US West (Oregon)',    cloud:'AWS us-west-2 / GCP us-west1', utc:'-8:00',
                note:'When CET is 09:00 (day), US West is 00:00 midnight. 9h apart.' },
    recommended: true,
  },

  // ── AUSTRALIA PRIMARY ─────────────────────────────────────────
  {
    primary:  { name:'Sydney',              cloud:'AWS ap-southeast-2', utc:'+11:00 AEDT' },
    standby:  { name:'London',              cloud:'AWS eu-west-2 / GCP europe-west2', utc:'+0:00',
                note:'When AEDT is 09:00 (day), London is 22:00 previous day (night). 11h apart.' },
    recommended: true,
  },
];

export default REGION_PAIRS;
