export function isValidPasscode(passcode: string | null): boolean {
  const correctPasscode = process.env.ADMIN_PASSCODE || 'himasta2026';
  return passcode === correctPasscode;
}
