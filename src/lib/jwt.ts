import { SignJWT, jwtVerify, JWTPayload } from 'jose';

function getSecretKey() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export interface CustomJWTPayload extends JWTPayload {
  userId: string;
  name: string;
  role: string;
  branchId?: string; // Optional: If user is restricted to a branch
  isGlobalOwner: boolean;
  
}

export async function signToken(payload: CustomJWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<CustomJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as CustomJWTPayload;
  } catch (error) {
    return null;
  }
}
