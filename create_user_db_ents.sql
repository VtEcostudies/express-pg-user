DROP TYPE IF EXISTS registration_status_type;
CREATE TYPE registration_status_type AS ENUM
	('registration', 'reset', 'new_email', 'confirmed', 'invalid');

DROP TYPE IF EXISTS user_role_type;
CREATE TYPE user_role_type AS ENUM
	('guest', 'user', 'admin');

CREATE TABLE IF NOT EXISTS users
(
    "userId" SERIAL NOT NULL,
    username text COLLATE pg_catalog."default" NOT NULL,
    email text COLLATE pg_catalog."default" NOT NULL,
    hash text COLLATE pg_catalog."default" NOT NULL,
	userrole user_role_type DEFAULT 'guest'::user_role_type,
    "firstName" text COLLATE pg_catalog."default" NOT NULL,
    "lastName" text COLLATE pg_catalog."default" NOT NULL,
    "middleName" text COLLATE pg_catalog."default",
    "userPhone" text COLLATE pg_catalog."default",
    "userAddress" text COLLATE pg_catalog."default",
    "userCredentials" text COLLATE pg_catalog."default",
    "userTrained" boolean,
    token character varying COLLATE pg_catalog."default",
    status registration_status_type DEFAULT 'registration'::registration_status_type,
    alias text[] COLLATE pg_catalog."default",
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    CONSTRAINT user_pkey PRIMARY KEY (username),
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT user_id_unique_key UNIQUE ("userId")
);

CREATE TABLE IF NOT EXISTS role
(
    role text COLLATE pg_catalog."default" NOT NULL,
    "roleDesc" text COLLATE pg_catalog."default",
    CONSTRAINT role_pkey PRIMARY KEY (role)
);

CREATE TABLE IF NOT EXISTS users_roles
(
    "usersRolesUserId" integer NOT NULL,
    "usersRolesRole" text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT users_roles_unique UNIQUE ("usersRolesUserId", "usersRolesRole"),
    CONSTRAINT users_roles_role_fkey FOREIGN KEY ("usersRolesRole")
        REFERENCES role (role) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT "users_roles_userId_fkey" FOREIGN KEY ("usersRolesUserId")
        REFERENCES users ("userId") MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS alias
(
    alias text COLLATE pg_catalog."default" NOT NULL,
    "aliasUserId" integer NOT NULL,
    CONSTRAINT user_alias_pkey PRIMARY KEY (alias),
    CONSTRAINT "user_alias_aliasUserId_fkey" FOREIGN KEY ("aliasUserId")
        REFERENCES users ("userId") MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

DROP FUNCTION IF EXISTS set_user_alias_rows_from_user_array();
CREATE FUNCTION set_user_alias_rows_from_user_array()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
DECLARE
	alias text;
BEGIN
	IF alias THEN
		DELETE FROM alias WHERE "aliasUserId"=NEW."userId";
		RAISE NOTICE 'Alias Array %', NEW."alias";
		FOR i IN array_lower(NEW.alias, 1) .. array_upper(NEW.alias, 1)
		LOOP
			RAISE NOTICE 'alias: %', NEW.alias[i];
			INSERT INTO alias ("aliasUserId", "alias") VALUES (NEW."userId", NEW.alias[i]);
		END LOOP;
	END IF;
	RETURN NEW;
END;
$BODY$;

/*
CREATE FUNCTION set_updated_at()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
BEGIN
   NEW."updatedAt" = now();
   RETURN NEW;
END;
$BODY$;
*/

CREATE TRIGGER trigger_before_insert_set_user_alias_rows_from_user_array
    AFTER INSERT
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_user_alias_rows_from_user_array();

CREATE TRIGGER trigger_before_update_set_user_alias_rows_from_user_array
    AFTER UPDATE
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_user_alias_rows_from_user_array();

CREATE TRIGGER trigger_updated_at
    BEFORE UPDATE
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
