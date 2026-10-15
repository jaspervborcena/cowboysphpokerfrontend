export type AuthIdentifier =
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string }
  | { type: 'invalid'; value: string };

export function parseAuthIdentifier(input: string): AuthIdentifier {
  const value = input.trim();
  const email = value.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { type: 'email', value: email };
  }

  const phone = value.replace(/[\s()-]/g, '');
  if (/^09\d{9}$/.test(phone)) {
    return { type: 'phone', value: `+63${phone.slice(1)}` };
  }
  if (/^\+639\d{9}$/.test(phone)) {
    return { type: 'phone', value: phone };
  }
  if (/^639\d{9}$/.test(phone)) {
    return { type: 'phone', value: `+${phone}` };
  }

  return { type: 'invalid', value };
}