import {
  assertFails,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const VALID_PROFILE_BASE = {
  uid: 'user_A',
  fullName: 'Wanjiku Mwangi',
  company: 'Safaricom PLC',
  workId: 'EMP-2026-041',
  salaryAmount: 120000,
  salaryType: 'gross',
};

const VALID_PII_BASE = {
  uid: 'user_A',
  email: 'wanjiku@example.co.ke',
};

describe('ThamaniKE Firestore Fortress Rules — Dirty Dozen Suite', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'thamanike-security-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  async function seedValidUserA() {
    const ctx = testEnv.authenticatedContext('user_A', {
      email: 'wanjiku@example.co.ke',
      email_verified: true,
    });
    const db = ctx.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'user_A'), {
      ...VALID_PROFILE_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', 'user_A', 'private', 'contact'), {
      ...VALID_PII_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  it('1. Rejects Identity Spoofing on Profile Create (uid != request.auth.uid)', async () => {
    const ctx = testEnv.authenticatedContext('user_A', { email_verified: true });
    const db = ctx.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'user_A'), {
      ...VALID_PROFILE_BASE,
      uid: 'user_B',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', 'user_A', 'private', 'contact'), {
      ...VALID_PII_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('2. Rejects Cross-Tenant Profile & PII Read', async () => {
    await seedValidUserA();
    const attackerDb = testEnv
      .authenticatedContext('user_B', { email_verified: true })
      .firestore();
    await assertFails(getDoc(doc(attackerDb, 'users', 'user_A')));
    await assertFails(getDoc(doc(attackerDb, 'users', 'user_A', 'private', 'contact')));
  });

  it('3. Rejects Unverified Email Write (email_verified == false)', async () => {
    const unverifiedDb = testEnv
      .authenticatedContext('user_A', { email_verified: false })
      .firestore();
    const batch = writeBatch(unverifiedDb);
    batch.set(doc(unverifiedDb, 'users', 'user_A'), {
      ...VALID_PROFILE_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(unverifiedDb, 'users', 'user_A', 'private', 'contact'), {
      ...VALID_PII_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('4. Rejects Shadow / Ghost Field Injection on Create', async () => {
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'user_A'), {
      ...VALID_PROFILE_BASE,
      isAdmin: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', 'user_A', 'private', 'contact'), {
      ...VALID_PII_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('5. Rejects Shadow / Ghost Field Injection on Update', async () => {
    await seedValidUserA();
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    await assertFails(
      updateDoc(doc(db, 'users', 'user_A'), {
        salaryAmount: 150000,
        role: 'superuser',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('6. Rejects Immortal Field Mutation (createdAt or uid)', async () => {
    await seedValidUserA();
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    await assertFails(
      updateDoc(doc(db, 'users', 'user_A'), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('7. Rejects Client-Forged Timestamp Attack', async () => {
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    const forgedTime = Timestamp.fromMillis(1700000000000);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'user_A'), {
      ...VALID_PROFILE_BASE,
      createdAt: forgedTime,
      updatedAt: forgedTime,
    });
    batch.set(doc(db, 'users', 'user_A', 'private', 'contact'), {
      ...VALID_PII_BASE,
      createdAt: forgedTime,
      updatedAt: forgedTime,
    });
    await assertFails(batch.commit());
  });

  it('8. Rejects Value Poisoning on Whitelisted Update Key', async () => {
    await seedValidUserA();
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    await assertFails(
      updateDoc(doc(db, 'users', 'user_A'), {
        salaryAmount: -50000,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'user_A'), {
        salaryType: 'hourly',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('9. Rejects Oversized String & Malformed workId Regex Poisoning', async () => {
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'user_A'), {
      ...VALID_PROFILE_BASE,
      fullName: 'A'.repeat(5000),
      workId: '<script>alert(1)</script>',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', 'user_A', 'private', 'contact'), {
      ...VALID_PII_BASE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('10. Rejects Orphaned Profile Create Without Atomic PII Document', async () => {
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(db, 'users', 'user_A'), {
        ...VALID_PROFILE_BASE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('11. Rejects Orphaned Basket Subcollection Write Without Parent User Profile', async () => {
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(db, 'users', 'user_A', 'baskets', 'default'), {
        uid: 'user_A',
        basketName: 'Nairobi Household Staples',
        cost2021: 8500,
        cost2022: 9400,
        cost2023: 10300,
        cost2024: 10800,
        cost2025: 11200,
        cost2026: 11900,
        notes: 'Maize flour, milk, cooking oil, sugar',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('12. Rejects Unauthorized Collection Scraping (list query on /users)', async () => {
    await seedValidUserA();
    const db = testEnv
      .authenticatedContext('user_A', { email_verified: true })
      .firestore();
    await assertFails(getDocs(collection(db, 'users')));
  });
});
