-- Blue Dots micro-markets: match-score training counts (added 2026-11-04)
-- Read-only. Run in the Supabase SQL editor on campaign-manager (vqvonmoktpvfvzlhtiqo), export as JSON,
-- then fit weights with: python3 scripts/fit_match.py counts.json   (method: docs/match_score.md)
-- Positives: every apply action (not cancelled). Controls: for each application, 3 pseudo-random seekers
-- from the same state paired with the same job. Only grouped counts leave the database, no person-level rows.

with rules(ord, family, pat) as (values
(1,'Not stated','^[\s|]*$'),
(2,'Healthcare & care','nurs|health|duty assistant|dietetic|caretaker|care ?giver|pharmac|panchakarma|hospital|medical|doctor|patient|phlebotom|\mgda\M'),
(3,'Beauty & wellness','beauty|makeup|make-up|salon|hair|spa\M|wellness|yoga'),
(4,'Tailoring, fashion & garments','sew|tailor|garment|embroider|fashion|stitch|textile|spinning'),
(5,'Construction & civil','civil|draughtsman|draftsman|facade|foreman|mason|plumb|carpent|construct|site engineer|surveyor'),
(6,'Electronics & repair','electronic|pcb|ict system|mobile|cctv|broadband|led light|peripheral|hardware|telecom'),
(7,'Electrical','electric|solar|wire|wiring|cable'),
(8,'Welding & fabrication','weld|fabricat'),
(9,'Mechanic, auto & AC','mechanic|automobile|motor vehicle|diesel|refrigeration|air condition|\mac\M|two wheeler|tractor'),
(10,'Office & data entry','data entry|computer operat|office|admin|clerical|clerk|back office|\mmis\M|receptionist|front desk|document'),
(11,'IT & software','software|developer|python|java|\mit\M|web|data analy|computer science|computer application|\mbca\M|b\.c\.a|programm|coding|autocad|auto-cad|design engineer'),
(12,'Machine & production','cnc|vmc|lathe|turner|machinist|machine operat|operator|production|assembly|manufactur|mould|plant|\mpress|quality|qa-qc|\mqc\M|robotic|additive'),
(13,'Fitter & maintenance','fitter|mechanical|maintenance|technician'),
(14,'Accounts & finance','account|financ|billing|tally|b\.? ?com|commerce|cashier|banking|loan'),
(15,'Sales & marketing','sales|marketing|promoter|business develop|insurance|advisor|\masm\M|\mbde\M'),
(16,'Customer service','customer|call cent|tele|bpo|support|crm|voice'),
(17,'Retail & store','retail|\mstore|crew|floor|shop|counter'),
(18,'Logistics & delivery','warehouse|loader|loading|picker|deliver|driver|driving|logistic|courier|packag|transport|dispatch'),
(19,'Teaching & training','teach|trainer|tutor|b\.?ed\M|education'),
(20,'Helper & general','helper|labou?r|worker|unskilled|housekeep|clean|security|guard|peon|attendant'),
(21,'ITI, any trade','\miti\M'),
(22,'Open to anything','\many(thing)?\M'),
(23,'Studied, no trade stated','bachelor|master|\mb\.?a\M|\mb\.?sc|\mb\.?e\M|b\.?tech|\mm\.?a\M|degree|graduat|diploma|college|school|\mpu\M|10th|12th|l\.?l\.?b|हाईस्कूल|इंटरमीडिएट|बी०ए०|vocational|certification|polytechnic')
,
seekers as materialized (
  select i.instance, i.item_id, case when coalesce(i.is_default_geo,false) then null else i.lat end lat, case when coalesce(i.is_default_geo,false) then null else i.lng end lng,
    lower(concat_ws(' ', i.item_state->>'itiTrade', i.item_state->>'nameOfJobRolesInterestedIn', i.item_state->>'polytechnicDiploma',
      i.item_state->>'vocationalTrainingOther', i.item_state->>'collegeQualification', i.item_state->>'schoolQualification', i.item_state->>'educationCategory')) t,
    lower(coalesce(i.item_state->>'natureOfJobsInterestedIn','')) nature, coalesce(i.item_state->>'workExperience','') exp,
    row_number() over (partition by i.instance order by md5(i.item_id)) rn
  from bluedot_items i where i.item_network='blue_dot' and i.instance in ('UP','KA') and i.item_type='profile_1.0' and jsonb_typeof(i.item_state)='object'),
nseek as (select instance, count(*) n from seekers group by 1),
jobs as materialized (
  select i.instance, i.item_id, case when coalesce(i.is_default_geo,false) then null else i.lat end lat, case when coalesce(i.is_default_geo,false) then null else i.lng end lng,
    lower(coalesce(nullif(nullif(nullif(trim(i.item_state->>'role'),''),'na'),'Any'),'')) t,
    lower(trim(split_part(coalesce(nullif(nullif(nullif(trim(i.item_state->>'role'),''),'na'),'Any'),''),'|',1))) base,
    lower(coalesce(i.item_state->>'natureOfJob','')) nature, coalesce(i.item_state->>'candidateExperienceType','') exp
  from bluedot_items i where i.item_network='blue_dot' and i.instance in ('UP','KA') and i.item_type='job_posting_1.0' and jsonb_typeof(i.item_state)='object'),
apps as (
  select a.instance, a.source_item_id sid, a.target_item_id jid, (a.action_status='accepted')::int acc, row_number() over (order by a.action_id) i
  from bluedot_item_actions a where a.action_type='apply' and a.source_item_type='profile_1.0' and a.target_item_type='job_posting_1.0' and a.action_status <> 'cancelled'),
pairs as (
  select instance, sid, jid, 1 applied, acc from apps
  union all
  select a.instance, s.item_id, a.jid, 0, 0 from apps a cross join generate_series(1,3) g
    join nseek n on n.instance=a.instance
    join seekers s on s.instance=a.instance and s.rn = ((a.i*7919 + g*104729) % n.n) + 1),
feat as (
  select p.applied, p.acc, p.instance,
    case when s.lat is null or j.lat is null then 'unknown'
      else (select case when d<=2 then '0-2' when d<=5 then '2-5' when d<=10 then '5-10' when d<=20 then '10-20' else '20+' end
            from (select sqrt(power((s.lng-j.lng)*111.32*cos(radians(j.lat)),2)+power((s.lat-j.lat)*110.57,2)) d) x) end dist,
    (select r.family from rules r where s.t ~ r.pat order by r.ord limit 1) sf,
    (select r.family from rules r where j.t ~ r.pat order by r.ord limit 1) jf,
    case when j.base in ('','iti (other)') then 'unknown' when position(j.base in s.t) > 0 then 'yes' else 'no' end role_exact,
    case when s.nature='' or j.nature in ('','not available') then 'unknown' when position(j.nature in s.nature) > 0 then 'yes' else 'no' end nature,
    case when j.exp='Worked before' and s.exp='Worked before' then 'match' when j.exp='Worked before' and s.exp='Fresher' then 'mismatch' else 'neutral' end exp
  from pairs p join seekers s on s.item_id=p.sid join jobs j on j.item_id=p.jid)
select instance, dist,
  case when sf is null or jf is null or sf in ('Studied, no trade stated','Open to anything','Not stated','ITI, any trade','Other')
         or jf in ('Studied, no trade stated','Open to anything','Not stated','ITI, any trade','Other') then 'unknown'
       when sf=jf then 'same' else 'different' end fam,
  role_exact, nature, exp, count(*) filter (where applied=1) apps, count(*) filter (where applied=0) controls, sum(acc) accepted
from feat group by 1,2,3,4,5,6 order by 1,2,3,4,5,6;
