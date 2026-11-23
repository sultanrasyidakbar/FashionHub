USE fashionhub;

START TRANSACTION;

INSERT INTO fashionhub.roles (name) VALUES ('user')
ON DUPLICATE KEY UPDATE name = VALUES(name);

UPDATE fashionhub.users
SET role_id = (SELECT id FROM fashionhub.roles WHERE name = 'user')
WHERE role_id = (SELECT id FROM fashionhub.roles WHERE name = 'kasir');

DELETE FROM fashionhub.roles WHERE name = 'kasir';

COMMIT;
