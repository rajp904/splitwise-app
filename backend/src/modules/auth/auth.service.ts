// Auth service — pure business logic for registration and login.
// No HTTP concerns here; just DB operations and token generation.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';

const SALT_ROUNDS = 12; // bcrypt work factor — high enough to be slow for attackers

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = signToken(user.id, user.email);
  return { user, token };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  if (!user) {
    // Same error for unknown email and wrong password — avoid user enumeration
    throw new AppError(401, 'Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid email or password');
  }

  const token = signToken(user.id, user.email);
  return {
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    token,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

function signToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}
