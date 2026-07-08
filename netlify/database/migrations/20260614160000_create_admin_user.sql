-- Create admin user with full privileges on the public schema
CREATE USER "Abhishek" WITH PASSWORD 'Hpab522tx@';

-- Grant all privileges on the public schema
GRANT ALL PRIVILEGES ON SCHEMA public TO "Abhishek";

-- Grant all privileges on all existing tables, sequences, and functions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "Abhishek";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "Abhishek";
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "Abhishek";

-- Grant all privileges on all future tables, sequences, and functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "Abhishek";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "Abhishek";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "Abhishek";
