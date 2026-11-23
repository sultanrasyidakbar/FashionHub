USE fashionhub;

START TRANSACTION;

INSERT INTO roles (name) VALUES ('user')
ON DUPLICATE KEY UPDATE name = VALUES(name);

UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'user')
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN ('staff', 'kasir')
);

DELETE FROM roles WHERE name IN ('staff', 'kasir');

COMMIT;
