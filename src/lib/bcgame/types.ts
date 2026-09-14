export type ConnectionStatus = "CONNECTED" | "DISCONNECTED";

export type BalanceView = {
  amount: string;
  currency: string;
};

export type SessionView = {
  status: ConnectionStatus;
  balance: BalanceView | null;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type LoginResult = SessionView & {
  error?: string;
};

export type CookieJar = Record<string, string>;

export type StoredSession = {
  origin: string;
  userAgent: string;
  cookies: CookieJar;
  connectedAt: number;
  credentials?: {
    identifier: string;
    password: string;
  };
};

export type AmountRow = {
  currencyName?: string;
  aliasCurrencyName?: string;
  amount?: string;
  generalAmount?: string;
  bonusAmount?: string;
  display?: boolean;
  useable?: boolean;
  abnormal?: boolean;
};

export type AccountData = {
  userId?: number;
  name?: string | null;
  email?: string | null;
};

export type ApiEnvelope<T> = {
  code: number;
  msg: string | null;
  data: T;
};

export type HttpLoginFailure = {
  ok: false;
  code: number;
  message: string;
};

export type HttpLoginSuccess = {
  ok: true;
  session: StoredSession;
};
