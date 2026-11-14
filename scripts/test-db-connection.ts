import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function testConnection() {
  console.log('----------------------------------------------------');
  console.log('Testing connection to Remote PostgreSQL Database...');
  console.log(`Connection URL: ${connectionString?.replace(/:([^:@]+)@/, ':****@')}`);
  console.log('----------------------------------------------------');

  if (!connectionString || connectionString.includes('YOUR_PASSWORD_HERE')) {
    console.error('ERROR: Please set your actual password in .env file (replace YOUR_PASSWORD_HERE).');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), current_user, version();');
    console.log('SUCCESS: Connected to Remote PostgreSQL successfully!');
    console.log('Current Database:', res.rows[0].current_database);
    console.log('Current User:    ', res.rows[0].current_user);
    console.log('PostgreSQL Info: ', res.rows[0].version.split(',')[0]);
    console.log('----------------------------------------------------');
    await client.end();
  } catch (err: any) {
    console.error('CONNECTION FAILED:', err.message);
    process.exit(1);
  }
}

testConnection();
