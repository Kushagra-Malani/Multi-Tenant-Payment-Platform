import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TenantSchema } from '../tenant/tenant.schema';

// Load environment variables from .env file
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-platform';

const tenants = [
  {
    slug: 'bank1',
    name: 'Bank One',
    tier: 'starter',
    apiRateLimit: 60,
    maxUsers: 10,
    maxTransactionsPerMonth: 1000,
    isActive: true
  },
  {
    slug: 'hdfc',
    name: 'HDFC Bank',
    tier: 'professional',
    apiRateLimit: 300,
    maxUsers: 100,
    maxTransactionsPerMonth: 50000,
    isActive: true
  },
  {
    slug: 'enterprise-bank',
    name: 'Enterprise Bank',
    tier: 'enterprise',
    apiRateLimit: 1000,
    maxUsers: 0, // 0 = unlimited as per schema comments
    maxTransactionsPerMonth: 0, // 0 = unlimited as per schema comments
    isActive: true
  }
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // Create the Tenant model using the existing schema
  const TenantModel = mongoose.model('Tenant', TenantSchema);

  console.log('Clearing existing tenants...');
  await TenantModel.deleteMany({});

  console.log('Inserting seed tenants...');
  await TenantModel.insertMany(tenants);

  console.log('Successfully inserted 3 tenants!');
  
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
