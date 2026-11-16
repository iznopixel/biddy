export type SandboxCredentials = { realmId: string; accessToken: string };

export type SandboxCredentialProvider = () => Promise<SandboxCredentials | null>;

export const loadSandboxCredentials: SandboxCredentialProvider = async () => {
  const realmId = process.env.QBO_REALM_ID;
  const accessToken = process.env.QBO_ACCESS_TOKEN;
  return realmId && /^\d+$/.test(realmId) && accessToken ? { realmId, accessToken } : null;
};
