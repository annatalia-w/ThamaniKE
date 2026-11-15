import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Mandatory boot-time connection validation
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const SCHEMA_LIMITS = {
  UID_MAX: 128,
  UID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  FULL_NAME_MAX: 100,
  COMPANY_MAX: 120,
  WORK_ID_MAX: 60,
  WORK_ID_REGEX: /^[a-zA-Z0-9_\-/. ]+$/,
  EMAIL_MAX: 254,
  EMAIL_REGEX: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  SALARY_MIN: 0,
  SALARY_MAX: 1_000_000_000,
  BASKET_NAME_MAX: 100,
  BASKET_COST_MIN: 0,
  BASKET_COST_MAX: 100_000_000,
  NOTES_MAX: 500,
} as const;

export type SalaryMode = 'gross' | 'net';

export interface UserProfileRecord {
  uid: string;
  fullName: string;
  company: string;
  workId: string;
  salaryAmount: number;
  salaryType: SalaryMode;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserBasketRecord {
  uid: string;
  basketName: string;
  cost2021: number;
  cost2022: number;
  cost2023: number;
  cost2024: number;
  cost2025: number;
  cost2026: number;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function sanitizeWorkId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-/. ]/g, '').slice(0, SCHEMA_LIMITS.WORK_ID_MAX);
  return cleaned || 'EMP-001';
}

export function sanitizeProfileInput(input: {
  fullName: string;
  company: string;
  workId: string;
  salaryAmount: number;
  salaryType: SalaryMode;
}) {
  const fullName = input.fullName.trim().slice(0, SCHEMA_LIMITS.FULL_NAME_MAX);
  const company = input.company.trim().slice(0, SCHEMA_LIMITS.COMPANY_MAX);
  const workId = sanitizeWorkId(input.workId);
  const numericSalary = Number.isFinite(input.salaryAmount) ? input.salaryAmount : 0;
  const salaryAmount = Math.min(
    SCHEMA_LIMITS.SALARY_MAX,
    Math.max(SCHEMA_LIMITS.SALARY_MIN, Math.round(numericSalary * 100) / 100)
  );
  const salaryType: SalaryMode = input.salaryType === 'net' ? 'net' : 'gross';

  if (!fullName) throw new Error('Full name is required.');
  if (!company) throw new Error('Company name is required.');
  if (!SCHEMA_LIMITS.WORK_ID_REGEX.test(workId)) {
    throw new Error('Work ID may only contain letters, numbers, spaces, hyphens, slashes, or periods.');
  }

  return { fullName, company, workId, salaryAmount, salaryType };
}

export async function fetchUserProfile(uid: string): Promise<UserProfileRecord | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfileRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createUserProfileAndPii(
  uid: string,
  email: string,
  input: {
    fullName: string;
    company: string;
    workId: string;
    salaryAmount: number;
    salaryType: SalaryMode;
  }
): Promise<UserProfileRecord> {
  const sanitized = sanitizeProfileInput(input);
  const cleanEmail = email.trim().slice(0, SCHEMA_LIMITS.EMAIL_MAX);
  if (!SCHEMA_LIMITS.EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('A valid email address is required.');
  }

  const profilePath = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), {
      uid,
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid, 'private', 'contact'), {
      uid,
      email: cleanEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return {
      uid,
      ...sanitized,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, profilePath);
  }
}

export async function updateUserSalaryOnly(
  uid: string,
  salaryAmount: number,
  salaryType: SalaryMode
): Promise<void> {
  const boundedSalary = Math.min(
    SCHEMA_LIMITS.SALARY_MAX,
    Math.max(SCHEMA_LIMITS.SALARY_MIN, Math.round(salaryAmount * 100) / 100)
  );
  const validType: SalaryMode = salaryType === 'net' ? 'net' : 'gross';
  const path = `users/${uid}`;

  try {
    await updateDoc(doc(db, 'users', uid), {
      salaryAmount: boundedSalary,
      salaryType: validType,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserFullProfile(
  uid: string,
  input: {
    fullName: string;
    company: string;
    workId: string;
    salaryAmount: number;
    salaryType: SalaryMode;
  }
): Promise<UserProfileRecord> {
  const sanitized = sanitizeProfileInput(input);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
    return { uid, ...sanitized };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserBasket(uid: string): Promise<UserBasketRecord | null> {
  const path = `users/${uid}/baskets/default`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'baskets', 'default'));
    if (!snap.exists()) return null;
    return snap.data() as UserBasketRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserBasket(
  uid: string,
  input: Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'>,
  alreadyExists: boolean
): Promise<UserBasketRecord> {
  const clampCost = (val: number) =>
    Math.min(
      SCHEMA_LIMITS.BASKET_COST_MAX,
      Math.max(SCHEMA_LIMITS.BASKET_COST_MIN, Math.round((Number.isFinite(val) ? val : 0) * 100) / 100)
    );

  const sanitized = {
    basketName: input.basketName.trim().slice(0, SCHEMA_LIMITS.BASKET_NAME_MAX) || 'Household Basket',
    cost2021: clampCost(input.cost2021),
    cost2022: clampCost(input.cost2022),
    cost2023: clampCost(input.cost2023),
    cost2024: clampCost(input.cost2024),
    cost2025: clampCost(input.cost2025),
    cost2026: clampCost(input.cost2026),
    notes: (input.notes || '').trim().slice(0, SCHEMA_LIMITS.NOTES_MAX),
  };

  const path = `users/${uid}/baskets/default`;
  const ref = doc(db, 'users', uid, 'baskets', 'default');

  try {
    if (alreadyExists) {
      await updateDoc(ref, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return { uid, ...sanitized };
  } catch (error) {
    handleFirestoreError(
      error,
      alreadyExists ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function clearUserBasket(uid: string): Promise<void> {
  const path = `users/${uid}/baskets/default`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'baskets', 'default'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
