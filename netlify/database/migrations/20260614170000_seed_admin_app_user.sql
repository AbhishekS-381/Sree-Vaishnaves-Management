-- Seed the Abhishek root user into the application's user store
DO $$
DECLARE
  current_data jsonb;
  user_exists boolean;
  new_user jsonb := '{"id":"u_abhishek1","name":"Abhishek","password":"Hpab522tx@","role":"owner"}';
BEGIN
  SELECT data::jsonb INTO current_data
  FROM json_store
  WHERE filename = 'users.json';

  IF current_data IS NULL THEN
    INSERT INTO json_store (filename, data)
    VALUES ('users.json', jsonb_build_array(new_user)::text);
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(current_data) elem
      WHERE lower(elem->>'name') = 'abhishek'
    ) INTO user_exists;

    IF NOT user_exists THEN
      UPDATE json_store
      SET data = (current_data || jsonb_build_array(new_user))::text
      WHERE filename = 'users.json';
    END IF;
  END IF;
END $$;
