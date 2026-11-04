-- Blue Dots micro-markets: markets
-- Read-only. Run in the Supabase SQL editor on campaign-manager (vqvonmoktpvfvzlhtiqo) and export the result as CSV.

with pts as (
  select i.item_type, i.instance, i.lat, i.lng, i.created_at,
    case when i.item_type='job_posting_1.0' then least(coalesce(nullif(regexp_replace(i.item_state->>'positions','[^0-9]','','g'),'')::int,1),50) end openings,
    case when i.instance='UP' then 'Ghaziabad' else 'Hubli-Dharwad' end district,
    case when i.item_type='job_posting_1.0' then nullif(nullif(nullif(trim(i.item_state->>'role'),''),'na'),'Any') end job_role
  from bluedot_items i
  where i.lifecycle_status='live' and i.item_network='blue_dot' and i.instance in ('UP','KA')
    and i.item_type in ('profile_1.0','job_posting_1.0')
    and i.lat is not null and coalesce(i.is_default_geo,false)=false
    and ((i.instance='UP' and point(i.lng,i.lat) <@ polygon '((77.6897,28.7441),(77.6872,28.7433),(77.6822,28.7243),(77.6704,28.7288),(77.6561,28.7345),(77.6558,28.7342),(77.6409,28.7240),(77.6403,28.7240),(77.6397,28.7243),(77.6148,28.7321),(77.6132,28.7326),(77.6073,28.7286),(77.6064,28.7278),(77.6058,28.7275),(77.6151,28.7160),(77.5803,28.7004),(77.5651,28.6935),(77.5461,28.6849),(77.5458,28.6667),(77.5663,28.6530),(77.5477,28.6519),(77.5452,28.6530),(77.5449,28.6519),(77.5421,28.6334),(77.5203,28.6487),(77.5004,28.6490),(77.4774,28.6273),(77.4566,28.6380),(77.4336,28.6222),(77.3910,28.6342),(77.3866,28.6543),(77.3857,28.6519),(77.3733,28.6222),(77.3584,28.6179),(77.3689,28.6088),(77.3438,28.6104),(77.3422,28.6096),(77.3425,28.6219),(77.3164,28.6412),(77.3236,28.6769),(77.3329,28.6819),(77.3232,28.6986),(77.3310,28.7130),(77.2984,28.7087),(77.2912,28.7079),(77.2894,28.7077),(77.2897,28.7090),(77.2906,28.7224),(77.2763,28.7355),(77.2608,28.7342),(77.2564,28.7562),(77.2356,28.7610),(77.2281,28.7699),(77.2278,28.7704),(77.2219,28.7774),(77.2340,28.7838),(77.2076,28.7916),(77.2026,28.7932),(77.2014,28.8125),(77.2188,28.8082),(77.2225,28.8315),(77.2228,28.8334),(77.2306,28.8227),(77.2527,28.8277),(77.2800,28.8342),(77.2931,28.8275),(77.3046,28.7908),(77.3242,28.8023),(77.3413,28.7950),(77.3481,28.8060),(77.3633,28.7862),(77.3950,28.7766),(77.4059,28.7825),(77.3944,28.8036),(77.4056,28.8138),(77.3901,28.8285),(77.4140,28.8403),(77.4013,28.8500),(77.4028,28.8776),(77.4190,28.8800),(77.4473,28.9272),(77.4473,28.9272),(77.4588,28.9253),(77.4566,28.9068),(77.5035,28.8950),(77.5315,28.8880),(77.5449,28.8939),(77.5573,28.8937),(77.5713,28.8872),(77.5825,28.8929),(77.5927,28.8749),(77.6425,28.8819),(77.6552,28.8682),(77.6832,28.8733),(77.7000,28.8532),(77.6919,28.8237),(77.7096,28.8130),(77.7080,28.7897),(77.6844,28.7674),(77.6794,28.7629))')
      or (i.instance='KA' and point(i.lng,i.lat) <@ polygon '((74.7392,15.4142),(74.7296,15.4314),(74.7445,15.4636),(74.7273,15.4890),(74.7488,15.4962),(74.7782,15.4594),(74.7868,15.4861),(74.8140,15.5050),(74.7981,15.5486),(74.8411,15.5749),(74.8305,15.6104),(74.8788,15.6179),(74.9023,15.6319),(74.9652,15.6273),(74.9665,15.6543),(75.0195,15.6439),(75.0284,15.6699),(75.0469,15.6706),(75.0486,15.6777),(75.0598,15.6820),(75.0565,15.6325),(75.0919,15.6078),(75.1081,15.6719),(75.2028,15.6491),(75.2028,15.6816),(75.2362,15.6790),(75.2491,15.6471),(75.2739,15.6488),(75.2779,15.6872),(75.2895,15.6907),(75.2938,15.6917),(75.3371,15.6738),(75.3358,15.6488),(75.3596,15.6455),(75.3626,15.6686),(75.4132,15.6553),(75.4476,15.6823),(75.4701,15.6842),(75.4685,15.7008),(75.4877,15.7025),(75.5026,15.6475),(75.5545,15.6471),(75.5343,15.5915),(75.5294,15.5378),(75.4817,15.5316),(75.4751,15.5167),(75.4718,15.4926),(75.4870,15.4894),(75.4953,15.4698),(75.4923,15.3686),(75.4754,15.3956),(75.4688,15.3859),(75.4447,15.3862),(75.4576,15.3420),(75.4496,15.3019),(75.4126,15.2997),(75.4063,15.2775),(75.4169,15.2749),(75.4020,15.2733),(75.4030,15.2603),(75.4165,15.2626),(75.4159,15.2346),(75.4404,15.2271),(75.4493,15.2082),(75.4331,15.2099),(75.4331,15.1988),(75.3990,15.2014),(75.3957,15.1656),(75.4033,15.1715),(75.4334,15.1093),(75.4165,15.0849),(75.4165,15.0596),(75.3692,15.0501),(75.3441,15.0670),(75.3331,15.0866),(75.3507,15.1002),(75.3500,15.1006),(75.3447,15.1058),(75.3371,15.1132),(75.3365,15.1617),(75.3070,15.1552),(75.3097,15.1383),(75.2872,15.1370),(75.2607,15.1185),(75.2534,15.0980),(75.2388,15.1090),(75.1882,15.0980),(75.1581,15.1015),(75.1588,15.1097),(75.1392,15.1045),(75.1330,15.1191),(75.1528,15.1458),(75.1409,15.1604),(75.1396,15.1581),(75.1320,15.1448),(75.1042,15.1412),(75.1045,15.1406),(75.1134,15.1171),(75.0774,15.1103),(75.0820,15.0745),(75.0582,15.0723),(75.0542,15.0830),(75.0128,15.0683),(74.9407,15.0664),(74.9404,15.0518),(74.9301,15.0462),(74.9169,15.0387),(74.9083,15.0508),(74.8888,15.0505),(74.8785,15.0739),(74.8921,15.0970),(74.8901,15.0973),(74.8593,15.1028),(74.8388,15.1282),(74.8328,15.1354),(74.8418,15.1536),(74.8775,15.1933),(74.8732,15.2164),(74.9103,15.2512),(74.9053,15.2785),(74.9043,15.2821),(74.8888,15.3072),(74.8739,15.2984),(74.8762,15.3166),(74.8537,15.3413),(74.8285,15.3407),(74.8193,15.3703),(74.8309,15.3729),(74.8209,15.3852),(74.7951,15.3787),(74.7653,15.3996),(74.7667,15.4158),(74.7667,15.4171),(74.7402,15.4145))'))
),
mk(district,market_id,market,localities,mlat,mlng) as (values
('Ghaziabad','GZB-01','Ghaziabad City','Kavi Nagar, Raj Nagar, Navyug Market',28.668,77.440),
('Ghaziabad','GZB-02','Meerut Road','Lohia Nagar, Sihani, Nandgram',28.688,77.478),
('Ghaziabad','GZB-03','Vijay Nagar and NH-9','Crossings Republik, Pratap Vihar',28.638,77.425),
('Ghaziabad','GZB-04','Indirapuram and Vaishali','Trans-Hindon homes and shops',28.638,77.365),
('Ghaziabad','GZB-05','Sahibabad Industrial','Site IV, Mohan Nagar, Rajendra Nagar',28.680,77.360),
('Ghaziabad','GZB-06','Raj Nagar Extension','Morta, Noor Nagar',28.708,77.425),
('Ghaziabad','GZB-07','Loni and Tronica City','Loni, Banthla, Tronica City',28.755,77.285),
('Ghaziabad','GZB-08','Muradnagar','Muradnagar town, Patla side',28.778,77.495),
('Ghaziabad','GZB-09','Modinagar','Modinagar town, Bhojpur side',28.835,77.590),
('Ghaziabad','GZB-10','Dasna and Masuri','NH-9 east, Dasna, Masuri',28.690,77.535),
('Hubli-Dharwad','HDW-01','Hubballi City','Old Hubli, Keshwapur, Deshpande Nagar',15.355,75.130),
('Hubli-Dharwad','HDW-02','Gokul Road and Airport','West Hubballi, Gokul Road',15.365,75.070),
('Hubli-Dharwad','HDW-03','Navanagar to Rayapur','Hubballi-Dharwad corridor',15.410,75.050),
('Hubli-Dharwad','HDW-04','Dharwad City','Dharwad town and its north side',15.460,75.015),
('Hubli-Dharwad','HDW-05','Belur and Mummigatti','Industrial belt on NH-48',15.505,74.925),
('Hubli-Dharwad','HDW-06','Kalghatgi','Kalghatgi town and villages',15.180,74.970),
('Hubli-Dharwad','HDW-07','Kundgol','Kundgol town and villages',15.255,75.250),
('Hubli-Dharwad','HDW-08','Navalgund','Navalgund town and villages',15.560,75.355),
('Hubli-Dharwad','HDW-09','Annigeri','Annigeri town and villages',15.425,75.430),
('Hubli-Dharwad','HDW-10','Alnavar','Alnavar town and villages',15.430,74.740)
),
near as (
  select distinct on (p.ctid_key) p.*, m.market_id, m.market, m.localities, m.mlat, m.mlng,
    sqrt(power((p.lng-m.mlng)*111.32*cos(radians(p.lat)),2)+power((p.lat-m.mlat)*110.57,2)) km
  from (select row_number() over () ctid_key, * from pts) p join mk m on m.district=p.district
  order by p.ctid_key, km
),
assigned as (
  select *, case when km <= case when district='Ghaziabad' then 6 else 10 end then market_id when district='Ghaziabad' then 'GZB-REST' else 'HDW-REST' end mid from near
)
select a.district, a.mid as market_id,
  coalesce(max(m.market),'Rest of district') as market,
  coalesce(max(m.localities),'Places more than '||max(case when a.district='Ghaziabad' then 6 else 10 end)||' km from any market centre') as localities,
  max(m.mlat) as lat, max(m.mlng) as lng,
  max(case when a.district='Ghaziabad' then 6 else 10 end) as radius_km,
  sum((a.item_type='profile_1.0')::int) as seekers,
  sum((a.item_type='job_posting_1.0')::int) as postings,
  sum((a.item_type='job_posting_1.0' and a.created_at >= now() - interval '180 days')::int) as postings_recent,
  coalesce(sum(a.openings),0) as openings,
  coalesce(sum(case when a.created_at >= now() - interval '180 days' then a.openings end),0) as openings_recent,
  sum((a.item_type='job_posting_1.0' and a.created_at >= now() - interval '30 days')::int) as postings_30d,
  coalesce(sum(case when a.created_at >= now() - interval '30 days' then a.openings end),0) as openings_30d,
  round(100.0*sum((a.item_type='job_posting_1.0')::int)/nullif(sum((a.item_type='profile_1.0')::int),0),1) as postings_per_100,
  round(100.0*sum((a.item_type='job_posting_1.0' and a.created_at >= now() - interval '180 days')::int)/nullif(sum((a.item_type='profile_1.0')::int),0),1) as postings_recent_per_100,
  round(100.0*coalesce(sum(a.openings),0)/nullif(sum((a.item_type='profile_1.0')::int),0),1) as openings_per_100,
  round(100.0*coalesce(sum(case when a.created_at >= now() - interval '180 days' then a.openings end),0)/nullif(sum((a.item_type='profile_1.0')::int),0),1) as openings_recent_per_100
from assigned a left join mk m on m.market_id=a.mid
group by a.district, a.mid
order by a.district, a.mid;
