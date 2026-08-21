-- Local and test demonstration records only.
-- This file is intentionally outside migrations/ so it is never applied to production by
-- `wrangler d1 migrations apply`. The last record is unpublished so the published-only
-- behaviour of the API, pages and sitemap is exercised.
INSERT OR IGNORE INTO beaches (slug, name, country_code, country_name, region, municipality, latitude, longitude, dress_code, recognition, confidence, summary, facilities_json, last_verified_at, published) VALUES
('paradise-beach-mykonos','Paradise Beach','GR','Greece','South Aegean','Mykonos',37.4109,25.3571,'topless-permitted','community-reported','low','A sample listing used to demonstrate the directory. Local customs can vary by area and season.','["Sunbeds","Food","Toilets"]','2026-07-21',1),
('plage-des-eaux-vives','Plage des Eaux-Vives','CH','Switzerland','Geneva','Geneva',46.2078,6.1706,'topless-permitted','community-reported','low','A sample urban-beach listing. Verify current signage and customary use before relying on this classification.','["Showers","Toilets","Food"]','2026-07-21',1),
('cap-dagde-naturist-beach','Cap d’Agde Naturist Beach','FR','France','Occitanie','Agde',43.2934,3.5275,'nudity-permitted','official','medium','A sample official naturist-area listing. Exact boundaries and access conditions should be confirmed from an authoritative source.','["Food","Toilets","Parking"]','2026-07-21',1),
('red-beach-matala','Red Beach','GR','Greece','Crete','Matala',34.9891,24.7482,'clothing-optional','community-reported','low','A sample listing for a beach commonly associated with clothing-optional use. Verify locally.','[]','2026-07-21',1),
('demo-unpublished-cove','Demo Unpublished Cove','GR','Greece','Crete','Matala',34.9950,24.7600,'nudity-permitted','community-reported','low','A sample draft that is not published and must never appear publicly.','[]',NULL,0);
