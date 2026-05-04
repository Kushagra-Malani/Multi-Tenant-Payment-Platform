import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { TenantSchema } from '../tenant/tenant.schema';
import { UserSchema, Role } from '../users/user.schema';
import { WalletSchema } from '../wallets/wallet.schema';
import { LedgerSchema } from '../ledger/ledger.schema';

// Load environment variables from .env file
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-platform';

const tenants = [
  {
    slug: 'platform',
    name: 'FinanceOps Platform',
    tier: 'enterprise',
    apiRateLimit: 10000,
    maxUsers: 0,
    maxTransactionsPerMonth: 0,
    isActive: true
  },
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
    maxUsers: 100,
    maxTransactionsPerMonth: 1000000,
    isActive: true
  }
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const TenantModel = mongoose.model('Tenant', TenantSchema);
  const UserModel = mongoose.model('User', UserSchema);
  const WalletModel = mongoose.model('Wallet', WalletSchema);
  const LedgerModel = mongoose.model('Ledger', LedgerSchema);

  console.log('Clearing existing data...');
  await TenantModel.deleteMany({});
  await UserModel.deleteMany({});
  await WalletModel.deleteMany({});
  await LedgerModel.deleteMany({});
  
  // Clean up any orphaned payments from previous tenants
  const PaymentModel = mongoose.model('Payment', new mongoose.Schema({})); // minimal schema for delete
  await PaymentModel.deleteMany({});

  console.log('Inserting seed tenants...');
  const insertedTenants = await TenantModel.insertMany(tenants);
  console.log(`Inserted ${insertedTenants.length} tenants.`);

  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      email: 'admin@bank1.com',
      passwordHash,
      tenantId: insertedTenants[1]._id.toString(), // bank1
      role: Role.TENANT_ADMIN,
      isActive: true
    },
    {
      email: 'user@bank1.com',
      passwordHash,
      tenantId: insertedTenants[1]._id.toString(), // bank1
      role: Role.USER,
      isActive: true
    },
    {
      email: 'admin@hdfc.com',
      passwordHash,
      tenantId: insertedTenants[2]._id.toString(), // hdfc
      role: Role.TENANT_ADMIN,
      isActive: true
    },
    {
      email: 'superadmin@financeops.com',
      passwordHash,
      tenantId: insertedTenants[0]._id.toString(), // platform
      role: Role.SUPER_ADMIN,
      isActive: true
    }
  ];

  console.log('Inserting seed users...');
  await UserModel.insertMany(users);
  console.log('Successfully seeded users with password "password123"');

  const wallets = [
    // bank1
    { userId: "alice-bank1", tenantId: insertedTenants[1]._id.toString(), ownerName: "Alice Johnson", balance: 1000000, currency: "INR" },
    { userId: "bob-bank1", tenantId: insertedTenants[1]._id.toString(), ownerName: "Bob Smith", balance: 500000, currency: "INR" },
    { userId: "charlie-bank1", tenantId: insertedTenants[1]._id.toString(), ownerName: "Charlie Brown", balance: 250000, currency: "INR" },
    // hdfc
    { userId: "alice-hdfc", tenantId: insertedTenants[2]._id.toString(), ownerName: "Alice Sharma", balance: 5000000, currency: "INR" },
    { userId: "bob-hdfc", tenantId: insertedTenants[2]._id.toString(), ownerName: "Bob Patel", balance: 2500000, currency: "INR" },
    { userId: "charlie-hdfc", tenantId: insertedTenants[2]._id.toString(), ownerName: "Charlie Nair", balance: 1500000, currency: "INR" },
    // enterprise-bank
    { userId: "alice-ent", tenantId: insertedTenants[3]._id.toString(), ownerName: "Alice Chen", balance: 50000000, currency: "INR" },
    { userId: "bob-ent", tenantId: insertedTenants[3]._id.toString(), ownerName: "Bob Kumar", balance: 25000000, currency: "INR" },
    { userId: "charlie-ent", tenantId: insertedTenants[3]._id.toString(), ownerName: "Charlie Das", balance: 10000000, currency: "INR" }
  ];

  console.log('Inserting seed wallets...');
  await WalletModel.insertMany(wallets);
  console.log(`Inserted ${wallets.length} wallets.`);
  
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
