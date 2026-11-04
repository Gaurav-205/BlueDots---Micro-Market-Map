-- Blue Dots micro-markets: match score v2 (added 2026-11-04). Method and weights: docs/match_score.md
-- Read-only. Run in the Supabase SQL editor on campaign-manager (vqvonmoktpvfvzlhtiqo).
-- Lists the best-matching live seekers for one job. Put the job's item_id in params, or set seeker_id instead
-- to list the best jobs for one seeker. Output has item ids only; look people up in the Blue Dots admin.
-- Score 0-100 = the apply model's probability that a pair like this was a real application (relevance, not hiring odds).

with params(job_id, seeker_id, top_n) as (values ('PUT-JOB-ITEM-ID-HERE', null::text, 50)),
rules(ord, family, pat) as (values
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
seekers0 as (
  select i.instance, i.item_id, case when coalesce(i.is_default_geo,false) then null else i.lat end lat, case when coalesce(i.is_default_geo,false) then null else i.lng end lng,
    lower(concat_ws(' ', i.item_state->>'itiTrade', i.item_state->>'nameOfJobRolesInterestedIn', i.item_state->>'polytechnicDiploma',
      i.item_state->>'vocationalTrainingOther', i.item_state->>'collegeQualification', i.item_state->>'schoolQualification', i.item_state->>'educationCategory')) t,
    lower(coalesce(i.item_state->>'natureOfJobsInterestedIn','')) nature, coalesce(i.item_state->>'workExperience','') exp
  from bluedot_items i, params
  where i.lifecycle_status='live' and i.item_network='blue_dot' and i.item_type='profile_1.0' and jsonb_typeof(i.item_state)='object'
    and (params.seeker_id is null or i.item_id = params.seeker_id)),
-- Kind of work once per person and per job (not per pair), so the query stays fast.
seekers as materialized (select s.*, (select r.family from rules r where s.t ~ r.pat order by r.ord limit 1) fam from seekers0 s),
jobs0 as (
  select i.instance, i.item_id, case when coalesce(i.is_default_geo,false) then null else i.lat end lat, case when coalesce(i.is_default_geo,false) then null else i.lng end lng,
    lower(coalesce(nullif(nullif(nullif(trim(i.item_state->>'role'),''),'na'),'Any'),'')) t,
    lower(trim(split_part(coalesce(nullif(nullif(nullif(trim(i.item_state->>'role'),''),'na'),'Any'),''),'|',1))) base,
    lower(coalesce(i.item_state->>'natureOfJob','')) nature, coalesce(i.item_state->>'candidateExperienceType','') exp
  from bluedot_items i, params
  where i.lifecycle_status='live' and i.item_network='blue_dot' and i.item_type='job_posting_1.0' and jsonb_typeof(i.item_state)='object'
    and (params.job_id is null or params.seeker_id is not null or i.item_id = params.job_id)),
jobs as materialized (select j.*, (select r.family from rules r where j.t ~ r.pat order by r.ord limit 1) fam from jobs0 j),
pairs as (
  select s.item_id seeker_id, j.item_id job_id,
    case when s.lat is null or j.lat is null then null else sqrt(power((s.lng-j.lng)*111.32*cos(radians(j.lat)),2)+power((s.lat-j.lat)*110.57,2)) end km,
    s.fam sf, j.fam jf,
    case when j.base in ('','iti (other)') then 'unknown' when position(j.base in s.t) > 0 then 'yes' else 'no' end role_exact,
    case when s.nature='' or j.nature in ('','not available') then 'unknown' when position(j.nature in s.nature) > 0 then 'yes' else 'no' end nature,
    case when j.exp='Worked before' and s.exp='Worked before' then 'match' when j.exp='Worked before' and s.exp='Fresher' then 'mismatch' else 'neutral' end exp
  from seekers s join jobs j on j.instance = s.instance),
scored as (
  select *,
    -1.353
    + case when km is null then -0.833 when km <= 2 then 1.186 when km <= 5 then 0.926 when km <= 10 then 0.672 when km <= 20 then 0.835 else 0 end
    + case when sf is null or jf is null or sf in ('Studied, no trade stated','Open to anything','Not stated','ITI, any trade','Other')
                or jf in ('Studied, no trade stated','Open to anything','Not stated','ITI, any trade','Other') then -0.645
           when sf = jf then 1.024 else 0 end
    + case role_exact when 'yes' then 1.437 when 'unknown' then 0.784 else 0 end
    + case nature when 'yes' then 0.66 when 'unknown' then -0.035 else 0 end
    + case exp when 'match' then 1.062 when 'mismatch' then -0.788 else 0 end as logit
  from pairs)
select seeker_id, job_id, round(100 / (1 + exp(-logit))) as score, round(km::numeric, 1) as km, sf as seeker_family, jf as job_family, role_exact, nature, exp
from scored
order by score desc, km nulls last
limit (select top_n from params);
