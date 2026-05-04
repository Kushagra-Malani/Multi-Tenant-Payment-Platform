const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://paymentuser:epwQy525xgzCvzAA@payment-platform-cluste.fpvynzh.mongodb.net/?appName=payment-platform-cluster";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(d => d.name));

    for (const dbName of ['payment-platform', 'test']) {
      const db = client.db(dbName);
      const tenants = await db.collection('tenants').find({}).toArray();
      console.log(`DB ${dbName} Tenants:`, tenants.length);
      if (tenants.length > 0) {
        console.log(`Tenants in ${dbName}:`, JSON.stringify(tenants, null, 2));
      }
      
      const users = await db.collection('users').find({ role: 'SUPER_ADMIN' }).toArray();
      if (users.length > 0) {
        console.log(`Super Admins in ${dbName}:`, JSON.stringify(users, null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
