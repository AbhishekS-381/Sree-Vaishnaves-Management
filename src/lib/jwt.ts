import { SignJWT, jwtVerify, JWTPayload } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const secretKey = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

export interface CustomJWTPayload extends JWTPayload {
  userId: string;
  name: string;
  role: string;
  branchId?: string; // Optional: If user is restricted to a branch
  isGlobalAdmin: boolean;
}

export async function signToken(payload: CustomJWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifyToken(token: string): Promise<CustomJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as CustomJWTPayload;
  } catch (error) {
    return null;
  }
}
