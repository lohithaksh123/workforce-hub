import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const normalizeWalletUserId = (name: string): string => {
  const n = (name || "").trim().toUpperCase();
  if (n === "T VENKATESWARA REDDY" || n === "T VENKATESWARA" || n === "T.V. REDDY" || n === "T V REDDY" || n === "TV REDDY") {
    return "T V REDDY";
  }
  if (n === "VINEETH CHINNAM" || n === "VINNETH CHINNAM") {
    return "Vinneth Chinnam";
  }
  if (n === "COMPANY OWNER" || n === "OWNER") {
    return "Company Owner";
  }
  return name;
};
