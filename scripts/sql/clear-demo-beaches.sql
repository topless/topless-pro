-- Local cleanup for the exact demonstration records in fixtures/0001_demo_beaches.sql.
DELETE FROM corrections
WHERE beach_slug IN (
  SELECT slug
  FROM beaches
  WHERE (id = 'b1' AND slug = 'paradise-beach-mykonos')
     OR (id = 'b2' AND slug = 'plage-des-eaux-vives')
     OR (id = 'b3' AND slug = 'cap-dagde-naturist-beach')
     OR (id = 'b4' AND slug = 'red-beach-matala')
);

DELETE FROM beaches
WHERE (id = 'b1' AND slug = 'paradise-beach-mykonos')
   OR (id = 'b2' AND slug = 'plage-des-eaux-vives')
   OR (id = 'b3' AND slug = 'cap-dagde-naturist-beach')
   OR (id = 'b4' AND slug = 'red-beach-matala');
