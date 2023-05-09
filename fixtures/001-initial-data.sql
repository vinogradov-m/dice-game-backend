START TRANSACTION;

INSERT INTO users(login)
VALUES ('alice'),
       ('bob'),
       ('charlie'),
       ('dave');

INSERT INTO rooms(name)
VALUES ('Eastern Kingdoms'),
       ('Kalimdor'),
       ('Northrend'),
       ('Pandaria');

COMMIT;
