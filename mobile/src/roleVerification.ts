export type VerificationResult = {
  verified: false;
  reason: "not_configured";
};

export interface RoleVerificationProvider {
  verifyRole(input: {
    role: string;
    subjectKeyFingerprint: string;
    credential?: unknown;
  }): Promise<VerificationResult>;
}

/** Local boundary only. Role selection and unsigned profile packets grant no trust. */
export class StubRoleVerificationProvider implements RoleVerificationProvider {
  async verifyRole(): Promise<VerificationResult> {
    return { verified: false, reason: "not_configured" };
  }
}
