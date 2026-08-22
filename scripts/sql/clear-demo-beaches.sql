-- Local cleanup for the exact demonstration records in fixtures/0001_demo_beaches.sql.
DELETE FROM submissions
WHERE beach_slug IN (
  'paradise-beach-mykonos',
  'plage-des-eaux-vives',
  'cap-dagde-naturist-beach',
  'red-beach-matala',
  'demo-unpublished-cove'
);

DELETE FROM beaches
WHERE slug IN (
  'paradise-beach-mykonos',
  'plage-des-eaux-vives',
  'cap-dagde-naturist-beach',
  'red-beach-matala',
  'demo-unpublished-cove'
);
