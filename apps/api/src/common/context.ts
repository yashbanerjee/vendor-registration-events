import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContextStore = {
  correlationId: string;
  ip?: string;
  userAgent?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function currentContext(): RequestContextStore {
  return requestContext.getStore() ?? { correlationId: "" };
}
